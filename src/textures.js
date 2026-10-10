// Canvas-painted textures for the hub: studded checker bricks, blocky drips,
// stripes, wood. Each painter is cached by its arguments.
import { CanvasTexture, ClampToEdgeWrapping, NearestFilter, RepeatWrapping, SRGBColorSpace } from 'three'

const cache = new Map()
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)
}

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function toTexture(c, { repeat = true, pixel = false } = {}) {
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping
  if (pixel) t.magFilter = NearestFilter
  return t
}

// Mix a hex colour toward white (amt > 0) or black (amt < 0).
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)),
  )
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`
}

// One stud: an embossed ring like a toy brick seen from above.
function stud(c, x, y, r, base) {
  c.lineWidth = r * 0.28
  c.strokeStyle = shade(base, 0.22)
  c.beginPath()
  c.arc(x, y, r, Math.PI * 0.75, Math.PI * 1.75)
  c.stroke()
  c.strokeStyle = shade(base, -0.16)
  c.beginPath()
  c.arc(x, y, r, Math.PI * 1.75, Math.PI * 2.75)
  c.stroke()
}

// 2x2 checker cells, each with 2x2 studs. One tile = 2 cells per side.
export function studTile(colA, colB, studs = 2) {
  return cached(`stud${colA}${colB}${studs}`, () => {
    const S = 256
    const c = canvas(S, S)
    const g = c.getContext('2d')
    const cell = S / 2
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const col = (i + j) % 2 ? colB : colA
        g.fillStyle = col
        g.fillRect(i * cell, j * cell, cell, cell)
        const step = cell / studs
        for (let a = 0; a < studs; a++) {
          for (let b = 0; b < studs; b++) {
            stud(g, i * cell + step * (a + 0.5), j * cell + step * (b + 0.5), step * 0.24, col)
          }
        }
      }
    }
    return toTexture(c)
  })
}

// Blocky green overhang hanging down a wall face. Transparent below the drips;
// used on a plane with alphaTest. Spans 8 m wide x 4 m tall.
export function dripTexture(colA, colB, seed = 1) {
  return cached(`drip${colA}${colB}${seed}`, () => {
    const W = 512
    const H = 256
    const c = canvas(W, H)
    const g = c.getContext('2d')
    let s = seed * 9301 + 49297
    const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    const col = 32 // px per 0.5 m column
    const rowH = 32
    for (let x = 0; x < W; x += col) {
      // band 1 row tall, plus random drips up to 6 rows; neighbours of tall drips stay tall
      const rows = 1 + Math.floor(rand() * rand() * 7)
      for (let r = 0; r < rows; r++) {
        const check = ((x / col) + r) % 2
        g.fillStyle = check ? colA : colB
        g.fillRect(x, r * rowH, col, rowH)
        stud(g, x + col / 2, r * rowH + rowH / 2, col * 0.24, check ? colA : colB)
      }
    }
    const t = toTexture(c)
    t.wrapT = ClampToEdgeWrapping
    return t
  })
}

// Awning stripes: alternating vertical bands with a sheen along the top.
export function stripeTexture(colA, colB, bands = 8) {
  return cached(`stripe${colA}${colB}${bands}`, () => {
    const c = canvas(256, 32)
    const g = c.getContext('2d')
    const w = 256 / bands
    for (let i = 0; i < bands; i++) {
      g.fillStyle = i % 2 ? colB : colA
      g.fillRect(i * w, 0, w, 32)
      g.fillStyle = 'rgba(255,255,255,0.18)'
      g.fillRect(i * w, 0, w, 6)
    }
    return toTexture(c)
  })
}

// Horizontal planks with stud rows, for stand counters and board frames.
export function plankTexture(col) {
  return cached(`plank${col}`, () => {
    const c = canvas(128, 128)
    const g = c.getContext('2d')
    g.fillStyle = col
    g.fillRect(0, 0, 128, 128)
    for (let y = 0; y < 128; y += 32) {
      g.fillStyle = shade(col, -0.12)
      g.fillRect(0, y + 29, 128, 3)
      g.fillStyle = shade(col, 0.12)
      g.fillRect(0, y, 128, 2)
      for (let x = 16; x < 128; x += 32) stud(g, x, y + 15, 6, col)
    }
    return toTexture(c)
  })
}

// Same stripes as bands along V, for cylinders whose length runs along V.
export function stripeTextureV(colA, colB, bands = 14) {
  return cached(`stripeV${colA}${colB}${bands}`, () => {
    const c = canvas(32, 256)
    const g = c.getContext('2d')
    const h = 256 / bands
    for (let i = 0; i < bands; i++) {
      g.fillStyle = i % 2 ? colB : colA
      g.fillRect(0, i * h, 32, h)
    }
    return toTexture(c)
  })
}
