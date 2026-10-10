// Colyseus link to Clean-leaves-for-loot-backend (room "world"): loads/saves the persisted half
// of `state`, relays this player's pose / vacuum / aura / avatar, exposes the other players and
// the leaderboards. Never throws and never blocks play: with no server (or an unreachable one)
// the game simply runs offline on local state.
import { Client } from '@colyseus/sdk'
import { NET, SERVER_URL } from './config.js'
import { authState, getEquippedAvatar, getProportions, getSkinTextureUrl, subscribeAuth } from './bloxity.js'
import { notify, state, subscribe } from './state.js'
import { applyUpgrades } from './upgrades.js'

// The keys the server persists (backend src/sanitize.ts).
const SAVED = ['cash', 'power', 'leaves', 'level', 'xp', 'xpNext', 'rebirths', 'bag', 'sellLocked', 'discovered', 'vacuumOwned', 'vacuum', 'auraOwned', 'aura', 'upgrades']
const AVATAR_MAX = 3000 // backend AVATAR_MAX_LEN

export const net = {
  room: null,
  connected: false,
  hydrated: false, // a progress/noProgress answer arrived: saving is allowed
  leaderboard: { power: [], rebirths: [], leaves: [] }, // rows { id, name, value, avatar? }
  get sessionId() {
    return this.room?.sessionId ?? null
  },
  get players() {
    return this.room?.state?.players ?? null
  },
}

const boardListeners = new Set()
export function onLeaderboard(fn) {
  boardListeners.add(fn)
  fn(net.leaderboard)
  return () => boardListeners.delete(fn)
}

// --- Identity ----------------------------------------------------------------
// Signed-in players use their Bloxity id; everyone else a per-browser guest id (never saved).
function guestId() {
  const make = () => `guest-${Math.random().toString(36).slice(2, 10)}`
  try {
    let id = localStorage.getItem('clfl-guest')
    if (!id) localStorage.setItem('clfl-guest', (id = make()))
    return id
  } catch {
    return make()
  }
}
const GUEST = guestId()

function identity() {
  const u = authState.user
  const id = u && (u.id ?? u.userId ?? u.uid)
  if (!id) return { userId: GUEST, username: authState.guest?.displayName || authState.guest?.username || 'Guest' }
  return { userId: String(id), username: String(u.displayName || u.username || u.name || 'Player') }
}

// Bloxity avatar as the server relays it: JSON { equipped, proportions, skin }, length-capped.
// The skin URL is the first thing dropped when it does not fit.
function avatarJson() {
  if (!authState.user) return ''
  const equipped = getEquippedAvatar()
  if (!equipped) return ''
  for (const skin of [getSkinTextureUrl(), null]) {
    try {
      const json = JSON.stringify({ equipped, proportions: getProportions(), skin })
      if (json.length <= AVATAR_MAX) return json
    } catch {
      return ''
    }
  }
  return ''
}

// --- Saving ------------------------------------------------------------------
let lastSaved = ''
let saveTimer = 0
let firstDirty = 0
let sentId = '' // identity the server currently attributes saves to

const snapshot = () => JSON.stringify(Object.fromEntries(SAVED.map((k) => [k, state[k]])))
const isGuest = () => sentId.startsWith('guest-')

export function saveNow() {
  clearTimeout(saveTimer)
  saveTimer = 0
  firstDirty = 0
  if (!net.connected || !net.hydrated) return
  const snap = snapshot()
  if (snap === lastSaved) return
  lastSaved = snap
  send('saveProgress', JSON.parse(snap))
}

function scheduleSave() {
  if (!net.connected || !net.hydrated) return
  const now = performance.now()
  if (!firstDirty) firstDirty = now
  clearTimeout(saveTimer)
  const wait = Math.min(NET.saveDebounce * 1000, Math.max(0, firstDirty + NET.saveMaxWait * 1000 - now))
  saveTimer = setTimeout(saveNow, wait)
}

