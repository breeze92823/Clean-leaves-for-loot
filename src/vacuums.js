// The Vacuums stand: press E next to it to open the window (hud.js renders it from
// state.vacuumsOpen); walking away closes it. Buying with cash adds the blower to
// state.vacuumOwned; Equip picks which one's power counts (state.totalPower).
import { player } from './player.js'
import { offer } from './interact.js'
import { notify, shortMoney, state, toast } from './state.js'
import { TWIN_STAND, VACUUMS, VACUUM_STAND } from './config.js'

import { createTurbineSound } from './turbineSound.js'

const turbineSound = createTurbineSound()
const TWIN_HEAR = 4 // m from the Twin Turbine showcase where its roar starts (full volume at 1.5 m)
const TWIN_REACH = 4.5 // m from the Twin Turbine showcase to be offered it
const OPEN = 5.5 // m from the stand to be offered the window
const CLOSE = 9 // m past which an open window shuts

export function openVacuums() {
  state.vacuumsOpen = true
  document.exitPointerLock?.() // the cursor is needed for the window's buttons
  notify()
}
export function closeVacuums() {
  if (!state.vacuumsOpen) return
  state.vacuumsOpen = false
  notify()
}

// Buys it if not owned yet, then equips it.
export function pickVacuum(id) {
  const v = VACUUMS.find((x) => x.id === id)
  if (!v || state.vacuum === id) return
  if (!state.vacuumOwned.includes(id)) {
    if (v.unlockLevel && state.level < v.unlockLevel) return toast(`Unlocks at Level ${v.unlockLevel}!`)
    if (state.cash < v.cost) return toast('Not enough cash!')
    state.cash -= v.cost
    state.vacuumOwned.push(id)
  }
  state.vacuum = id
  toast(`${v.name} equipped!`)
  notify()
}

export function updateVacuums() {
  const d = Math.hypot(player.position.x - VACUUM_STAND.x, player.position.z - VACUUM_STAND.z)
  if (state.vacuumsOpen) {
    if (d > CLOSE) closeVacuums()
  } else if (d < OPEN) offer('Vacuums', openVacuums, d)

  // The Twin Turbine showcase sells straight from its label: E buys (if affordable) and equips.
  const dt = Math.hypot(player.position.x - TWIN_STAND.x, player.position.z - TWIN_STAND.z)
  turbineSound.set(Math.min(1, Math.max(0, (TWIN_HEAR - dt) / (TWIN_HEAR - 1.5))))
  if (dt < TWIN_REACH) {
    const v = VACUUMS.find((x) => x.id === 'twin')
    const owned = state.vacuumOwned.includes('twin')
    if (state.vacuum === 'twin') return
    const locked = !owned && state.level < v.unlockLevel
    offer(locked ? `${v.name} - Unlocks at Level ${v.unlockLevel}` : owned ? `Equip ${v.name}` : `Buy ${v.name} - $${shortMoney(v.cost)}`, () => pickVacuum('twin'), dt)
  }
}
