// The Sell Loot stand (the Sell Shop window): press E next to it to open the window (hud.js renders it from
// state.sellOpen); walking away closes it. Selling pays the item's value x cashMultiplier().
import { player } from './player.js'
import { offer } from './interact.js'
import { SELL_STAND } from './config.js'
import { sfx } from './settings.js'
import { boostMultiplier, cashMultiplier, notify, state, toast } from './state.js'

const OPEN = 5.5 // m from the stand to be offered the window
const CLOSE = 9 // m past which an open window shuts

const cash = new Audio(`${import.meta.env.BASE_URL}audio/cash.mp3`)
cash.volume = 0.5
const chime = () => {
  try {
    cash.volume = 0.5 * sfx()
    cash.currentTime = 0
    cash.play()?.catch(() => {})
  } catch {}
}

export function openSell() {
  state.sellOpen = true
  document.exitPointerLock?.() // the cursor is needed for the window's buttons
  notify()
}
export function closeSell() {
  if (!state.sellOpen) return
  state.sellOpen = false
  notify()
}

// Bag items grouped by name: [{ name, rarity, count, value }] (value = total $ before multipliers).
export function groupBag(bag) {
  const groups = new Map()
  for (const it of bag) {
    const g = groups.get(it.name) ?? { name: it.name, rarity: it.rarity, count: 0, value: 0 }
    g.count += 1
    g.value += it.value
    groups.set(it.name, g)
  }
  return [...groups.values()]
}

export const bagValue = (bag) => bag.reduce((n, it) => n + it.value, 0)
export const payout = (value) => Math.round(value * cashMultiplier() * boostMultiplier('cash'))

function pay(items) {
  const gain = payout(bagValue(items))
  const sold = new Set(items)
  state.cash += gain
  state.bag = state.bag.filter((it) => !sold.has(it))
  chime()
  notify()
  return gain
}

export const isLocked = (name) => state.sellLocked.includes(name)
export const unlockedBag = () => state.bag.filter((it) => !isLocked(it.name))

export function toggleLock(name) {
  const at = state.sellLocked.indexOf(name)
  if (at >= 0) state.sellLocked.splice(at, 1)
  else state.sellLocked.push(name)
  notify()
}

export function sellItem(name) {
  if (isLocked(name)) return toast(`${name} is locked!`)
  const items = state.bag.filter((it) => it.name === name)
  if (items.length) toast(`Sold for $${pay(items).toLocaleString('en-US')}`)
}

// Sells everything that is not locked.
export function sellAll() {
  const items = unlockedBag()
  if (!items.length) return toast(state.bag.length ? 'Everything is locked!' : 'Nothing to sell!')
  toast(`Sold for $${pay(items).toLocaleString('en-US')}`)
}

export function updateSell() {
  const d = Math.hypot(player.position.x - SELL_STAND.x, player.position.z - SELL_STAND.z)
  if (state.sellOpen) {
    if (d > CLOSE) closeSell()
  } else if (d < OPEN) offer('Sell Loot', openSell, d)
}
