// The hub's architecture: studded lavender plaza, two terraces of orange
// checkered walls with green overhangs, voxel trees, the canyon field to the
// west and clouds. Props (stands, boards, portal...) are in props.js.
import {
  BoxGeometry,
  CanvasTexture,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { addCollider } from './colliders.js'
import { HUB, HUB_COLORS as C } from './config.js'
import { dripTexture, studTile, plazaPathTexture, PLAZA_DECAL as PD } from './textures.js'

const STUD_TILE_M = 4 // one studTile covers 4 m (2 m checker cells)
const DRIP_W = 8 // drip texture covers 8 m wide x 4 m tall
const DRIP_H = 4

const matCache = new Map()
export function studMat(a, b, studs = 2) {
  const key = `${a}${b}${studs}`
  if (!matCache.has(key)) matCache.set(key, new MeshStandardMaterial({ map: studTile(a, b, studs), roughness: 0.85 }))
  return matCache.get(key)
}

// BoxGeometry with UVs in world metres / tile, so a shared repeating texture
// keeps the same stud size on every box. Face order: +x -x +y -y +z -z.
export function worldBox(w, h, d, tile = STUD_TILE_M) {
  const g = new BoxGeometry(w, h, d)
  const uv = g.attributes.uv
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile)
    }
  }
  return g
}

export function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = shadow
  m.receiveShadow = true
  return m
}

const dripMats = new Map()
function dripMat(seed) {
  if (!dripMats.has(seed)) {
    dripMats.set(seed, new MeshStandardMaterial({ map: dripTexture(C.topA, C.topB, seed), alphaTest: 0.5, roughness: 0.85 }))
  }
  return dripMats.get(seed)
}

// A solid terrace block from the ground to `h`, with a green overhang slab on
// top and blocky green drips down each face.
function block(parent, x0, x1, z0, z1, h, { seed = 1, wall = [C.wallA, C.wallB], collide = true } = {}) {
  const w = x1 - x0
  const d = z1 - z0
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  parent.add(mesh(worldBox(w, h, d), studMat(...wall), cx, h / 2, cz))
  parent.add(mesh(worldBox(w + 0.6, 0.8, d + 0.6), studMat(C.topA, C.topB), cx, h - 0.3, cz))
  if (collide) addCollider(cx, cz, w, d, h)

  // Drips on the four faces, just proud of the wall.
  const faces = [
    [w, cx, cz + d / 2 + 0.05, 0],
    [w, cx, cz - d / 2 - 0.05, Math.PI],
    [d, cx + w / 2 + 0.05, cz, Math.PI / 2],
    [d, cx - w / 2 - 0.05, cz, -Math.PI / 2],
  ]
  faces.forEach(([len, px, pz, rot], i) => {
    const g = new PlaneGeometry(len, DRIP_H)
    const uv = g.attributes.uv
    for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) * len) / DRIP_W)
    const m = mesh(g, dripMat(seed + i), px, h - 0.7 - DRIP_H / 2, pz, false)
    m.rotation.y = rot
    parent.add(m)
  })
}

