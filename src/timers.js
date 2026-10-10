// Looping countdowns shared by the HUD and the in-world signs. Wall-clock
// based so every display agrees; `startAt` is the value shown on load.
const t0 = performance.now()

export function remaining(period, startAt = period) {
  const elapsed = (performance.now() - t0) / 1000
  return (((startAt - elapsed) % period) + period) % period
}

export function mmss(seconds) {
  const s = Math.ceil(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
