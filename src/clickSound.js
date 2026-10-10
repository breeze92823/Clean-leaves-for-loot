// UI click sound: one delegated listener plays a short tick for any <button> press (HUD windows, login, tutorial).
import { sfx } from './settings.js'

const click = new Audio(`${import.meta.env.BASE_URL}audio/button-click.mp3`)
const hover = new Audio(`${import.meta.env.BASE_URL}audio/button-hover.mp3`)
const canHover = () => matchMedia('(hover: hover)').matches // no hover tick on touch screens

export function installClickSound() {
  let lastBtn = null
  document.addEventListener('mouseover', (e) => {
    const b = e.target.closest?.('button')
    if (b === lastBtn) return
    lastBtn = b
    if (!b || b.disabled || !canHover()) return
    try {
      hover.volume = 0.5 * sfx()
      hover.currentTime = 0
      hover.play()?.catch(() => {})
    } catch {}
  })
  document.addEventListener(
    'click',
    (e) => {
      if (!e.target.closest?.('button') || e.target.closest('button:disabled')) return
      try {
        click.volume = 0.4 * sfx()
        click.currentTime = 0
        click.play()?.catch(() => {})
      } catch {}
    },
    true,
  )
}