function hydrate(doc) {
  for (const k of SAVED) if (doc[k] !== undefined) state[k] = doc[k]
  applyUpgrades()
  lastSaved = snapshot() // what the server holds: don't echo it straight back
  notify()
}

// --- Messages out ------------------------------------------------------------
function send(type, payload) {
  try {
    net.room?.send(type, payload)
  } catch (err) {
    console.warn('[net] send failed', type, err)
  }
}

let lastPose = ''
let lastPoseAt = 0
// Throttled to NET.poseHz; skips repeats while standing still.
export function sendPose(player, speed, pose) {
  if (!net.connected) return
  const now = performance.now()
  if (now - lastPoseAt < 1000 / NET.poseHz) return
  lastPoseAt = now
  const r = (n) => Math.round(n * 100) / 100
  const msg = { x: r(player.position.x), y: r(player.position.y), z: r(player.position.z), yaw: r(player.facing), speed01: r(Math.min(1, speed / player.moveSpeed)), grounded: player.grounded, pose }
  const key = JSON.stringify(msg)
  if (key === lastPose) return
  lastPose = key
  send('pose', msg)
}

let sentVacuum = null
let sentAura = null
function syncEquipment() {
  if (!net.connected) return
  if (state.vacuum !== sentVacuum) send('setVacuum', { vacuum: (sentVacuum = state.vacuum ?? '') })
  if ((state.aura ?? '') !== sentAura) send('setAura', { aura: (sentAura = state.aura ?? '') })
}

let sentAvatar = null
export function syncAvatar() {
  if (!net.connected) return
  const avatar = avatarJson()
  if (avatar === sentAvatar) return
  sentAvatar = avatar
  send('setAvatar', { avatar })
}

// --- Connection --------------------------------------------------------------
function attach(room) {
  net.room = room
  net.connected = true
  room.onMessage('progress', (doc) => {
    net.hydrated = true
    hydrate(doc ?? {})
  })
  room.onMessage('noProgress', () => {
    // New account, guest or no database: keep what we have and push it as the first save.
    net.hydrated = true
    lastSaved = ''
    if (!isGuest()) saveNow()
  })
  room.onMessage('serverError', () => {
    // The save exists but could not be read: never overwrite it.
    net.hydrated = false
    console.warn('[net] server could not read the saved progress; saving is off for this session')
  })
  room.onMessage('leaderboard', (rows) => {
    net.leaderboard = { power: rows?.power ?? [], rebirths: rows?.rebirths ?? [], leaves: rows?.leaves ?? [] }
    for (const fn of boardListeners) fn(net.leaderboard)
  })
  room.onLeave(() => {
    if (net.room !== room) return
    net.room = null
    net.connected = false
    net.hydrated = false
    setTimeout(connect, 3000) // keep trying; local play is unaffected meanwhile
  })
  sentVacuum = sentAura = sentAvatar = null
  syncEquipment()
  syncAvatar()
}

let connecting = false
async function connect() {
  if (!SERVER_URL || connecting || net.connected) return
  connecting = true
  try {
    const id = identity()
    sentId = id.userId
    const client = new Client(SERVER_URL)
    attach(await client.joinOrCreate('world', { ...id, avatar: avatarJson() }))
  } catch (err) {
    console.warn('[net] could not reach the server; playing offline', err?.message ?? err)
    setTimeout(connect, 10000)
  } finally {
    connecting = false
  }
}

export function initNet() {
  if (!SERVER_URL) return
  subscribe(() => {
    scheduleSave()
    syncEquipment()
  })
  // The first ready call connects; later ones are sign-in / sign-out.
  subscribeAuth((s) => {
    if (!s.ready) return
    if (!net.connected) return void connect()
    const id = identity()
    if (id.userId === sentId) return send('identify', { username: id.username })
    saveNow() // under the old id, before switching
    net.hydrated = false
    sentId = id.userId
    send('identify', id)
    syncAvatar()
  })
  window.addEventListener('beforeunload', saveNow)
  document.addEventListener('visibilitychange', () => document.hidden && saveNow())
}