// --- Trees ------------------------------------------------------------------
// Four species (oak, pine, maple, birch), two shape variants each. Every variant is
// built once with its boxes merged per material, then planted as InstancedMeshes, so
// a detailed tree costs a few draw calls however many are planted.
const rng = (seed) => {
  let a = (seed * 2654435761) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const barkMat = () => studMat(C.trunk, '#a34a24', 1)
const palettes = {
  oak: [studMat('#3ec43a', '#33b22f'), studMat('#58d94a', '#46c63d')],
  pine: [studMat('#1f7a3a', '#196a31'), studMat('#2a9448', '#238040')],
  maple: [studMat('#e8721c', '#d4620f'), studMat('#c93a1a', '#b32f12'), studMat('#f2a516', '#e0950c')],
  birch: [studMat('#f2c53a', '#e0b22a'), studMat('#d9e046', '#c6cd38')],
}
const birchBark = () => studMat('#ece8e0', '#d8d2c6', 1)
const darkBark = () => studMat('#3a3430', '#2c2623', 1)

// Collects boxes by material (transform baked in), then merges each group.
function builder() {
  const groups = new Map()
  const q = new Quaternion()
  const e = new Euler()
  return {
    box(mat, w, h, d, x, y, z, ry = 0, rz = 0, rx = 0) {
      const g = worldBox(w, h, d)
      g.applyMatrix4(new Matrix4().compose(new Vector3(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), new Vector3(1, 1, 1)))
      if (!groups.has(mat)) groups.set(mat, [])
      groups.get(mat).push(g)
    },
    parts: () => [...groups].map(([mat, gs]) => ({ mat, geo: mergeGeometries(gs) })),
  }
}

// A lumpy ball of canopy blobs, the biggest low and central, smaller ones toward the top.
function canopy(b, r, mats, cx, cy, cz, rx, ry, rz, n) {
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2
    const t = Math.sqrt(r())
    const hy = (r() * 2 - 1) * ry
    const k = Math.sqrt(Math.max(0, 1 - (hy / ry) ** 2))
    const s = 2.6 - (hy / ry + 1) * 0.5 + r() * 1.6
    b.box(mats[(r() * mats.length) | 0], s * (1 + r() * 0.5), s * (0.8 + r() * 0.3), s * (1 + r() * 0.5),
      cx + Math.cos(a) * t * k * rx, cy + hy, cz + Math.sin(a) * t * k * rz, r() * 1.5)
  }
}

function trunk(b, bark, h, w, r, roots = 4) {
  b.box(bark, w * 1.5, 1.0, w * 1.5, 0, 0.5, 0)
  b.box(bark, w, h * 0.55, w, 0, 1 + h * 0.275, 0)
  b.box(bark, w * 0.8, h * 0.5, w * 0.8, 0, 1 + h * 0.55 + h * 0.2, 0)
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * Math.PI * 2 + r()
    b.box(bark, 0.7, 0.8, 1.6, Math.cos(a) * w * 0.9, 0.35, Math.sin(a) * w * 0.9, -a, 0.2)
  }
}

const SPECIES = {
  oak(b, r) {
    const bark = barkMat()
    trunk(b, bark, 7 + r() * 1.5, 1.9, r)
    for (let i = 0; i < 3; i++) {
      const a = r() * Math.PI * 2
      b.box(bark, 3.4, 0.9, 0.9, Math.cos(a) * 1.6, 6 + i * 0.6, Math.sin(a) * 1.6, -a, 0.5)
    }
    canopy(b, r, palettes.oak, 0, 10, 0, 5.2, 3.4, 5.2, 16)
    canopy(b, r, palettes.oak, 0, 7.6, 0, 6.2, 1, 6.2, 5)
  },
  maple(b, r) {
    const bark = barkMat()
    trunk(b, bark, 6 + r(), 2.1, r)
    b.box(bark, 3.4, 0.9, 1, 1.6, 6.4, 0, 0, 0.6)
    b.box(bark, 3.4, 0.9, 1, -1.6, 6.8, 0, 0, -0.6)
    canopy(b, r, palettes.maple, 0, 9.6, 0, 6.2, 3.2, 6.2, 18)
    canopy(b, r, palettes.maple, 0, 7.2, 0, 6.8, 1, 6.8, 5)
  },
  pine(b, r) {
    const bark = barkMat()
    const g = palettes.pine
    b.box(bark, 1.4, 11, 1.4, 0, 5.5, 0)
    b.box(bark, 2.2, 0.8, 2.2, 0, 0.4, 0)
    const tiers = 6 + ((r() * 2) | 0)
    for (let i = 0; i < tiers; i++) {
      const w = 11.5 - i * (10 / tiers)
      const y = 3.2 + i * 1.9
      b.box(g[i % 2], w, 1.5, w, 0, y, 0, i * 0.4)
      b.box(g[(i + 1) % 2], w * 0.62, 1.2, w * 0.62, 0, y + 1.1, 0, i * 0.4 + 0.5)
    }
    b.box(g[1], 1.2, 2.6, 1.2, 0, 3.2 + tiers * 1.9, 0)
  },
  birch(b, r) {
    const bark = birchBark()
    const dark = darkBark()
    b.box(bark, 1.3, 11, 1.3, 0, 5.5, 0)
    b.box(bark, 2, 0.8, 2, 0, 0.4, 0)
    for (let i = 0; i < 6; i++) {
      const f = r() < 0.5 ? 1 : -1
      b.box(dark, 1.36, 0.35, 0.5, 0, 1.5 + i * 1.6, f * 0.4)
    }
    b.box(bark, 3, 0.7, 0.7, 1.4, 8.2, 0, 0, 0.7)
    canopy(b, r, palettes.birch, 0, 11.5, 0, 3.8, 3.8, 3.8, 14)
  },
}
const KINDS = ['oak', 'pine', 'maple', 'birch']
const variants = new Map() // 'kind0' -> merged parts (built lazily)
const plantings = new Map() // variant key -> [Matrix4]

