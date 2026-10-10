// Loot under the leaf piles. When a pile is blown away it may reveal items (loot.spawnFor),
// following the reference game's rules:
//   x1 Luck zone: a fixed spread of PLAN piles drop one item (a few Uncommon, the rest Common).
//   higher zones: the chance a pile drops, the items per pile and each item's rarity all rise
//   with the zone (LUCK_LOOT); the last zone always rolls the top tier.
// An item floats where the pile stood; E puts it in the Bag (state.backpackMax). The field
// regrowing (reset) takes away anything left lying.
import { AdditiveBlending, CanvasTexture, Group, Sprite, SpriteMaterial } from 'three'
import { ITEM_INFO, LOOT_PICKUP_RANGE, LUCK_LOOT, RARITIES, RARITY, X1_DROPS } from './data/loot.js'
import { textLabel } from './labels.js'
import { offer } from './interact.js'
import { discoverItem } from './index.js'
import { player } from './player.js'
import { state, notify, toast } from './state.js'
import { ZONE_COUNT } from './piles.js'
import { buildModel } from './r3f.js'
import { GenericItem, MODELS } from './lootModels.jsx'

const POOLS = {}
for (const [name, { rarity }] of Object.entries(ITEM_INFO)) (POOLS[rarity] ??= []).push(name)
// Rarity tiers that actually have items (Secret has none), lowest to highest.
const TIERS = RARITIES.filter((r) => POOLS[r]?.length)
const LAST_ZONE = ZONE_COUNT - 1
const FLOAT_Y = 1.1
const MODEL_SCALE = 1.5 // the models are ~1 m across and rest on y = 0

function seededRandom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// White starburst (soft core + thin rays), tinted per rarity through the material colour.
function starburstTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  g.translate(128, 128)
  const core = g.createRadialGradient(0, 0, 0, 0, 0, 128)
  core.addColorStop(0, 'rgba(255,255,255,0.95)')
  core.addColorStop(0.25, 'rgba(255,255,255,0.45)')
  core.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = core
  g.fillRect(-128, -128, 256, 256)
  const rays = 14
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + (i % 2) * 0.1
    const len = 128 - (i % 2 ? 22 : 4)
    const grad = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len)
    grad.addColorStop(0, 'rgba(255,255,255,0.85)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.save()
    g.rotate(a)
    g.beginPath()
    g.moveTo(0, -3)
    g.lineTo(len, 0)
    g.lineTo(0, 3)
    g.closePath()
    g.fill()
    g.restore()
  }
  return new CanvasTexture(c)
}

const short = (n) => {
  const units = ['', 'K', 'M', 'B', 'T']
  let i = 0
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000
    i++
  }
  return `${i ? +n.toFixed(n < 100 ? 1 : 0) : n}${units[i]}`
}

