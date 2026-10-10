// A training-zone leaf pile: a lumpy dome covered in leaves. It never changes. While the blower is
// aimed at it, a few leaves lift off, fly downwind and shrink away. leaves.js feeds it airflow
// through `target.blow`; props.js calls `update` each frame.
import {
  BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedMesh, Matrix4, Mesh,
  MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3,
} from 'three'
import { addPusher } from './colliders.js'
import { LEAVES } from './config.js'
import { leafTexture } from './leaves.js'

const Z = LEAVES.zones
const LIFE = 1.0 // s a blown leaf lives
const POOL = 90 // blown leaves alive at once
const R = 1.55 // pile radius, m
const HM = 1.3 // pile height, m
const COUNT = 420
const LEAF = [0.55, 0.95] // leaf size range, m

let sharedTex = null
const frac = (x) => x - Math.floor(x)

export function createTrainingPile({ x, y, z, color, lava = false, seed = 1, floorAt = () => y, hp = 1 }) {
  sharedTex ??= leafTexture()
  const group = new Group()
  const rnd = (() => {
    let s = Math.floor(seed * 9301 + 49297) % 233280 || 1
    return () => ((s = (s * 16807) % 2147483647) / 2147483647)
  })()
  const lump = rnd() * 6
  const height = (px, pz) => {
    const r2 = (px * px + pz * pz) / (R * R)
    if (r2 >= 1) return 0
    const th = Math.atan2(pz, px)
    const bump = 1 + 0.1 * Math.sin(3 * th + lump) + 0.07 * Math.sin(5 * th + lump * 2)
    return HM * Math.pow(1 - r2, 0.6) * bump
  }

  // --- Core: a lumpy dome under the leaves.
  const rings = 9
  const segs = 28
  const verts = []
  const idx = []
  for (let r = 0; r <= rings; r++) {
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2
      const rr = (r / rings) * R * 0.99
      verts.push(Math.cos(a) * rr, height(Math.cos(a) * rr, Math.sin(a) * rr) * 0.96, Math.sin(a) * rr)
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segs; s++) {
      const a = r * segs + s
      const b = r * segs + ((s + 1) % segs)
      idx.push(a, a + segs, b, b, a + segs, b + segs)
    }
  }
  const coreGeo = new BufferGeometry()
  coreGeo.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3))
  coreGeo.setIndex(idx)
  coreGeo.computeVertexNormals()
  const base = new Color(color)
  const coreMat = new MeshStandardMaterial({
    color: base.clone().multiplyScalar(0.5),
    flatShading: true,
    roughness: 0.9,
    side: DoubleSide,
    ...(lava ? { emissive: '#ff3a00', emissiveIntensity: 0.3 } : {}),
  })
  const core = new Mesh(coreGeo, coreMat)
  core.position.y = 0.12
  group.add(core)

  // --- Pile leaves (fixed) and the pool of blown leaves.
  const leafMat = new MeshStandardMaterial({
    map: sharedTex,
    alphaTest: 0.45,
    side: DoubleSide,
    roughness: 0.9,
    ...(lava ? { emissive: '#ff3a00', emissiveIntensity: 0.4 } : {}),
  })
  const inst = new InstancedMesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), leafMat, COUNT + POOL)
  inst.frustumCulled = false
  inst.position.y = 0.12
  group.add(inst)

  const up = new Vector3(0, 1, 0)
  const nrm = new Vector3()
  const pos = new Vector3()
  const scl = new Vector3()
  const q = new Quaternion()
  const m4 = new Matrix4()
  const tint = new Color()
  const hsl = {}
  const hide = new Matrix4().makeScale(0, 0, 0)
  const spots = [] // where leaves sit on the pile: [x, y, z]
  for (let i = 0; i < COUNT; i++) {
    const a = rnd() * Math.PI * 2
    const r = R * Math.sqrt(rnd()) * 0.98
    const px = Math.cos(a) * r
    const pz = Math.sin(a) * r
    const py = height(px, pz) + 0.03 + rnd() * 0.08
    spots.push([px, py, pz])
    const e = 0.05
    nrm.set(height(px - e, pz) - height(px + e, pz), 2 * e, height(px, pz - e) - height(px, pz + e)).normalize()
    q.setFromUnitVectors(up, nrm).multiply(new Quaternion().setFromAxisAngle(up, rnd() * Math.PI * 2))
    const sz = LEAF[0] + (LEAF[1] - LEAF[0]) * rnd()
    m4.compose(pos.set(px, py, pz), q, scl.set(sz, sz, sz))
    inst.setMatrixAt(i, m4)
    color_(i)
  }
  function color_(i) {
    base.getHSL(hsl)
    tint.setHSL(frac(hsl.h + (rnd() - 0.5) * 0.06), hsl.s, Math.min(0.9, Math.max(0.1, hsl.l * (0.75 + rnd() * 0.5))))
    inst.setColorAt(i, tint)
  }
  const fly = [] // blown leaves: position, velocity, age, size, spin
  for (let j = 0; j < POOL; j++) {
    fly.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, size: 0.7, spin: 0 })
    color_(COUNT + j)
    inst.setMatrixAt(COUNT + j, hide)
  }
  inst.instanceMatrix.needsUpdate = true
  inst.instanceColor.needsUpdate = true

  let owed = 0
  let wind = [1, 0] // unit heading of the airflow over the pile
  let active = false

  const target = {
    x,
    y: y + 0.7,
    z,
    radius: R,
    // w: airflow strength 0..1 at the pile; (wx, wz): its heading; bp: blower power.
    blow(w, wx, wz, dt, bp) {
      if (w <= Z.wearMin) return
      const hl = Math.hypot(wx, wz)
      if (hl > 1e-3) wind = [wx / hl, wz / hl]
      owed += (60 + 80 * w) * dt
      while (owed >= 1) {
        owed -= 1
        const f = fly.find((l) => !l.on)
        if (!f) break
        const sp = spots[Math.floor(Math.random() * COUNT)]
        const v = 7 + Math.random() * 6
        const ang = (Math.random() - 0.5) * 0.7
        const c = Math.cos(ang)
        const sn = Math.sin(ang)
        f.on = true
        f.age = 0
        f.x = sp[0]; f.y = sp[1]; f.z = sp[2]
        f.vx = (wind[0] * c - wind[1] * sn) * v
        f.vz = (wind[0] * sn + wind[1] * c) * v
        f.vy = 2 + Math.random() * 3
        f.size = LEAF[0] + (LEAF[1] - LEAF[0]) * Math.random()
        f.spin = Math.random() * 10
      }
      active = true
    },
  }

  addPusher((p, radius) => {
    const dx = p.x - x
    const dz = p.z - z
    const d = Math.hypot(dx, dz)
    const lim = R * 0.8 + radius
    if (d >= lim) return
    if (d > 1e-6) {
      p.x += (dx / d) * (lim - d)
      p.z += (dz / d) * (lim - d)
    } else p.x += lim
  })

  const spinQ = new Quaternion()
  return {
    group,
    target,
    leafMat,
    coreMat,
    update(dt) {
      if (!active) return
      let any = false
      for (let j = 0; j < POOL; j++) {
        const f = fly[j]
        if (!f.on) continue
        f.age += dt
        if (f.age >= LIFE) {
          f.on = false
          inst.setMatrixAt(COUNT + j, hide)
          continue
        }
        any = true
        const k = Math.exp(-1.2 * dt)
        f.vx *= k; f.vz *= k
        f.vy -= 6 * dt
        f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt
        const t = f.age / LIFE
        const sz = f.size * (1 - t * t)
        q.setFromAxisAngle(up, f.spin + f.age * 8)
        spinQ.setFromAxisAngle(nrm.set(1, 0, 0), Math.sin(f.age * 6 + f.spin))
        q.multiply(spinQ)
        m4.compose(pos.set(f.x, f.y, f.z), q, scl.set(sz, sz, sz))
        inst.setMatrixAt(COUNT + j, m4)
      }
      inst.instanceMatrix.needsUpdate = true
      if (!any) active = false
    },
  }
}
