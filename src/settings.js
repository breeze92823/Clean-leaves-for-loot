// Player settings (Config window): Sound Effects volume + VFX toggle. Persisted in localStorage
// (every access wrapped: storage can be blocked). Audio code multiplies its volumes by `sfx()`;
// visual effects check `settings.vfx`.
const KEY = 'clean-leaves-settings'

export const settings = { sfx: 100, vfx: true } // sfx: 0..100

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
  if (Number.isFinite(saved.sfx)) settings.sfx = Math.min(100, Math.max(0, Math.round(saved.sfx)))
  if (typeof saved.vfx === 'boolean') settings.vfx = saved.vfx
} catch {}

const listeners = new Set()
export const subscribeSettings = (fn) => (listeners.add(fn), () => listeners.delete(fn))

export function setSettings(patch) {
  Object.assign(settings, patch)
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {}
  listeners.forEach((fn) => fn(settings))
}

// 0..1 multiplier for every sound effect.
export const sfx = () => settings.sfx / 100
