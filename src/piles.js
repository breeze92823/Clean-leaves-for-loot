// Leaf piles: the field grid (see leaves.js) tiled into piles, per zone. A pile is the unit
// that drops loot; its hardness grows with its zone's Luck, like a tree's hp in the reference.
import { LEAVES } from './config.js'

const Z = LEAVES.zones
const P = LEAVES.piles
export const ZONE_COUNT = Z.edges.length - 1

// hp of a pile in zone `zi`: clear time ~ hp / blowerPower.
export const zoneHp = (zi) => P.baseHp * Z.luck[zi] ** P.exponent

// Zone of a world x (zone i spans edges[i+1] <= x < edges[i]); matches zoneOf() in the shaders.
export function zoneAt(x) {
  let z = 0
  for (let i = 1; i < ZONE_COUNT; i++) if (x < Z.edges[i]) z++
  return z
}

// Tiles the W x D grid (cell C m, origin X0/Z0, mound factors `noise`) into piles.
// Returns { list, pileOf (cell -> pile id), cellZone (cell -> zone), weight (pile -> sum of noise) }.
export function buildPiles(X0, Z0, W, D, C, noise) {
  const list = []
  const base = []
  const depth = D * C
  for (let zi = 0; zi < ZONE_COUNT; zi++) {
    const width = Z.edges[zi] - Z.edges[zi + 1]
    const nx = Math.max(1, Math.round(width / P.size))
    const nz = Math.max(1, Math.round(depth / P.size))
    base.push({ id: list.length, nx, nz, width })
    for (let k = 0; k < nx * nz; k++) list.push({ id: list.length, zone: zi, x: 0, z: 0, cells: 0, weight: 0 })
  }
  const pileOf = new Int16Array(W * D)
  const cellZone = new Uint8Array(W * D)
  for (let j = 0; j < D; j++) {
    const cz = Z0 + (j + 0.5) * C
    for (let i = 0; i < W; i++) {
      const cx = X0 + (i + 0.5) * C
      const zi = zoneAt(cx)
      const b = base[zi]
      const px = Math.min(b.nx - 1, Math.floor(((Z.edges[zi] - cx) / b.width) * b.nx))
      const pz = Math.min(b.nz - 1, Math.floor(((cz - Z0) / depth) * b.nz))
      const p = list[b.id + px * b.nz + pz]
      const k = j * W + i
      pileOf[k] = p.id
      cellZone[k] = zi
      p.x += cx
      p.z += cz
      p.cells++
      p.weight += noise[k]
    }
  }
  for (const p of list) {
    p.x /= p.cells
    p.z /= p.cells
    p.fullness = p.weight / p.cells // ~0.7 for a normal pile, lower on the flattened hub edge
  }
  return { list, pileOf, cellZone }
}
