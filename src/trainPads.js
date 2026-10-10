// Training pads (the Train Strength trees of Chop Trees for Treasure, as leaf piles): standing on a
// mound's slab trains Power x the mound's multiplier with no click, and the pile flutters. A mound
// needs its label's rebirth count (0 = FREE); a locked one toasts once per visit.
import { player } from './player.js'
import { state, toast } from './state.js'

const HALF = 1.8 // half the 3.6 m slab
const SLAB_TOP = 0.18

let pads = []
let noticed = null
export const setPads = (list) => (pads = list)
export const padWithMult = (mult) => pads.find((p) => p.mult === mult) ?? null

// Pad whose slab the player stands on, else null.
export function padAt() {
  const { x, y, z } = player.position
  for (const p of pads) {
    if (Math.abs(x - p.x) > HALF || Math.abs(z - p.z) > HALF) continue
    if (Math.abs(y - (p.top + SLAB_TOP)) < 1.5) return p
  }
  return null
}

export const padUnlocked = (p) => state.rebirths >= p.cost

// Call every frame with the pad underfoot: toasts once per visit to a locked pad.
export function noticePad(p) {
  if (p === noticed) return
  noticed = p
  if (p && !padUnlocked(p)) toast(`Need ${p.cost} rebirth${p.cost === 1 ? '' : 's'} to use this mound!`)
}

// Flutters the pile away from the player.
export function blowPad(p, dt) {
  const dx = p.x - player.position.x
  const dz = p.z - player.position.z
  p.pile.target.blow(1, dx, dz, dt, 1)
}
