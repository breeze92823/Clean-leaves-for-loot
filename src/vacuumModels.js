// Procedural 3D leaf blowers for the Vacuums window, one recipe per id in VACUUMS (config.js).
// Every model points down +X, is built from primitives (rounded boxes, tapered tubes, coils,
// fans, bolts, glowing strips) and is scaled/centred at the end, so recipes need no exact sizes.
// build(id) -> { group, spin: [{ obj, axis, speed }], glow: [materials that pulse] }.
import {
  BoxGeometry, CatmullRomCurve3, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry,
  TorusGeometry, TorusKnotGeometry, TubeGeometry, Vector3, Box3, ConeGeometry,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

const MODEL_SIZE = 2.6 // longest side after scaling
const DARK = '#1c1c24'
const STEEL = '#9aa0ac'

const matCache = new Map()
function mat(color, o = {}) {
  const key = color + JSON.stringify(o)
  let m = matCache.get(key)
  if (!m) {
    m = new MeshStandardMaterial({
      color,
      metalness: o.m ?? 0.35,
      roughness: o.r ?? 0.42,
      emissive: o.e ?? '#000000',
      emissiveIntensity: o.ei ?? 1,
    })
    matCache.set(key, m)
  }
  return m
}

function orient(geo, axis) {
  if (axis === 'x') geo.rotateZ(-Math.PI / 2)
  else if (axis === 'z') geo.rotateX(Math.PI / 2)
  return geo
}

class Builder {
  constructor() {
    this.g = new Group()
    this.spin = []
    this.glow = []
  }
  put(geo, m, x = 0, y = 0, z = 0, parent = this.g) {
    const mesh = new Mesh(geo, m)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    if (m.emissiveIntensity && (m.emissive.r || m.emissive.g || m.emissive.b) && !this.glow.includes(m)) this.glow.push(m)
    return mesh
  }
  // Cylinder along an axis; r = back radius, r2 = front radius (the +axis end).
  cyl({ x = 0, y = 0, z = 0, r, r2 = r, len, c, axis = 'x', seg = 32, o }) {
    return this.put(orient(new CylinderGeometry(r2, r, len, seg), axis), mat(c, o), x, y, z)
  }
  box({ x = 0, y = 0, z = 0, w, h, d, c, rad = 0.06, o }) {
    return this.put(new RoundedBoxGeometry(w, h, d, 3, Math.min(rad, w / 2.2, h / 2.2, d / 2.2)), mat(c, o), x, y, z)
  }
  ring({ x = 0, y = 0, z = 0, R, t = 0.05, c, axis = 'x', o }) {
    const geo = new TorusGeometry(R, t, 14, 56)
    if (axis === 'x') geo.rotateY(Math.PI / 2)
    else if (axis === 'y') geo.rotateX(Math.PI / 2)
    return this.put(geo, mat(c, o), x, y, z)
  }
  ball({ x = 0, y = 0, z = 0, r, c, sx = 1, sy = 1, sz = 1, o }) {
    const m = this.put(new SphereGeometry(r, 32, 20), mat(c, o), x, y, z)
    m.scale.set(sx, sy, sz)
    return m
  }
  // Studs around an axis-x circle of radius R.
  bolts({ x = 0, R, n = 8, s = 0.045, c = STEEL, len = 0.06 }) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      this.cyl({ x, y: Math.cos(a) * R, z: Math.sin(a) * R, r: s, len, c, seg: 10, axis: 'x' })
    }
  }
  // Louvres: n thin slats spaced along x.
  slats({ x = 0, y = 0, z = 0, n, w = 0.06, h = 0.3, d = 0.3, gap = 0.12, c = DARK }) {
    for (let i = 0; i < n; i++) this.box({ x: x + (i - (n - 1) / 2) * gap, y, z, w, h, d, c, rad: 0.02 })
  }
  led({ x = 0, y = 0, z = 0, w, h, d, c }) {
    this.box({ x, y, z, w, h, d, c, rad: 0.02, o: { e: c, ei: 1.2, m: 0, r: 0.3 } })
  }
  // Spinning fan facing along +axis, with a dark backing disc.
  fan({ x = 0, y = 0, z = 0, r, n = 6, c, hub = STEEL, axis = 'x', speed = 14, back = '#0c0c12' }) {
    const outer = new Group()
    outer.position.set(x, y, z)
    if (axis === 'z') outer.rotation.y = -Math.PI / 2
    else if (axis === 'y') outer.rotation.z = Math.PI / 2
    const inner = new Group()
    outer.add(inner)
    this.put(new CylinderGeometry(r, r, 0.04, 36).rotateZ(-Math.PI / 2), mat(back), 0, 0, 0, outer)
    for (let i = 0; i < n; i++) {
      const piv = new Group()
      piv.rotation.x = (i / n) * Math.PI * 2
      inner.add(piv)
      this.put(new BoxGeometry(0.025, r * 0.86, r * 0.34), mat(c), 0.03, r * 0.5, 0, piv).rotation.y = 0.55
    }
    this.put(new CylinderGeometry(r * 0.2, r * 0.2, 0.1, 20).rotateZ(-Math.PI / 2), mat(hub), 0.04, 0, 0, inner)
    this.put(new ConeGeometry(r * 0.18, 0.12, 20).rotateZ(-Math.PI / 2), mat(hub), 0.1, 0, 0, inner)
    this.g.add(outer)
    this.spin.push({ obj: inner, axis: 'x', speed })
    return outer
  }
  // Tapered tube (back radius r0, mouth radius r1) with a lip and a dark opening.
  nozzle({ x, len, r0, r1, c, lip = STEEL, y = 0, z = 0 }) {
    this.cyl({ x, y, z, r: r0, r2: r1, len, c })
    this.ring({ x: x + len / 2, y, z, R: r1, t: Math.max(0.03, r1 * 0.11), c: lip })
    this.cyl({ x: x + len / 2 + 0.004, y, z, r: r1 * 0.9, len: 0.02, c: '#07070b', seg: 32 })
  }
  // Rectangular flared mouth (square tube scaled flat).
  wideMouth({ x, len, r, r2, sy = 0.55, c, lip }) {
    const geo = orient(new CylinderGeometry(r2, r, len, 4), 'x')
    geo.rotateX(Math.PI / 4)
    geo.scale(1, sy, 1)
    this.put(geo, mat(c), x, 0, 0)
    const half = r2 * 0.707
    this.box({ x: x + len / 2 + 0.005, w: 0.03, h: 2 * half * sy * 1.02, d: 2 * half * 1.02, c: lip, rad: 0.02 })
    this.box({ x: x + len / 2 + 0.02, w: 0.03, h: 2 * half * sy * 0.8, d: 2 * half * 0.8, c: '#07070b', rad: 0.02 })
  }
  tube({ pts, r, c }) {
    const curve = new CatmullRomCurve3(pts.map((p) => new Vector3(...p)))
    return this.put(new TubeGeometry(curve, 48, r, 14), mat(c, { m: 0.15, r: 0.6 }))
  }
  // Arched carry handle over the top, spanning `len` along x.
  handle({ x = 0, y = 0, z = 0, len = 0.9, t = 0.07, c }) {
    return this.put(new TorusGeometry(len / 2, t, 12, 32, Math.PI), mat(c), x, y, z)
  }
  // Flat spiral (like a snail shell) in the XY plane, facing +z.
  spiral({ x = 0, y = 0, z = 0, r0 = 0.08, r1 = 0.7, turns = 2.5, t = 0.09, c, o }) {
    const pts = []
    for (let i = 0; i <= 90; i++) {
      const a = (i / 90) * turns * Math.PI * 2
      const r = r0 + (r1 - r0) * (i / 90)
      pts.push(new Vector3(Math.cos(a) * r, Math.sin(a) * r, 0))
    }
    return this.put(new TubeGeometry(new CatmullRomCurve3(pts), 220, t, 10), mat(c, o), x, y, z)
  }
  // Coil wrapped around the x axis, `len` long, centred on x.
  helix({ x = 0, len, R, turns, t, c, o, phase = 0 }) {
    const pts = []
    for (let i = 0; i <= 120; i++) {
      const u = i / 120
      const a = (u * turns + phase) * Math.PI * 2
      pts.push(new Vector3(x - len / 2 + u * len, Math.cos(a) * R, Math.sin(a) * R))
    }
    return this.put(new TubeGeometry(new CatmullRomCurve3(pts), 260, t, 10), mat(c, o))
  }
  coil({ x, y = 0, z = 0, R, t, c, p = 2, q = 5, o }) {
    return this.put(new TorusKnotGeometry(R, t, 160, 14, p, q).rotateY(Math.PI / 2), mat(c, o), x, y, z)
  }
}