function variantParts(kind, v) {
  const key = kind + v
  if (!variants.has(key)) {
    const b = builder()
    SPECIES[kind](b, rng(KINDS.indexOf(kind) * 7 + v * 31 + 5))
    variants.set(key, b.parts())
  }
  return variants.get(key)
}

// Queue a tree; seed picks the species and shape variant, and a yaw.
function tree(parent, x, y, z, s = 1, seed = 0, kind = KINDS[seed % KINDS.length]) {
  const key = kind + ((seed >> 2) & 1)
  if (!plantings.has(key)) plantings.set(key, [])
  const m = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), seed * 1.7), new Vector3(s, s, s))
  plantings.get(key).push(m)
}

function flushTrees(parent) {
  for (const [key, mats] of plantings) {
    const kind = key.slice(0, -1)
    for (const { mat, geo } of variantParts(kind, +key.slice(-1))) {
      const im = new InstancedMesh(geo, mat, mats.length)
      mats.forEach((m, i) => im.setMatrixAt(i, m))
      im.castShadow = true
      im.receiveShadow = true
      parent.add(im)
    }
  }
  plantings.clear()
}

function stoneCluster(parent, x, y, z, seed) {
  const mat = studMat(C.stone, '#bdb2d8')
  const r = (k) => Math.sin(seed * 7.13 + k * 3.7) * 0.5 + 0.5
  for (let i = 0; i < 5; i++) {
    const s = 2 + r(i) * 2.5
    parent.add(mesh(worldBox(s, s * (0.8 + r(i + 9)), s), mat, x + (r(i + 1) - 0.5) * 5, y + s * 0.4 + r(i + 4) * 2, z + (r(i + 2) - 0.5) * 5))
  }
}

