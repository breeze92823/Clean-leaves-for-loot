// Cash register sound for spending money (buy auras / vacuums / upgrades).
import { sfx } from './settings.js'

const cash = new Audio(`${import.meta.env.BASE_URL}audio/cash.mp3`)

export function playCash() {
  try {
    cash.volume = 0.5 * sfx()
    cash.currentTime = 0
    cash.play()?.catch(() => {})
  } catch {}
}
