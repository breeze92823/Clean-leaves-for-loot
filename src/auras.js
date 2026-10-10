// The Auras stand: press E next to it to open the window (hud.js renders it from
// state.aurasOpen); walking away closes it. An aura is claimed/bought once, then equipped;
// the equipped one multiplies the blower power (state.totalPower).
import { player } from './player.js'
import { offer } from './interact.js'
import { notify, state, toast } from './state.js'
import { playCash } from './cashSound.js'
import { AURAS, AURA_STAND } from './config.js'

const OPEN = 5.5 // m from the stand to be offered the window
const CLOSE = 9 // m past which an open window shuts

export function openAuras() {
  state.aurasOpen = true
  document.exitPointerLock?.() // the cursor is needed for the window's buttons
  notify()
}
export function closeAuras() {
  if (!state.aurasOpen) return
  state.aurasOpen = false
  notify()
}

// Not owned: buys/claims it (the button then reads "Equip"). Owned: equips it.
export function pickAura(id) {
  const a = AURAS.find((x) => x.id === id)
  if (!a || state.aura === id) return
  if (!state.auraOwned.includes(id)) {
    if (state.cash < a.cost) return toast('Not enough cash!')
    state.cash -= a.cost
    playCash()
    state.auraOwned.push(id)
    toast(`${a.name} unlocked! Press Equip.`)
    return notify()
  }
  state.aura = id
  toast(`${a.name} equipped!`)
  notify()
}

export function updateAuras() {
  const d = Math.hypot(player.position.x - AURA_STAND.x, player.position.z - AURA_STAND.z)
  if (state.aurasOpen) {
    if (d > CLOSE) closeAuras()
  } else if (d < OPEN) offer('Auras', openAuras, d)
}