function cloudSprite() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')
  const puffs = [[70, 80, 40], [120, 64, 52], [175, 78, 40], [100, 92, 34], [150, 94, 34], [205, 94, 26], [45, 96, 24]]
  for (const [x, y, r] of puffs) {
    const grad = g.createRadialGradient(x, y - r * 0.3, r * 0.2, x, y, r)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(0.8, '#f4f8ff')
    grad.addColorStop(1, 'rgba(225,236,250,0)')
    g.fillStyle = grad
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

export function buildHub(scene) {
  const root = new Group()
  scene.add(root)
  const H = HUB.half
  const iw = HUB.innerWall
  const ow = HUB.outerWall
  const F = HUB.fieldHalfWidth
  const I = H + iw.depth // inner terrace outer edge
  const O = I + ow.depth // outer terrace outer edge

  // Plaza floor, running out through the west opening.
  const floorW = H + I
  const fg = new PlaneGeometry(floorW, 2 * H)
  const fuv = fg.attributes.uv
  for (let k = 0; k < fuv.count; k++) fuv.setXY(k, (fuv.getX(k) * floorW) / STUD_TILE_M, (fuv.getY(k) * 2 * H) / STUD_TILE_M)
  const floor = mesh(fg, studMat(C.floorA, C.floorB), (H - I) / 2, 0.02, 0, false)
  floor.rotation.x = -Math.PI / 2
  root.add(floor)

  // Cobbled roads + medallion decal over the floor.
  const roadMat = new MeshStandardMaterial({ map: plazaPathTexture(), roughness: 0.9, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false })
  const road = mesh(new PlaneGeometry(PD.maxX - PD.minX, PD.maxZ - PD.minZ), roadMat, (PD.maxX + PD.minX) / 2, 0.04, 0, false)
  road.rotation.x = -Math.PI / 2
  root.add(road)

  // Inner terrace (three sides + the two west stubs either side of the opening).
  block(root, -I, I, -I, -H, iw.height, { seed: 1 })
  block(root, -I, I, H, I, iw.height, { seed: 5 })
  block(root, H, I, -H, H, iw.height, { seed: 9 })
  block(root, -I, -H, -H, HUB.opening.minZ, iw.height, { seed: 13 })
  block(root, -I, -H, HUB.opening.maxZ, H, iw.height, { seed: 17 })
  // Outer terrace.
  block(root, -O, O, -O, -I, ow.height, { seed: 21, collide: false })
  block(root, -O, O, I, O, ow.height, { seed: 25, collide: false })
  block(root, I, O, -I, I, ow.height, { seed: 29, collide: false })

  // Canyon walls either side of the field, the far end wall, and the vine bridge.
  const end = HUB.fieldEnd
  block(root, end, -I, -O, -F, 13, { seed: 33 })
  block(root, end, -I, F, O, 13, { seed: 37 })
  block(root, end - 20, -I - 8, -O - 16, -F - 10, 24, { seed: 41, collide: false })
  block(root, end - 20, -I - 8, F + 10, O + 16, 24, { seed: 45, collide: false })
  block(root, end - 16, end, -F, F, 26, { seed: 49 })

  const bridgeX = end + 18
  const stone = studMat(C.stone, '#bdb2d8')
  root.add(mesh(worldBox(6, 2.2, 2 * F + 4), stone, bridgeX, 15, 0))
  const vine = studMat(C.topA, C.topB, 1)
  for (let z = -F + 1; z < F; z += 1.4) {
    const len = 2 + Math.abs(Math.sin(z * 1.7)) * 5
    root.add(mesh(worldBox(0.5, len, 0.5), vine, bridgeX + 2.6, 14 - len / 2, z, false))
  }

  // Terrace-top dressing.
  const trees = [
    [-30, -44], [-6, -42], [16, -45], [38, -42], [44, -20], [43, 6], [42, 28],
    [-22, 44], [4, 43], [28, 44], [-46, -42], [-46, 42],
  ]
  trees.forEach(([x, z], i) => tree(root, x, ow.height, z, 1, i + 1))
  // Big trees along both cliff edges of the corridor, canopies leaning over the canyon.
  const edge = F + 5
  for (let x = -52, i = 0; x > end + 14; x -= 24, i++) {
    tree(root, x, 13, -(edge + (i % 3)), 1.9 + (i % 2) * 0.4, i * 5 + 40)
    tree(root, x - 12, 13, edge + ((i + 1) % 3), 1.9 + ((i + 1) % 2) * 0.4, i * 5 + 83)
  }
  tree(root, 20, iw.height, -32, 0.55, 30)
  tree(root, 32, iw.height, 14, 0.55, 31)
  stoneCluster(root, -33, iw.height, -18, 1)
  stoneCluster(root, -33, iw.height, 19, 2)
  stoneCluster(root, -48, 13, -27, 3)
  stoneCluster(root, -48, 13, 27, 4)

  flushTrees(root)

  // The field's leaf piles and loose leaves live in leaves.js.

  // Clouds on the sky dome.
  const cloudMat = new SpriteMaterial({ map: cloudSprite(), fog: false, depthWrite: false, transparent: true })
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.sin(i * 3.1) * 0.2
    const s = new Sprite(cloudMat)
    const r = 190 + Math.sin(i * 1.7) * 30
    s.position.set(Math.cos(a) * r, 55 + Math.abs(Math.sin(i * 2.3)) * 50, Math.sin(a) * r)
    const k = 50 + Math.abs(Math.cos(i * 1.3)) * 40
    s.scale.set(k, k / 2, 1)
    s.renderOrder = -0.5
    root.add(s)
  }

  return root
}
