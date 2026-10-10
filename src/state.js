// Live game state shared by the HUD, loot, selling and the blower. Plain object + subscribe;
// mutate through the helpers (or call notify() after editing `state`) so the HUD re-renders.
import { AURAS, DAILY, HUD_START, INDEX, LEVEL, POWER_GAIN, REBIRTH, UPGRADES, VACUUMS } from './config.js'

const AURA_BOOST = Object.fromEntries(AURAS.map((a) => [a.id, a.boost]))
const VAC_POWER = Object.fromEntries(VACUUMS.map((v) => [v.id, v.power]))

export const state = {
  ...HUD_START,
  bag: [], // collected loot: { name, rarity, value }
  sellOpen: false, // Sell Shop window shown
  sellLocked: [], // item names the player locked: skipped by Sell All, refused by Sell (sell.js)
  upgradesOpen: false, // Upgrades window shown
  vacuumsOpen: false, // Vacuums window shown
  vacuumOwned: ['battery'], // ids bought (vacuums.js)
  vacuum: 'battery', // id equipped
  playSeconds: 0, // total time played, saved; unlocks the free gift (FREE_GIFT)
  giftClaimed: false, // the free gift vacuum was taken (vacuums.js)
  rebirthOpen: false, // Rebirth window shown
  indexOpen: false, // Index window shown
  discovered: [], // item names collected at least once (index.js); survives rebirths
  aurasOpen: false, // Auras window shown
  auraOwned: [], // ids bought or claimed (auras.js)
  aura: null, // id equipped
  dailyOpen: false, // Daily Login window shown
  dailyDay: 0, // last claimed day of the 7-day streak (0 = none), saved (daily.js)
  dailyClaimedAt: 0, // epoch ms of that claim, saved
  boosts: { power: 0, cash: 0 }, // timed x2 boosts: epoch ms each one expires, saved
  upgrades: { range: 0, agility: 0, capacity: 0, walk: 0 }, // bought levels (upgrades.js)
  tutorialStep: 0, // onboarding progress, saved; TUTORIAL.steps = finished (tutorial.js)
  controlsDone: false, // the controls guide was completed, saved; true for existing accounts (hud.js)
  tutorialReady: false, // the server has said whether this account is new (net.js); never shown before
}

// Wall clock, corrected to the server's once it has told us the time (net.js), so the daily-login day
// and boost expiry don't depend on the player's own clock setting.
let clockOffset = 0
export const now = () => Date.now() + clockOffset
export const setServerTime = (ms) => Number.isFinite(ms) && (clockOffset = ms - Date.now())

// Timed boosts (DAILY rewards): x DAILY.boostMult on total power / sell payouts while running.
export const boostLeft = (kind) => Math.max(0, (state.boosts[kind] ?? 0) - now())
export const boostActive = (kind) => boostLeft(kind) > 0
export const boostMultiplier = (kind) => (boostActive(kind) ? DAILY.boostMult : 1)

// Counts played time; notifies only every 10 s so the HUD and saves aren't churned each tick.
let playFrac = 0
export function addPlaySeconds(dt) {
  state.playSeconds += dt
  playFrac += dt
  if (playFrac >= 10) {
    playFrac = 0
    notify()
  }
}

const listeners = new Set()
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
// Only one window at a time: when a window opens, the ones already open are closed.
const WINDOW_KEYS = ['sellOpen', 'upgradesOpen', 'vacuumsOpen', 'rebirthOpen', 'indexOpen', 'aurasOpen', 'dailyOpen']
let openWindows = new Set()
function exclusiveWindows() {
  const now = WINDOW_KEYS.filter((k) => state[k])
  if (now.length > 1) {
    const fresh = now.filter((k) => !openWindows.has(k))
    const keep = fresh.length ? fresh[fresh.length - 1] : now[now.length - 1]
    for (const k of now) if (k !== keep) state[k] = false
    openWindows = new Set([keep])
  } else openWindows = new Set(now)
}

export function notify() {
  exclusiveWindows()
  state.backpack = state.bag.length
  for (const fn of listeners) fn(state)
}

// One-line pop-up message (hud.js registers the toast).
let toastFn = () => {}
export const setToast = (fn) => (toastFn = fn)
export const toast = (text) => toastFn(text)

// Blower power: the single source of truth for how fast air clears a pile. Anything that
// should make blowing stronger (better blower, training, rebirths, boosts) multiplies in here.
export function blowerPower() {
  return totalPower()
}

// Trained power plus the equipped vacuum (VACUUMS in config.js); this is what the HUD shows.
// The equipped aura multiplies it (AURAS in config.js).
export const totalPower = () => (state.power + (VAC_POWER[state.vacuum] ?? 0)) * (AURA_BOOST[state.aura] ?? 1) * boostMultiplier('power')

// Rebirth boosts (rebirth.js): trained-power gain and sell payouts grow with every rebirth.
// `n` defaults to the player's own count; pass n + 1 to preview the next one.
export const powerGainMultiplier = (n = state.rebirths) => 1 + n * REBIRTH.powerPer
export const cashMultiplier = (n = state.rebirths) => 1 + n * REBIRTH.cashPer

// Treasure Index bonus (index.js): +INDEX.boost per INDEX.step discovered items, multiplies trained-power gain.
export const indexBonus = () => 1 + Math.floor(state.discovered.length / INDEX.step) * INDEX.boost

// Training: every blow tick (held click, hub or field) adds POWER_GAIN.perTick (x the rebirth
// boost) to the trained power and POWER_GAIN.perTick to the level bar; passing xpNext raises the
// level (+25 xp needed per level, as in the Chop Trees reference game); hud.js shows the banner.
// POWER_GAIN.interval is a real cooldown: releasing and re-clicking doesn't skip the wait.
let lastGain = -Infinity // ms timestamp of the last gain, so the first click gains at once
export function trainPower(dt, mult = 1) {
  const now = performance.now()
  if (now - lastGain < POWER_GAIN.interval * 1000) return
  lastGain = now
  const gained = Math.round(POWER_GAIN.perTick * powerGainMultiplier() * indexBonus() * mult * 10) / 10
  state.power = Math.round((state.power + gained) * 10) / 10
  state.xp += POWER_GAIN.perTick * mult
  while (state.xp >= state.xpNext) {
    state.xp -= state.xpNext
    state.level += 1
    state.xpNext = LEVEL.xpPerLevel * state.level
  }
  notify()
  for (const fn of gainListeners) fn(gained)
}
// fn(power, xp) after every training tick (hud.js floats the "+N Power" popup).
const gainListeners = new Set()
export function onPowerGain(fn) {
  gainListeners.add(fn)
  return () => gainListeners.delete(fn)
}
export const resetTrainTimer = () => {} // cooldown persists across releases

// Upgrades: how far the airflow reaches (scales the cone's length and mouth, so its area grows)
// and how fast it wears piles down, on top of blowerPower().
// bonus(id) = level x step of that upgrade.
const STEP = Object.fromEntries(UPGRADES.map((u) => [u.id, u.step]))
export const upgradeBonus = (id) => state.upgrades[id] * STEP[id]
export const reachMultiplier = () => 1 + upgradeBonus('range')
export const clearSpeedMultiplier = () => 1 + upgradeBonus('agility')

// 1000 -> 1K, 70000000 -> 70M
export function shortMoney(n) {
  const units = ['', 'K', 'M', 'B', 'T', 'Qd']
  let i = 0
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000
    i++
  }
  return `${+n.toFixed(n < 100 ? 1 : 0)}${units[i]}`
}