const GLOW = (c) => ({ e: c, ei: 1.1, m: 0.1, r: 0.3 })

const recipes = {
  // Red cordless-drill style: silver fan grille up front, pistol grip, grey battery pack.
  battery(b) {
    const red = '#e0283a'
    const dk = '#24242c'
    b.cyl({ x: -0.1, r: 0.56, len: 1.5, c: red })
    b.ring({ x: 0.45, R: 0.57, t: 0.04, c: dk })
    b.ring({ x: -0.6, R: 0.57, t: 0.04, c: dk })
    b.slats({ x: -0.15, y: 0.55, n: 5, w: 0.05, h: 0.05, d: 0.4, gap: 0.12, c: '#9a1824' })
    b.cyl({ x: 1.0, r: 0.5, len: 0.6, c: '#aeb4c0' })
    b.ring({ x: 1.3, R: 0.5, t: 0.05, c: '#dfe3ea' })
    b.fan({ x: 1.3, r: 0.44, c: '#2e2e36', hub: '#c8ccd4', n: 9, speed: 18 })
    b.cyl({ x: -0.95, r: 0.5, r2: 0.55, len: 0.3, c: dk })
    b.ball({ x: -1.15, r: 0.34, c: red, sx: 0.5 })
    b.box({ x: -0.2, y: -0.95, w: 0.46, h: 1.2, d: 0.4, c: red, rad: 0.12 })
    b.box({ x: 0.1, y: -0.55, w: 0.12, h: 0.28, d: 0.14, c: dk })
    b.box({ x: -0.15, y: -1.62, w: 1.2, h: 0.42, d: 0.74, c: '#6a6a78', rad: 0.08 })
    b.box({ x: -0.15, y: -1.86, w: 1.25, h: 0.14, d: 0.78, c: dk, rad: 0.04 })
    b.led({ x: -0.15, y: -1.62, z: 0.38, w: 0.5, h: 0.07, d: 0.02, c: '#3aff6a' })
  },
  // Lime tube, purple fan drum with a dark side vent and a carry loop.
  suburban(b) {
    b.cyl({ x: 1.35, r: 0.3, r2: 0.34, len: 2.0, c: '#a4e83a' })
    b.ring({ x: 2.35, R: 0.34, t: 0.05, c: '#c8ff6a' })
    b.cyl({ x: 2.36, r: 0.29, len: 0.02, c: '#07070b' })
    b.ring({ x: 0.5, R: 0.32, t: 0.05, c: '#7ab81a' })
    b.cyl({ x: 0.0, r: 0.72, len: 1.0, c: '#7a3ad0' })
    b.ball({ x: -0.55, r: 0.72, c: '#6a2ac0', sx: 0.5 })
    b.cyl({ x: 0.35, r: 0.5, r2: 0.34, len: 0.4, c: '#5a2aa8' })
    b.cyl({ x: 0.0, z: 0.5, r: 0.5, len: 0.08, c: '#2a1a50', axis: 'z' })
    b.ring({ x: 0.0, z: 0.55, R: 0.5, t: 0.04, c: '#c8ccd4', axis: 'z' })
    b.fan({ x: 0.0, z: 0.56, r: 0.42, c: '#4a3a80', hub: '#c8ccd4', n: 8, axis: 'z', speed: 14 })
    b.handle({ x: 0.0, y: 0.7, len: 0.8, t: 0.07, c: '#3a2a70' })
    b.box({ x: 0.0, y: -0.8, w: 0.22, h: 0.4, d: 0.26, c: '#24242c' })
  },
  // Long black tube, round orange engine housing with concentric intake rings.
  gas(b) {
    b.cyl({ x: 1.0, r: 0.3, r2: 0.34, len: 2.2, c: '#26262e' })
    b.ring({ x: 2.1, R: 0.34, t: 0.05, c: '#4a4a56' })
    b.cyl({ x: 2.11, r: 0.29, len: 0.02, c: '#07070b' })
    b.ring({ x: 0.1, R: 0.35, t: 0.05, c: '#ff8a1a' })
    b.cyl({ x: -0.3, r: 0.8, len: 0.7, c: '#ff8a1a', axis: 'z', seg: 40 })
    b.cyl({ x: -0.3, z: 0.38, r: 0.62, len: 0.06, c: '#c85a08', axis: 'z', seg: 40 })
    for (const R of [0.5, 0.38, 0.26]) b.ring({ x: -0.3, z: 0.4, R, t: 0.035, c: R === 0.38 ? '#2a2a32' : '#ffb04a', axis: 'z' })
    b.cyl({ x: -0.3, z: 0.42, r: 0.12, len: 0.06, c: '#2a2a32', axis: 'z' })
    b.cyl({ x: -0.3, z: -0.38, r: 0.62, len: 0.06, c: '#c85a08', axis: 'z', seg: 40 })
    b.box({ x: -0.9, y: 0.35, w: 0.7, h: 0.4, d: 0.5, c: '#26262e', rad: 0.12 })
    b.handle({ x: -0.55, y: 0.7, len: 0.9, t: 0.08, c: '#26262e' })
    b.cyl({ x: -1.05, y: -0.15, r: 0.2, len: 0.4, c: '#26262e', axis: 'z' })
  },
  // White canister with a black lid and straps, black hose ending in a wand.
  drum(b) {
    b.cyl({ axis: 'y', r: 0.85, len: 1.9, c: '#f2f4f8' })
    for (const y of [-0.5, 0.45]) b.ring({ y, R: 0.87, t: 0.07, c: '#2a2a32', axis: 'y' })
    for (const y of [-0.05, 0.05]) b.ring({ y, R: 0.86, t: 0.03, c: '#b8bcc8', axis: 'y' })
    b.cyl({ axis: 'y', y: 1.05, r: 0.88, len: 0.22, c: '#34343e' })
    b.cyl({ axis: 'y', y: 1.22, r: 0.55, len: 0.14, c: '#6a6a76' })
    b.handle({ y: 1.28, len: 0.9, t: 0.08, c: '#1c1c24' })
    b.cyl({ axis: 'y', y: -1.05, r: 0.9, len: 0.22, c: '#34343e' })
    b.cyl({ x: 0.0, y: -0.7, z: 0.9, r: 0.14, len: 0.3, c: '#1c1c24', axis: 'z' })
    b.tube({ pts: [[0.1, -0.7, 1.0], [0.5, -0.9, 1.6], [1.4, -1.0, 1.7], [2.0, -0.6, 1.5]], r: 0.12, c: '#1c1c22' })
    b.cyl({ x: 2.6, y: -0.35, z: 1.3, r: 0.1, r2: 0.12, len: 0.9, c: '#2a2a32' }).rotation.z = 0.3
    b.box({ x: 3.15, y: -0.15, z: 1.2, w: 0.5, h: 0.12, d: 0.3, c: '#1c1c24' })
    b.box({ x: 0.2, y: 0.85, z: 0.6, w: 0.3, h: 0.14, d: 0.1, c: '#c8ccd4' })
  },
  // Low orange crawler: spiky ridged top, front scoop and a row of small purple wheels.
  wheel(b) {
    const org = '#ff8a1a'
    b.box({ x: 0, w: 2.4, h: 0.5, d: 1.0, c: org, rad: 0.1 })
    b.box({ x: 0.2, y: 0.4, w: 1.6, h: 0.3, d: 0.8, c: '#e07410', rad: 0.08 })
    for (let i = 0; i < 9; i++) {
      for (const z of [-0.25, 0.25]) {
        b.put(new ConeGeometry(0.1, 0.4, 8), mat('#ffa83a'), -0.8 + i * 0.22, 0.75, z)
      }
    }
    b.box({ x: -1.35, y: 0.3, w: 0.3, h: 0.8, d: 1.1, c: '#c85a08' })
    b.put(new ConeGeometry(0.5, 0.9, 4).rotateZ(-Math.PI / 2).scale(1, 0.5, 1.4), mat('#e07410'), 1.6, -0.05, 0)
    b.box({ x: 1.0, y: 0.35, w: 0.6, h: 0.5, d: 0.9, c: '#f89a2a', rad: 0.08 })
    for (let i = 0; i < 5; i++) {
      for (const z of [-0.58, 0.58]) {
        b.cyl({ x: -0.9 + i * 0.5, y: -0.33, z, r: 0.18, len: 0.14, c: '#7a3ad0', axis: 'z' })
        b.cyl({ x: -0.9 + i * 0.5, y: -0.33, z: z + Math.sign(z) * 0.08, r: 0.08, len: 0.04, c: '#fff', axis: 'z' })
      }
    }
    b.led({ x: 0.0, y: 0.0, z: 0.52, w: 0.5, h: 0.06, d: 0.02, c: '#ffd21a' })
  },
  // Orange round motor with a top loop and two grey barrels side by side.
  dual(b) {
    const org = '#ee7a3a'
    b.cyl({ x: -0.4, r: 0.62, len: 1.1, c: org })
    for (const R of [0.5, 0.36, 0.22]) b.ring({ x: -0.96, R, t: 0.035, c: R === 0.36 ? '#7a3a1a' : '#ffb27a' })
    b.cyl({ x: -0.97, r: 0.1, len: 0.06, c: '#3a2a22' })
    b.ring({ x: -0.55, R: 0.63, t: 0.06, c: '#8a4a2a' })
    b.ring({ x: 0.1, R: 0.63, t: 0.06, c: '#8a4a2a' })
    b.handle({ x: -0.4, y: 0.6, len: 0.9, t: 0.09, c: '#f09a5a' })
    b.cyl({ x: 0.2, r: 0.5, r2: 0.46, len: 0.3, c: '#5a5a66' })
    for (const z of [-0.3, 0.3]) {
      b.cyl({ x: 1.0, z, r: 0.31, len: 1.6, c: '#4a4a56' })
      b.ring({ x: 1.8, z, R: 0.31, t: 0.04, c: '#9a9aa6' })
      b.cyl({ x: 1.81, z, r: 0.26, len: 0.02, c: '#07070b' })
      for (const x of [0.5, 1.2]) b.ring({ x, z, R: 0.32, t: 0.03, c: '#2a2a32' })
    }
    b.box({ x: 0.2, y: -0.55, w: 0.3, h: 0.4, d: 0.5, c: '#7a3a1a' })
  },
  // Coral cylinder with a small top housing, grey collar and a black nozzle.
  turbo(b) {
    const red = '#e8503a'
    b.cyl({ x: -0.2, r: 0.72, len: 1.1, c: red })
    b.ring({ x: -0.6, R: 0.73, t: 0.05, c: '#b8281a' })
    b.ring({ x: 0.2, R: 0.73, t: 0.05, c: '#b8281a' })
    for (const R of [0.55, 0.38, 0.22]) b.ring({ x: -0.76, R, t: 0.04, c: R === 0.38 ? '#7a1a10' : '#ff8a6a' })
    b.cyl({ x: -0.2, y: 0.78, r: 0.2, len: 0.25, c: '#c82a1a', axis: 'y' })
    b.box({ x: -0.2, y: 1.0, w: 0.4, h: 0.22, d: 0.4, c: '#7a7a86' })
    b.cyl({ x: -0.2, y: 1.16, r: 0.1, len: 0.14, c: '#e8503a', axis: 'y' })
    b.cyl({ x: 0.6, r: 0.5, r2: 0.4, len: 0.4, c: '#a8a8b4' })
    b.cyl({ x: 1.45, r: 0.36, r2: 0.34, len: 1.3, c: '#2e2e36' })
    b.ring({ x: 2.1, R: 0.35, t: 0.07, c: '#8a8a96' })
    b.cyl({ x: 2.11, r: 0.26, len: 0.02, c: '#07070b' })
    b.bolts({ x: 0.4, R: 0.6, n: 10, s: 0.035 })
  },
  // Coral ringed body with a flat cream rectangular mouth.
  widemouth(b) {
    const org = '#f0784a'
    b.cyl({ x: -0.3, r: 0.62, len: 1.0, c: org })
    for (const x of [-0.65, -0.45, -0.25, -0.05]) b.ring({ x, R: 0.63, t: 0.05, c: x === -0.25 ? '#b04a2a' : '#ffa07a' })
    for (const R of [0.5, 0.34, 0.18]) b.ring({ x: -0.82, R, t: 0.035, c: R === 0.34 ? '#7a2a14' : '#ffb090' })
    b.cyl({ x: -0.3, y: 0.7, r: 0.16, len: 0.3, c: '#4a3a30', axis: 'y' })
    b.box({ x: -0.3, y: 0.92, w: 0.34, h: 0.2, d: 0.3, c: '#3a3a42' })
    b.cyl({ x: 0.4, r: 0.45, r2: 0.36, len: 0.4, c: '#d8602a' })
    b.cyl({ x: 0.7, r: 0.36, r2: 0.3, len: 0.3, c: '#e8cf90' })
    b.wideMouth({ x: 1.5, len: 1.3, r: 0.4, r2: 1.0, sy: 0.7, c: '#e8cf90', lip: '#c8a860' })
    b.bolts({ x: 0.3, R: 0.5, n: 8, s: 0.03 })
  },
  // Slim olive gun: small purple motor and green cap behind, thick lime ring muzzle.
  packgun(b) {
    const lime = '#a8e83a'
    b.cyl({ x: 0.8, r: 0.3, r2: 0.28, len: 2.1, c: '#3a4a2a' })
    for (const x of [0.2, 0.9, 1.5]) b.ring({ x, R: 0.3, t: 0.04, c: '#2a3a1a' })
    b.cyl({ x: 1.95, r: 0.34, r2: 0.34, len: 0.35, c: lime })
    b.ring({ x: 2.13, R: 0.34, t: 0.1, c: '#c8ff5a' })
    b.cyl({ x: 2.14, r: 0.24, len: 0.02, c: '#07070b' })
    b.box({ x: -0.5, w: 0.7, h: 0.7, d: 0.6, c: '#5a3a90', rad: 0.14 })
    b.cyl({ x: -0.5, y: 0.45, r: 0.2, len: 0.4, c: '#6aa03a', axis: 'y' })
    b.ball({ x: -1.0, y: 0.1, r: 0.4, c: '#6aa03a', sx: 0.6 })
    b.cyl({ x: -0.2, y: 0.0, r: 0.4, r2: 0.3, len: 0.5, c: '#4a3a70' })
    b.cyl({ x: 0.0, y: 0.0, z: 0.0, r: 0.34, len: 0.2, c: '#9ac84a' })
    b.handle({ x: 0.9, y: 0.3, len: 0.7, t: 0.055, c: '#2e2e36' })
    b.box({ x: 0.2, y: -0.55, w: 0.2, h: 0.5, d: 0.2, c: '#2e2e36' })
  },
  // Orange-brown box with a dark vent panel, top block and a black pipe with an orange flange.
  industrial(b) {
    const org = '#e8843a'
    b.box({ x: -0.3, w: 1.5, h: 1.3, d: 1.2, c: org, rad: 0.12 })
    b.box({ x: -0.3, y: 0.0, z: 0.62, w: 1.1, h: 0.85, d: 0.05, c: '#8a4a22', rad: 0.04 })
    b.slats({ x: -0.55, y: 0.0, z: 0.66, n: 3, w: 0.12, h: 0.55, d: 0.03, gap: 0.2, c: '#2a1a10' })
    b.led({ x: 0.05, y: 0.25, z: 0.66, w: 0.3, h: 0.12, d: 0.02, c: '#ffb23a' })
    b.box({ x: -0.3, y: 0.85, w: 0.7, h: 0.4, d: 0.7, c: '#4a4a56', rad: 0.08 })
    b.box({ x: -0.3, y: 1.15, w: 0.4, h: 0.2, d: 0.4, c: '#2e2e36', rad: 0.05 })
    b.box({ x: -0.3, y: 0.0, z: -0.62, w: 1.1, h: 0.85, d: 0.05, c: '#8a4a22', rad: 0.04 })
    b.bolts({ x: 0.5, R: 0.55, n: 8, s: 0.05, c: '#ddd' })
    b.cyl({ x: 0.75, r: 0.55, r2: 0.46, len: 0.3, c: '#35353f' })
    b.cyl({ x: 1.6, r: 0.4, len: 1.5, c: '#2a2a32' })
    b.ring({ x: 2.35, R: 0.4, t: 0.12, c: '#e8843a' })
    b.cyl({ x: 2.36, r: 0.3, len: 0.02, c: '#07070b' })
    b.ring({ x: 1.6, R: 0.41, t: 0.04, c: '#6a6a76' })
  },
  // Purple body, big aqua ring on the side, aqua pipe over the top, aqua bell mouth.
  cyclone(b) {
    const pur = '#7a5ad0'
    const aqua = '#7ad8e8'
    b.box({ x: -0.1, w: 1.3, h: 1.1, d: 1.0, c: pur, rad: 0.24 })
    b.ring({ x: -0.2, z: 0.52, R: 0.45, t: 0.12, c: aqua, axis: 'z' })
    b.cyl({ x: -0.2, z: 0.55, r: 0.3, len: 0.06, c: '#4a3a98', axis: 'z' })
    b.fan({ x: -0.2, z: 0.58, r: 0.3, c: '#cfe8ff', hub: aqua, n: 6, axis: 'z', speed: 10 })
    b.ring({ x: -0.2, z: -0.52, R: 0.45, t: 0.12, c: aqua, axis: 'z' })
    b.tube({ pts: [[-0.5, 0.5, 0.2], [-0.4, 0.95, 0.1], [0.3, 1.0, 0.0], [0.6, 0.55, 0.0]], r: 0.1, c: aqua })
    b.cyl({ x: 0.75, r: 0.38, r2: 0.3, len: 0.5, c: '#5a42b0' })
    b.cyl({ x: 1.2, r: 0.3, len: 0.5, c: aqua })
    b.cyl({ x: 1.75, r: 0.32, r2: 0.78, len: 0.7, c: '#b8e8f0' })
    b.ring({ x: 2.1, R: 0.78, t: 0.07, c: aqua })
    b.cyl({ x: 2.11, r: 0.66, len: 0.02, c: '#07070b' })
    b.box({ x: -0.1, y: -0.62, w: 0.3, h: 0.2, d: 0.3, c: '#4a3a98' })
  },
  // Red body, silver round intake discs, dark flaring nozzle with a grey rim.
  jet(b) {
    const red = '#e8383a'
    b.cyl({ x: 0.0, r: 0.58, len: 1.3, c: red })
    b.ring({ x: -0.3, R: 0.59, t: 0.06, c: '#c8ccd4' })
    b.ring({ x: 0.3, R: 0.59, t: 0.06, c: '#c8ccd4' })
    b.cyl({ x: -0.3, z: 0.55, r: 0.7, len: 0.2, c: '#aeb4c0', axis: 'z', seg: 40 })
    b.ring({ x: -0.3, z: 0.66, R: 0.62, t: 0.06, c: '#e0e4ec', axis: 'z' })
    b.cyl({ x: -0.3, z: 0.68, r: 0.5, len: 0.04, c: red, axis: 'z' })
    b.fan({ x: -0.3, z: 0.7, r: 0.46, c: '#3a3a44', hub: '#c8ccd4', n: 10, axis: 'z', speed: 22 })
    b.cyl({ x: -0.3, z: -0.55, r: 0.7, len: 0.2, c: '#aeb4c0', axis: 'z', seg: 40 })
    b.ring({ x: -0.3, z: -0.66, R: 0.62, t: 0.06, c: '#e0e4ec', axis: 'z' })
    b.cyl({ x: 0.95, r: 0.55, r2: 0.5, len: 0.4, c: '#c82a2a' })
    b.cyl({ x: 1.55, r: 0.3, r2: 0.55, len: 0.9, c: '#3a3a44' })
    b.ring({ x: 2.0, R: 0.55, t: 0.07, c: '#a8a8b4' })
    b.cyl({ x: 2.01, r: 0.44, len: 0.02, c: '#07070b' })
    b.handle({ x: 0.0, y: 0.58, len: 0.8, t: 0.06, c: '#2e2e3a' })
  },
  // Purple cube with two lime ring-motors on its face and a long green tube + lime bell.
  doublemotor(b) {
    const lime = '#a8e83a'
    b.box({ x: -0.2, w: 1.2, h: 1.2, d: 1.1, c: '#8a4ad0', rad: 0.14 })
    for (const y of [0.32, -0.32]) {
      for (const s of [1, -1]) {
        b.ring({ x: -0.2, y, z: 0.58 * s, R: 0.26, t: 0.1, c: lime, axis: 'z' })
        b.cyl({ x: -0.2, y, z: 0.5 * s, r: 0.2, len: 0.04, c: '#2a2a3a', axis: 'z' })
      }
      b.fan({ x: -0.2, y, z: 0.6, r: 0.2, c: '#d8ff7a', hub: lime, n: 5, axis: 'z', speed: 18 })
    }
    b.cyl({ x: -0.2, y: 0.0, r: 0.22, len: 1.3, c: lime, axis: 'y' })
    b.cyl({ x: 1.0, r: 0.24, r2: 0.22, len: 0.9, c: '#6aa03a' })
    b.ring({ x: 0.7, R: 0.25, t: 0.05, c: lime })
    b.cyl({ x: 1.65, r: 0.26, r2: 0.46, len: 0.4, c: lime })
    b.ring({ x: 1.85, R: 0.46, t: 0.08, c: '#6aa03a' })
    b.cyl({ x: 1.86, r: 0.34, len: 0.02, c: '#07070b' })
    b.bolts({ x: 0.45, R: 0.45, n: 6, s: 0.03 })
  },
  // Salmon tube with brown straps and a wide flared bell with a dark rim.
  cannon(b) {
    const sal = '#f08a5a'
    b.cyl({ x: -0.5, r: 0.55, len: 1.3, c: sal })
    b.ball({ x: -1.15, r: 0.55, c: '#d86a3a', sx: 0.5 })
    for (const x of [-0.85, -0.45, -0.05]) b.ring({ x, R: 0.56, t: 0.07, c: '#8a3a1a' })
    b.cyl({ x: 0.55, r: 0.5, r2: 0.46, len: 0.9, c: '#e8704a' })
    b.cyl({ x: 1.0, r: 0.5, r2: 0.46, len: 0.1, c: '#c85a2a' })
    b.box({ x: -0.4, y: -0.62, w: 0.5, h: 0.3, d: 0.3, c: '#7a3a1a' })
    b.box({ x: -0.2, y: 0.6, w: 0.4, h: 0.18, d: 0.5, c: '#7a3a1a' })
    b.cyl({ x: 1.85, r: 0.46, r2: 1.0, len: 1.4, c: sal })
    b.ring({ x: 2.55, R: 1.0, t: 0.16, c: '#7a2a1a' })
    b.ring({ x: 2.54, R: 0.88, t: 0.05, c: '#ffb080' })
    b.cyl({ x: 2.56, r: 0.84, len: 0.02, c: '#07070b' })
    b.led({ x: -0.5, y: 0.1, z: 0.57, w: 0.4, h: 0.06, d: 0.02, c: '#ffb23a' })
  },
  // Blue core with four light-blue round pods bolted on and a black barrel.
  quadvent(b) {
    const blu = '#3a78d8'
    b.cyl({ x: 0.0, r: 0.5, len: 1.2, c: blu })
    for (const [y, z] of [[0.62, 0.62], [0.62, -0.62], [-0.62, 0.62], [-0.62, -0.62]]) {
      b.cyl({ x: -0.1, y, z, r: 0.34, len: 0.8, c: '#6aa0f0' })
      b.ring({ x: -0.5, y, z, R: 0.34, t: 0.06, c: '#e8f0ff' })
      b.cyl({ x: -0.52, y, z, r: 0.22, len: 0.04, c: '#1a2a58' })
      b.fan({ x: -0.5, y, z, r: 0.2, c: '#cfe0ff', hub: blu, n: 6, speed: 18 })
      b.ball({ x: 0.1, y: y * 0.55, z: z * 0.55, r: 0.17, c: '#e8f0ff' })
    }
    b.ring({ x: 0.5, R: 0.52, t: 0.06, c: '#e8f0ff' })
    b.cyl({ x: 0.9, r: 0.5, r2: 0.4, len: 0.5, c: blu })
    b.cyl({ x: 1.7, r: 0.4, r2: 0.36, len: 1.1, c: '#2e2e36' })
    b.ring({ x: 2.25, R: 0.37, t: 0.06, c: '#8a8a96' })
    b.cyl({ x: 2.26, r: 0.28, len: 0.02, c: '#07070b' })
    b.bolts({ x: 0.7, R: 0.45, n: 8, s: 0.035, c: '#e8f0ff' })
  },
  // Blue box, black pipe and a gold slotted rotor disc at the front.
  rotor(b) {
    const blu = '#2a5ac8'
    b.box({ x: -0.8, w: 1.1, h: 1.1, d: 1.0, c: blu, rad: 0.14 })
    b.box({ x: -0.8, y: 0.0, z: 0.52, w: 0.8, h: 0.7, d: 0.04, c: '#1a3a90', rad: 0.04 })
    b.led({ x: -0.8, y: 0.0, z: 0.55, w: 0.4, h: 0.1, d: 0.02, c: '#ffd21a' })
    b.cyl({ x: -0.8, y: 0.62, r: 0.2, len: 0.3, c: '#ffc21a', axis: 'y' })
    b.cyl({ x: -0.3, r: 0.32, len: 0.7, c: '#ffc21a' })
    b.cyl({ x: 0.5, r: 0.3, len: 1.0, c: '#2a2a32' })
    b.ring({ x: 0.2, R: 0.32, t: 0.05, c: blu })
    b.cyl({ x: 1.05, r: 0.34, r2: 0.46, len: 0.3, c: '#2a2a32' })
    b.cyl({ x: 1.4, r: 0.8, len: 0.14, c: '#ffc21a', seg: 8 })
    b.ring({ x: 1.45, R: 0.76, t: 0.07, c: '#e8a80a' })
    b.cyl({ x: 1.42, r: 0.62, len: 0.18, c: '#15151c', seg: 8 })
    b.fan({ x: 1.5, r: 0.6, c: '#ffc21a', hub: '#ffd84a', n: 8, speed: 12 })
    b.bolts({ x: 1.48, R: 0.7, n: 8, s: 0.04, c: '#ffe27a' })
  },
  // Orange body between two purple turbine tubes with spinning pink-lit fans, purple nozzle.
  twin(b) {
    const org = '#f39a2a'
    const pur = '#8c84c8'
    b.box({ x: 0.2, w: 1.8, h: 0.9, d: 1.0, c: org, rad: 0.14 })
    for (const z of [-0.95, 0.95]) {
      b.cyl({ x: -0.1, z, r: 0.7, len: 1.7, c: pur })
      for (const x of [-0.95, 0.75]) b.ring({ x, z, R: 0.7, t: 0.09, c: org })
      b.cyl({ x: -0.9, z, r: 0.64, len: 0.1, c: '#0c0c12' })
      b.fan({ x: -0.97, z, r: 0.62, n: 8, c: '#d8d4ee', hub: org, speed: 40 })
      b.ring({ x: -1.05, z, R: 0.74, t: 0.03, c: '#ff7ae8', o: GLOW('#ff7ae8') })
    }
    b.handle({ x: 0.2, y: 0.45, len: 1.0, c: org }).rotation.y = Math.PI / 2
    b.cyl({ x: 1.6, r: 0.4, r2: 0.28, len: 1.2, c: pur })
    b.ring({ x: 2.2, R: 0.28, t: 0.05, c: org })
    b.cyl({ x: 2.21, r: 0.22, len: 0.02, c: '#07070b' })
    b.led({ x: 0.2, y: 0.0, z: 0.51, w: 1.0, h: 0.06, d: 0.02, c: '#ff7ae8' })
  },
  // Tan housing, round orange rear drum and a cluster of three dark barrels with tan bands.
  triple(b) {
    const tan = '#d8b878'
    b.cyl({ x: -0.9, r: 0.7, len: 0.8, c: '#e07a2a' })
    for (const R of [0.55, 0.4, 0.25]) b.ring({ x: -1.3, R, t: 0.04, c: R === 0.4 ? '#7a3a10' : '#ffb06a' })
    b.cyl({ x: -1.31, r: 0.1, len: 0.05, c: '#3a2a20' })
    b.ring({ x: -0.55, R: 0.72, t: 0.06, c: '#8a6a3a' })
    b.box({ x: -0.1, w: 0.8, h: 1.1, d: 0.9, c: tan, rad: 0.12 })
    b.cyl({ x: -0.1, y: 0.62, r: 0.2, len: 0.3, c: '#6a4a2a', axis: 'y' })
    for (const [y, z] of [[0.28, 0], [-0.2, 0.28], [-0.2, -0.28]]) {
      b.cyl({ x: 1.1, y, z, r: 0.27, len: 1.5, c: '#2a2a32' })
      b.ring({ x: 1.85, y, z, R: 0.27, t: 0.06, c: '#e07a2a' })
      b.cyl({ x: 1.86, y, z, r: 0.2, len: 0.02, c: '#07070b' })
    }
    for (const x of [0.6, 1.2, 1.6]) b.ring({ x, y: 0.0, R: 0.55, t: 0.05, c: tan })
    b.bolts({ x: 0.3, R: 0.42, n: 8, s: 0.035, c: '#8a6a3a' })
  },
  // Chunky dark-grey block with orange pipes and caps and twin black barrels.
  heavy(b) {
    const org = '#ee7a2a'
    b.cyl({ x: -0.9, r: 0.65, len: 0.6, c: org })
    for (const R of [0.5, 0.32]) b.ring({ x: -1.2, R, t: 0.04, c: '#7a3a10' })
    b.box({ x: 0.0, w: 1.2, h: 1.2, d: 1.1, c: '#3a3a44', rad: 0.14 })
    for (const [y, z] of [[0.55, 0.56], [-0.55, 0.56], [0.55, -0.56], [-0.55, -0.56]]) {
      b.cyl({ x: 0.0, y, z, r: 0.12, len: 1.2, c: org })
    }
    b.ring({ x: -0.5, R: 0.7, t: 0.06, c: org })
    b.box({ x: 0.0, y: 0.7, w: 0.6, h: 0.22, d: 0.5, c: org })
    b.cyl({ x: 0.0, y: 0.95, r: 0.1, len: 0.3, c: '#c8ccd4', axis: 'y' })
    for (const z of [-0.28, 0.28]) {
      b.cyl({ x: 1.4, z, r: 0.28, len: 1.2, c: '#26262e' })
      b.ring({ x: 2.0, z, R: 0.28, t: 0.06, c: org })
      b.cyl({ x: 2.01, z, r: 0.2, len: 0.02, c: '#07070b' })
    }
    b.ring({ x: 1.0, R: 0.62, t: 0.06, c: org })
    b.led({ x: 0.2, y: 0.1, z: 0.58, w: 0.5, h: 0.08, d: 0.02, c: '#ff9a2a' })
  },
  // Red body with four orange engine pods and a big black octagonal funnel.
  fourengine(b) {
    const red = '#e8383a'
    b.box({ x: 0.1, w: 1.5, h: 0.9, d: 0.9, c: '#c82a2a', rad: 0.14 })
    for (const [y, z] of [[0.62, 0.55], [0.62, -0.55], [-0.62, 0.55], [-0.62, -0.55]]) {
      b.cyl({ x: -0.3, y, z, r: 0.34, len: 0.8, c: '#ff8a3a' })
      b.ring({ x: -0.72, y, z, R: 0.34, t: 0.05, c: '#4a2a1a' })
      b.cyl({ x: -0.73, y, z, r: 0.2, len: 0.04, c: '#1a1210' })
      b.fan({ x: -0.72, y, z, r: 0.2, c: '#ff8a3a', hub: '#ffd0a0', n: 6, speed: 20 })
      b.cyl({ x: 0.0, y: y * 0.55, z: z * 0.55, r: 0.08, len: 0.5, c: '#2a2a32', axis: 'y' })
    }
    b.cyl({ x: 1.05, r: 0.5, r2: 0.6, len: 0.5, c: '#2a2a32', seg: 8 })
    b.cyl({ x: 1.8, r: 0.6, r2: 1.05, len: 1.0, c: '#34343e', seg: 8 })
    b.ring({ x: 2.3, R: 1.05, t: 0.1, c: red })
    b.cyl({ x: 2.31, r: 0.9, len: 0.02, c: '#07070b', seg: 8 })
    b.ring({ x: 0.7, R: 0.7, t: 0.05, c: '#2a2a32' })
    b.led({ x: 0.1, y: 0.0, z: 0.47, w: 0.5, h: 0.06, d: 0.02, c: '#ff6a3a' })
  },
  // Black barrel wrapped in a tan coil, tan intake ring and a flared tan tip.
  megaturbo(b) {
    const tan = '#d8b070'
    b.cyl({ x: 0.2, r: 0.42, len: 2.4, c: '#26262e' })
    b.helix({ x: 0.0, len: 1.7, R: 0.5, turns: 4.5, t: 0.1, c: tan })
    b.helix({ x: 0.0, len: 1.7, R: 0.5, turns: 4.5, t: 0.04, c: '#ff8a1a', o: GLOW('#ff8a1a'), phase: 0.5 })
    b.cyl({ x: -1.15, r: 0.62, len: 0.3, c: tan })
    b.ring({ x: -1.3, R: 0.62, t: 0.08, c: '#f0cf8a' })
    b.fan({ x: -1.31, r: 0.5, c: '#c8a058', hub: '#ff9a2a', n: 12, speed: 26 })
    b.ring({ x: -0.8, R: 0.52, t: 0.07, c: tan })
    b.cyl({ x: 1.6, r: 0.44, r2: 0.7, len: 0.7, c: tan })
    b.ring({ x: 1.95, R: 0.7, t: 0.09, c: '#e07a1a' })
    b.cyl({ x: 1.96, r: 0.56, len: 0.02, c: '#07070b' })
    b.box({ x: 0.2, y: 0.55, w: 0.4, h: 0.2, d: 0.3, c: '#c8a058' })
    b.cyl({ x: 0.2, y: 0.72, r: 0.08, len: 0.2, c: '#ff9a2a', axis: 'y' })
  },
  // Teal swirl shell on the side, blue banded body, blue funnel mouth, black cap on top.
  tornado(b) {
    const teal = '#3ad8d0'
    b.cyl({ x: 0.5, r: 0.5, len: 1.5, c: '#1a4ab8' })
    for (const x of [0.0, 0.4, 0.8, 1.2]) b.ring({ x, R: 0.51, t: 0.05, c: x % 0.8 ? '#7ae8ff' : '#2a8ae8' })
    b.spiral({ x: -0.5, z: 0.5, r0: 0.08, r1: 0.62, turns: 2.6, t: 0.11, c: teal, o: GLOW(teal) })
    b.cyl({ x: -0.5, z: 0.47, r: 0.7, len: 0.1, c: '#1a5a98', axis: 'z' })
    b.spiral({ x: -0.5, z: -0.5, r0: 0.08, r1: 0.62, turns: 2.6, t: 0.11, c: teal, o: GLOW(teal) })
    b.box({ x: 0.2, y: 0.7, w: 0.5, h: 0.3, d: 0.5, c: '#1c1c24' })
    b.cyl({ x: 0.2, y: 0.9, r: 0.1, len: 0.2, c: '#3ad8d0', axis: 'y' })
    b.cyl({ x: 1.6, r: 0.5, r2: 0.8, len: 0.7, c: '#2a6ad8' })
    b.ring({ x: 1.95, R: 0.8, t: 0.1, c: teal, o: GLOW(teal) })
    b.cyl({ x: 1.96, r: 0.66, len: 0.02, c: '#07070b' })
    b.led({ x: 0.9, y: 0.0, z: 0.52, w: 0.5, h: 0.06, d: 0.02, c: '#7af0ff' })
  },
  // Round grey reactor disc ringed with glowing cyan tiles, purple pipe nozzle.
  reactor(b) {
    const pur = '#7a5ac0'
    b.cyl({ x: -0.3, r: 0.95, len: 0.7, c: '#4a3a70', axis: 'z', seg: 40 })
    b.cyl({ x: -0.3, r: 0.8, len: 0.76, c: '#7a7a8a', axis: 'z', seg: 40 })
    for (const s of [1, -1]) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        const t = b.box({ x: -0.3 + Math.cos(a) * 0.66, y: Math.sin(a) * 0.66, z: 0.39 * s, w: 0.22, h: 0.16, d: 0.05, c: '#6aeaff', rad: 0.02, o: GLOW('#6aeaff') })
        t.rotation.z = a
      }
      b.ring({ x: -0.3, z: 0.4 * s, R: 0.42, t: 0.06, c: '#c8ccd4', axis: 'z' })
      b.cyl({ x: -0.3, z: 0.4 * s, r: 0.3, len: 0.06, c: '#6aeaff', axis: 'z', o: GLOW('#6aeaff') })
    }
    b.fan({ x: -0.3, z: 0.46, r: 0.22, c: '#cfe8ff', hub: '#6aeaff', n: 6, axis: 'z', speed: 9 })
    b.cyl({ x: 0.9, r: 0.45, r2: 0.4, len: 0.5, c: '#4a4a5a' })
    b.cyl({ x: 1.6, r: 0.38, r2: 0.36, len: 1.0, c: pur })
    for (const x of [1.3, 1.65, 2.0]) b.ring({ x, R: 0.38, t: 0.05, c: '#a8a8b8' })
    b.ring({ x: 2.12, R: 0.4, t: 0.08, c: '#8a6ad8' })
    b.cyl({ x: 2.13, r: 0.3, len: 0.02, c: '#07070b' })
  },
  // Olive hexagonal bazooka, dark straps, big lighter hex flare and a grip.
  shoulder(b) {
    const grn = '#6a8a3a'
    b.cyl({ x: -1.2, r: 0.5, r2: 0.55, len: 0.45, c: '#2a3a1a', seg: 6 })
    b.cyl({ x: 0.2, r: 0.55, len: 2.3, c: grn, seg: 6 })
    b.cyl({ x: 1.85, r: 0.55, r2: 0.85, len: 1.0, c: '#8aa84a', seg: 6 })
    b.ring({ x: 2.35, R: 0.85, t: 0.06, c: '#3a4a22' })
    b.cyl({ x: 2.36, r: 0.7, len: 0.02, c: '#07070b', seg: 6 })
    for (const x of [-0.6, 0.35, 1.2]) b.cyl({ x, r: 0.6, len: 0.22, c: '#2a3a1a', seg: 6 })
    b.box({ x: 0.2, y: 0.6, w: 1.2, h: 0.16, d: 0.7, c: '#4a5a2a' })
    b.box({ x: 0.7, y: -0.75, w: 0.26, h: 0.6, d: 0.24, c: '#2a2a22' })
    b.box({ x: -0.3, y: -0.7, w: 0.22, h: 0.4, d: 0.22, c: '#2a2a22' })
    b.fan({ x: -1.43, r: 0.4, c: '#2a3a1a', hub: '#8aa84a', n: 8, speed: 14 })
    b.led({ x: 0.3, y: 0.05, z: 0.5, w: 1.0, h: 0.05, d: 0.02, c: '#4aaaff' })
  },
}

export function buildVacuum(id) {
  const b = new Builder()
  recipes[id]?.(b)
  if (!b.g.children.length) b.box({ w: 2, h: 0.6, d: 0.6, c: STEEL })
  // Centre and scale to MODEL_SIZE on the longest side.
  const box = new Box3().setFromObject(b.g)
  const size = box.getSize(new Vector3())
  const centre = box.getCenter(new Vector3())
  const k = MODEL_SIZE / Math.max(size.x, size.y * 1.25, size.z * 1.25)
  const group = new Group()
  b.g.position.set(-centre.x, -centre.y, -centre.z)
  group.add(b.g)
  group.scale.setScalar(k)
  // Where the nozzle ends, in the group's scaled units (airflow effects start here).
  const front = (box.max.x - centre.x) * k
  return { group, spin: b.spin, glow: b.glow, front }
}
