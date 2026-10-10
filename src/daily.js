// Daily Login (the HUD's Daily tile opens its window from state.dailyOpen): one reward per UTC day,
// days 1-7 in a row (DAILY in config.js). Which day is up is derived from the saved
// state.dailyDay / dailyClaimedAt and the server-corrected clock (state.js now()), so it survives reloads.
import { DAILY, VACUUMS } from './config.js'
import { net } from './net.js'
import { sfx } from './settings.js'
import { notify, now, state, toast } from './state.js'

const DAY_MS = 86400000
const dayKey = (ms) => Math.floor(ms / DAY_MS)
const winSfx = new Audio(`${import.meta.env.BASE_URL}audio/win-claim.mp3`)
const playWin = () => {
  try {
    winSfx.volume = 0.35 * sfx()
    winSfx.currentTime = 0
    winSfx.play()?.catch(() => {})
  } catch {}
}
const nextDay = (d) => (d >= DAILY.rewards.length ? 1 : d + 1)

// { claimable, next (1-based day up now / tomorrow), claimed (days 1..claimed are done), msLeft (until the next UTC day) }
export function dailyStatus() {
  const t = now()
  const today = dayKey(t)
  const last = state.dailyClaimedAt
  let claimable = true
  let next = 1
  if (last) {
    const lastKey = dayKey(last)
    const streak = lastKey === today - 1 || !DAILY.resetOnMiss
    claimable = lastKey < today
    next = claimable && !streak ? 1 : nextDay(state.dailyDay)
  }
  return { claimable, next, claimed: claimable ? next - 1 : state.dailyDay, msLeft: (today + 1) * DAY_MS - t }
}

export function openDaily() {
  state.dailyOpen = true
  document.exitPointerLock?.() // the cursor is needed for the window's button
  notify()
}
export function closeDaily() {
  if (!state.dailyOpen) return
  state.dailyOpen = false
  notify()
}

export function claimDaily() {
  const { claimable, next } = dailyStatus()
  if (!claimable) return toast('Come back tomorrow for the next reward!')
  if (net.connected && !net.hydrated) return toast('Loading your progress...')
  const r = DAILY.rewards[next - 1]
  const t = now()
  if (r.cash) state.cash += r.cash
  if (r.power) state.power += r.power
  for (const b of r.boosts ?? []) state.boosts[b.kind] = Math.max(t, state.boosts[b.kind] ?? 0) + b.minutes * 60000
  if (r.vacuum) {
    // Free whatever the level; only equipped right away if it is stronger than the current one.
    const v = VACUUMS.find((x) => x.id === r.vacuum)
    if (!state.vacuumOwned.includes(v.id)) state.vacuumOwned.push(v.id)
    if (v.power > (VACUUMS.find((x) => x.id === state.vacuum)?.power ?? 0)) state.vacuum = v.id
  }
  state.dailyDay = next
  state.dailyClaimedAt = t
  playWin()
  toast(`Day ${next} reward claimed!`)
  notify()
}
