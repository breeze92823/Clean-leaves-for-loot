// The Upgrades stand: press E next to it to open the window (hud.js renders it from
// state.upgradesOpen); walking away closes it. Levels live in state.upgrades; Range and
// Agility are read by the blower (state.js), Capacity and Walk Speed are applied here.
import { player } from './player.js'
import { offer } from './interact.js'
import { notify, state, toast, upgradeBonus } from './state.js'
import { playCash } from './cashSound.js'
import { HUD_START, PHYSICS, UPGRADE_GROWTH, UPGRADE_STAND, UPGRADES } from './config.js'

const OPEN = 5.5 // m from the stand to be offered the window
const CLOSE = 9 // m past which an open window shuts

const BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]))

// Cash price of the next level (Infinity once maxed).
export function upgradeCost(id) {
  const u = BY_ID[id]
  const lv = state.upgrades[id]
  return lv >= u.max ? Infinity : Math.round(u.cost * UPGRADE_GROWTH ** lv)
}

export function openUpgrades() {
  state.upgradesOpen = true
  document.exitPointerLock?.() // the cursor is needed for the window's buttons
  notify()
}
export function closeUpgrades() {
  if (!state.upgradesOpen) return
  state.upgradesOpen = false
  notify()
}

// Re-derives bag size and walk speed from the bought levels (also after net.js loads a save).
export function applyUpgrades() {
  state.backpackMax = HUD_START.backpackMax + upgradeBonus('capacity')
  player.moveSpeed = PHYSICS.moveSpeed + upgradeBonus('walk')
}

export function buyUpgrade(id) {
  const u = BY_ID[id]
  const price = upgradeCost(id)
  if (!u) return
  if (price === Infinity) return toast(`${u.name} is maxed!`)
  if (state.cash < price) return toast('Not enough cash!')
  state.cash -= price
  playCash()
  state.upgrades[id] += 1
  applyUpgrades()
  toast(`${u.name} Lv.${state.upgrades[id]}!`)
  notify()
}

export function updateUpgrades() {
  const d = Math.hypot(player.position.x - UPGRADE_STAND.x, player.position.z - UPGRADE_STAND.z)
  if (state.upgradesOpen) {
    if (d > CLOSE) closeUpgrades()
  } else if (d < OPEN) offer('Upgrades', openUpgrades, d)
}
