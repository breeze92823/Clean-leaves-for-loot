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

// Decal painted over the plaza floor: cobbled roads linking the stands, a round
// medallion at the centre. Canvas covers world x -36..28, z -28..28 at 32 px/m
// (canvas top = -z), transparent outside the roads.
export const PLAZA_DECAL = { minX: -36, maxX: 28, minZ: -28, maxZ: 28, ppm: 32 }
export function plazaPathTexture() {
  return cached('plazaPaths', () => {
    const { minX, maxX, minZ, maxZ, ppm } = PLAZA_DECAL
    const c = canvas((maxX - minX) * ppm, (maxZ - minZ) * ppm)
    const g = c.getContext('2d')
    const X = (x) => (x - minX) * ppm
    const Z = (z) => (z - minZ) * ppm
    // [x0, z0, x1, z1] road rectangles (metres) and [x, z, r] discs.
    const roads = [
      [-36, -2.5, 20, 2.5], // main road from the field opening east
      [-8.5, -17, -3.5, 0], // Sell Loot
      [-19.5, -20, -14.5, 0], // portal
      [17.5, -14, 22.5, 0], // Auras
      [-1.5, -5, 1.5, 16], // south toward the mounds / stands
      [2, 8, 18, 11.5], // along the south stands
      [-9, 13.5, 27, 16.5], // in front of the Training Zone
      [-19, 2, -14, 24], // Twin Turbine
    ]
    const discs = [[0, 0, 9], [-6, -16.5, 4.5], [-17, -19, 5], [20, -13, 4.5], [-16.5, 24, 4.5]]
    const shapes = (grow) => {
      const p = new Path2D()
      for (const [x0, z0, x1, z1] of roads) p.rect(X(x0 - grow), Z(z0 - grow), (x1 - x0 + 2 * grow) * ppm, (z1 - z0 + 2 * grow) * ppm)
      for (const [x, z, r] of discs) {
        p.moveTo(X(x + r + grow), Z(z))
        p.arc(X(x), Z(z), (r + grow) * ppm, 0, Math.PI * 2)
      }
      return p
    }
    // curb, then cobbles clipped inside it
    g.fillStyle = '#8f7a4e'
    g.fill(shapes(0.45))
    g.fillStyle = '#d9c28a'
    g.fill(shapes(0.2))
    g.save()
    g.clip(shapes(0))
    const cols = ['#f4e6bd', '#ecdcae', '#f8edcc', '#e6d4a2']
    const br = ppm // 1 m bricks
    let s = 7
    const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    for (let y = 0; y < c.height; y += br * 0.5) {
      const off = (Math.round(y / (br * 0.5)) % 2) * br * 0.5
      for (let x = -br; x < c.width; x += br) {
        const bx = x + off
        g.fillStyle = cols[Math.floor(rand() * cols.length)]
        g.fillRect(bx, y, br, br * 0.5)
        g.strokeStyle = 'rgba(120,95,50,0.35)'
        g.lineWidth = 2
        g.strokeRect(bx + 1, y + 1, br - 2, br * 0.5 - 2)
        g.fillStyle = 'rgba(255,255,255,0.35)'
        g.fillRect(bx + 2, y + 2, br - 4, 3)
      }
    }
    // medallion: rings and an eight-point leaf star
    const cx = X(0), cz = Z(0)
    for (const [r, col] of [[6.2, '#5a3fd0'], [5.5, '#ffffff'], [4.8, '#2f9cff'], [4.1, '#bfe6ff']]) {
      g.fillStyle = col
      g.beginPath()
      g.arc(cx, cz, r * ppm, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = '#ff4fc8'
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4
      g.beginPath()
      g.moveTo(cx + Math.cos(a - 0.28) * 0.8 * ppm, cz + Math.sin(a - 0.28) * 0.8 * ppm)
      g.lineTo(cx + Math.cos(a) * 3.8 * ppm, cz + Math.sin(a) * 3.8 * ppm)
      g.lineTo(cx + Math.cos(a + 0.28) * 0.8 * ppm, cz + Math.sin(a + 0.28) * 0.8 * ppm)
      g.fill()
    }
    g.fillStyle = '#ffd23a'
    g.beginPath()
    g.arc(cx, cz, 1.1 * ppm, 0, Math.PI * 2)
    g.fill()
    g.restore()
    return toTexture(c)
  })
}
