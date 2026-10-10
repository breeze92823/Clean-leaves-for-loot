// Rebirth (the HUD's Rebirth tile opens its window from state.rebirthOpen): once the player reaches
// rebirthLevel() they may reset level, xp and trained power for permanent boosts (the multipliers
// live in state.js). Cash, vacuums, auras and upgrades are kept. Tunables: REBIRTH in config.js.
import { HUD_START, REBIRTH } from './config.js'
import { notify, state, toast } from './state.js'

// Level needed for the next rebirth: 25, 50, 100, 200, ...
export const rebirthLevel = (n = state.rebirths) => Math.round(REBIRTH.level * REBIRTH.levelGrowth ** n)

// 0..1 toward the next rebirth (the HUD tile's % badge and the window's bar).
export const rebirthProgress = () => Math.min(1, state.level / rebirthLevel())

export function openRebirth() {
  state.rebirthOpen = true
  document.exitPointerLock?.() // the cursor is needed for the window's buttons
  notify()
}
export function closeRebirth() {
  if (!state.rebirthOpen) return
  state.rebirthOpen = false
  notify()
}

export function tryRebirth() {
  const need = rebirthLevel()
  if (state.level < need) return toast(`Reach Level ${need} to rebirth!`)
  state.rebirths += 1
  state.level = HUD_START.level
  state.xp = HUD_START.xp
  state.xpNext = HUD_START.xpNext
  state.power = HUD_START.power
  toast(`Rebirthed! x${state.rebirths} total`)
  notify()
}