export function createLoot(scene, piles) {
  const root = new Group()
  scene.add(root)
  const burst = starburstTexture()
  const drops = []
  let nextId = 1

  // --- Which piles drop what -------------------------------------------------
  const dropChance = (zone) => {
    const share = X1_DROPS.piles / piles.filter((p) => p.zone === 0).length
    return Math.min(1, share + (1 - share) * (zone / LUCK_LOOT.fullAt))
  }
  const dropCount = (zone) => 1 + Math.floor(((LUCK_LOOT.maxItems - 1) * zone) / LAST_ZONE)
  function rollTier(zone) {
    const pos = (zone / LAST_ZONE) * (TIERS.length - 1)
    let k = Math.floor(pos)
    if (Math.random() < pos - k) k++
    if (Math.random() < LUCK_LOOT.bonus) k++
    return TIERS[Math.min(k, TIERS.length - 1)]
  }
  // pile id -> 'Common' | 'Uncommon' for the x1 zone's loot piles: one pile from each of
  // `count` equal slices of the zone, so they spread over the whole zone instead of clumping.
  const plan = (() => {
    const zone0 = piles.filter((p) => p.zone === 0 && p.fullness > 0.3) // not the flattened hub edge
    const count = Math.min(X1_DROPS.piles, zone0.length)
    const rand = seededRandom(5)
    const picked = Array.from({ length: count }, (_, k) => {
      const lo = Math.floor((k * zone0.length) / count)
      const hi = Math.floor(((k + 1) * zone0.length) / count)
      return zone0[lo + Math.floor(rand() * (hi - lo))]
    })
    const uncommonAt = new Set(Array.from({ length: X1_DROPS.uncommon }, (_, u) => Math.floor(((u + 0.5) * count) / X1_DROPS.uncommon)))
    return new Map(picked.map((p, k) => [p.id, uncommonAt.has(k) ? 'Uncommon' : 'Common']))
  })()

  // Planned x1 loot piles already blown away (the tutorial points at the ones still to do).
  // Uncommon piles come first (worth ~10x a Common), nearest first, so a new player needs fewer sell trips.
  const spent = new Set()
  function hintPile(x, z) {
    let best = null
    let bestScore = Infinity
    for (const [id, rarity] of plan) {
      if (spent.has(id)) continue
      const p = piles[id]
      const score = (p.x - x) ** 2 + (p.z - z) ** 2 + (rarity === 'Uncommon' ? 0 : 1e9)
      if (score < bestScore) {
        bestScore = score
        best = p
      }
    }
    return best
  }

  // --- Drops -----------------------------------------------------------------
  function addDrop(rarity, x, z) {
    const pool = POOLS[rarity]
    const name = pool[Math.floor(Math.random() * pool.length)]
    const value = ITEM_INFO[name].value
    const { fill, glow } = RARITY[rarity]
    const group = new Group()
    group.position.set(x, 0.1, z)
    group.scale.setScalar(0.001)

    const halo = new Sprite(new SpriteMaterial({ map: burst, color: glow, transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false, toneMapped: false }))
    halo.scale.set(3.4, 3.4, 1)
    halo.position.y = FLOAT_Y + 0.2
    halo.renderOrder = 2

    // The item's own 3D model, spinning on a bobbing pivot.
    const model = buildModel(MODELS[name] ?? GenericItem)
    const icon = new Group()
    model.object.scale.setScalar(MODEL_SCALE)
    model.object.position.y = -0.5 * MODEL_SCALE
    icon.add(model.object)

    const label = textLabel(
      [
        { text: `$${short(value)}`, px: 56, fill: '#7dff8a' },
        { text: name, px: 64, fill: '#ffffff' },
        { text: rarity, px: 46, fill },
      ],
      { height: 1.3 },
    )
    label.object.position.y = FLOAT_Y + 2.6
    label.object.renderOrder = 3

    group.add(halo, icon, label.object)
    root.add(group)
    drops.push({ id: nextId++, name, rarity, value, x, z, group, icon, model, halo, label, born: null })
  }

  function spawnFor(pile) {
    spent.add(pile.id)
    if (pile.zone === 0) {
      const rarity = plan.get(pile.id)
      if (rarity) addDrop(rarity, pile.x, pile.z)
    } else if (Math.random() < dropChance(pile.zone)) {
      // Several items fan out in a small ring round the middle (all within pickup range).
      const n = dropCount(pile.zone)
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + Math.PI / 4
        const r = n > 1 ? 1.6 : 0
        addDrop(rollTier(pile.zone), pile.x + Math.cos(a) * r, pile.z + Math.sin(a) * r)
      }
    }
  }

  function remove(d) {
    root.remove(d.group)
    d.icon.traverse((o) => {
      o.geometry?.dispose()
      if (o.material?.userData.own) o.material.dispose() // shared plastic() materials stay
    })
    d.halo.material.dispose()
    d.label.dispose()
    drops.splice(drops.indexOf(d), 1)
  }

  function collect(d) {
    if (state.bag.length >= state.backpackMax) {
      toast('Bag full! Sell your loot')
      return
    }
    state.bag.push({ name: d.name, rarity: d.rarity, value: d.value })
    remove(d)
    if (!discoverItem(d.name)) toast(`Collected ${d.name}`)
    notify()
  }

  return {
    spawnFor,
    hintPile, // nearest x1 pile that still hides loot: { x, z } or null
    get count() { return drops.length },
    get drops() { return drops },

    // The field regrew: whatever was lying there is gone.
    reset() {
      spent.clear()
      for (const d of [...drops]) remove(d)
    },

    update(dt, t) {
      const px = player.position.x
      const pz = player.position.z
      for (const d of drops) {
        d.born ??= t
        d.group.scale.setScalar(Math.min(1, (t - d.born) * 4)) // pop in
        d.icon.position.y = FLOAT_Y + Math.sin(t * 1.8 + d.id) * 0.18
        d.icon.rotation.y = t * 0.9 + d.id * 1.3
        d.model.tick(dt)
        d.halo.material.opacity = (d.rarity === 'Common' ? 0.5 : 0.75) + Math.sin(t * 2.4 + d.id) * 0.12
        const dist = Math.hypot(px - d.x, pz - d.z)
        if (dist < LOOT_PICKUP_RANGE && Math.abs(player.position.y - 0.1) < 3) offer(`Collect ${d.name}`, () => collect(d), dist)
      }
    },
  }
}
