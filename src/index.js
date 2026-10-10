// Treasure Index (the HUD's Index tile opens its window from state.indexOpen): every collectable by
// rarity; the ones the player has collected at least once are discovered (state.discovered) and every
// INDEX.step of them adds a power boost (indexBonus in state.js). Tunables: INDEX in config.js.
import { INDEX } from './config.js'
import { notify, state, toast } from './state.js'

export function openIndex() {
  state.indexOpen = true
  document.exitPointerLock?.() // the cursor is needed to scroll the window
  notify()
}
export function closeIndex() {
  if (!state.indexOpen) return
  state.indexOpen = false
  notify()
}

// Progress toward the next boost: { done, step } e.g. 2/10.
export const indexProgress = () => ({ done: state.discovered.length % INDEX.step, step: INDEX.step })

// Called by loot.js whenever an item is collected.
export function discoverItem(name) {
  if (state.discovered.includes(name)) return false
  state.discovered.push(name)
  if (state.discovered.length % INDEX.step !== 0) toast(`New treasure: ${name}!`)
  return true
}
