// Procedural 3D aura effects, shared by the Auras window previews (auraView.js) and the player
// in the world (main.js). Each aura is a theme: two colours, an ambient particle motion, optional
// lightning bolts / crystal shards, and every few seconds a BURST: a flare, shockwave ring, light
// pillar and a spray of sparks. Origin = the player's feet; the effect is ~2 m tall.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, Group,
  LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, OctahedronGeometry, PointLight, Points, PointsMaterial,
  RingGeometry, Sprite, SpriteMaterial,
} from 'three'

const THEMES = {
  interstellar: { c: ['#b46aff', '#4a9bff'], mode: 'orbit', n: 70, shards: 0, bolts: 0 },
  static: { c: ['#6ae8ff', '#ffffff'], mode: 'orbit', n: 40, shards: 0, bolts: 7 },
  cinderveil: { c: ['#ff4a12', '#ffc13a'], mode: 'rise', n: 90, shards: 0, bolts: 0 },
  shardfall: { c: ['#5aff3a', '#d2ff7a'], mode: 'fall', n: 40, shards: 18, bolts: 0 },
  slipstream: { c: ['#3ab8ff', '#d2f6ff'], mode: 'spiral', n: 80, shards: 0, bolts: 0 },
  frostfire: { c: ['#3a8aff', '#ff7a1a'], mode: 'spiral', n: 90, shards: 10, bolts: 0 },
}
const BURST_N = 56
const BOLT_SEGS = 9

let glowTex, starTex
function textures() {
  if (glowTex) return
  let c = document.createElement('canvas')
  c.width = c.height = 128
  let g = c.getContext('2d')
  let grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.3, 'rgba(255,255,255,0.5)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  glowTex = new CanvasTexture(c)
  c = document.createElement('canvas')
  c.width = c.height = 64
  g = c.getContext('2d')
  g.translate(32, 32)
  g.fillStyle = '#fff'
  g.beginPath()
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 4 : 30
    const a = (i / 8) * Math.PI * 2
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  g.closePath()
  g.fill()
  grad = g.createRadialGradient(0, 0, 0, 0, 0, 12)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(-32, -32, 64, 64)
  starTex = new CanvasTexture(c)
}

const add = { transparent: true, depthWrite: false, blending: AdditiveBlending }
const pointCloud = (n, map, size) => {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3))
  geo.setAttribute('color', new BufferAttribute(new Float32Array(n * 3), 3))
  const pts = new Points(geo, new PointsMaterial({ map, size, vertexColors: true, ...add }))
  pts.frustumCulled = false
  return pts
}

// opts.preview: bigger + more frequent bursts for the window. opts.light: add a real point light.
export function buildAuraFx(id, { preview = false, light = false } = {}) {
  textures()
  const th = THEMES[id] ?? THEMES.interstellar
  const c1 = new Color(th.c[0])
  const c2 = new Color(th.c[1])
  const k = preview ? 1.3 : 1
  const period = preview ? 1.9 : 2.8
  const group = new Group()
  const tmp = new Color()

  const flare = new Sprite(new SpriteMaterial({ map: glowTex, color: c1, ...add }))
  flare.position.y = 1
  group.add(flare)
  const core = new Sprite(new SpriteMaterial({ map: glowTex, color: c2, ...add }))
  core.position.y = 1
  group.add(core)

  // Light beam: in the world it climbs to the sky (fading out with height); the preview keeps a short one.
  const beamH = preview ? 3.8 : 160
  const beam = (r0, r1, color, opacity) => {
    const geo = new CylinderGeometry(r0, r1, beamH, 24, 16, true)
    const pos = geo.attributes.position
    const col = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const f = (1 - (pos.getY(i) / beamH + 0.5)) ** (preview ? 1 : 1.6) // 1 at the feet, 0 at the top
      col.set([f, f, f], i * 3)
    }
    geo.setAttribute('color', new BufferAttribute(col, 3))
    const m = new Mesh(geo, new MeshBasicMaterial({ color, vertexColors: true, side: DoubleSide, opacity, fog: false, ...add }))
    m.position.y = beamH / 2
    m.frustumCulled = false
    m.visible = preview // no sky beam in the world; the preview keeps its short one
    group.add(m)
    return m
  }
  const pillar = beam(0.55 * k, 0.8 * k, c1, 0.16)
  const beamCore = beam(0.12 * k, 0.2 * k, c2, 0.5)

  const flat = (r0, r1, color) => {
    const m = new Mesh(new RingGeometry(r0, r1, 64), new MeshBasicMaterial({ color, side: DoubleSide, opacity: 0.8, ...add }))
    m.rotation.x = -Math.PI / 2
    m.position.y = 0.05
    group.add(m)
    return m
  }
  const wave = flat(0.9, 1, c2)
  const ringA = flat(0.8 * k, 0.9 * k, c1)
  const ringB = flat(0.45 * k, 0.5 * k, c2)

  // Ambient motes in the theme's motion.
  const amb = pointCloud(th.n, starTex, 0.3 * k)
  const seeds = Array.from({ length: th.n }, () => ({
    a: Math.random() * Math.PI * 2, r: 0.55 + Math.random() * 0.8, f: Math.random(), s: 0.35 + Math.random() * 0.6, m: Math.random(),
  }))
  group.add(amb)

  // Burst sparks, thrown outward when the flare goes off.
  const sparks = pointCloud(BURST_N, glowTex, 0.34 * k)
  const dirs = Array.from({ length: BURST_N }, () => {
    const a = Math.random() * Math.PI * 2
    const y = Math.random() * 1.4 - 0.5
    const h = Math.sqrt(Math.max(0.05, 1 - y * y * 0.5))
    return { x: Math.cos(a) * h, y, z: Math.sin(a) * h, v: 0.6 + Math.random() * 0.6 }
  })
  group.add(sparks)

  // Crystal shards circling / falling.
  const shards = []
  for (let i = 0; i < th.shards; i++) {
    const m = new Mesh(new OctahedronGeometry(0.13, 0), new MeshBasicMaterial({ color: tmp.clone().lerpColors(c1, c2, Math.random()), opacity: 0.85, ...add }))
    m.scale.set(0.55, 1.7, 0.55)
    group.add(m)
    shards.push({ m, a: Math.random() * 6.28, r: 0.8 + Math.random() * 0.7, f: Math.random(), s: 0.4 + Math.random() * 0.6 })
  }

  // Lightning bolts re-rolled many times a second.
  let bolts = null
  let boltClock = 0
  if (th.bolts) {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(th.bolts * BOLT_SEGS * 2 * 3), 3))
    bolts = new LineSegments(geo, new LineBasicMaterial({ color: c2, opacity: 1, ...add }))
    bolts.frustumCulled = false
    group.add(bolts)
  }
  const rollBolts = () => {
    const p = bolts.geometry.attributes.position
    let v = 0
    for (let b = 0; b < th.bolts; b++) {
      const a = Math.random() * 6.28
      const reach = (1 + Math.random() * 0.9) * k
      const ey = 0.2 + Math.random() * 1.7
      const ex = Math.cos(a) * reach
      const ez = Math.sin(a) * reach
      let px = 0, py = 1, pz = 0
      for (let j = 1; j <= BOLT_SEGS; j++) {
        const u = j / BOLT_SEGS
        const jit = j === BOLT_SEGS ? 0 : 0.22 * k
        const nx = ex * u + (Math.random() - 0.5) * jit
        const ny = 1 + (ey - 1) * u + (Math.random() - 0.5) * jit
        const nz = ez * u + (Math.random() - 0.5) * jit
        p.setXYZ(v++, px, py, pz)
        p.setXYZ(v++, nx, ny, nz)
        px = nx; py = ny; pz = nz
      }
    }
    p.needsUpdate = true
  }
  if (bolts) rollBolts()

  // `light` may be a shared PointLight that always lives in the scene: adding/removing a light changes the
  // light count and recompiles every lit material (a visible hitch on equip).
  let lamp = null
  if (light && light !== true) {
    lamp = light
    lamp.color.copy(c1)
  } else if (light) {
    lamp = new PointLight(c1, 0, 10, 2)
    lamp.position.y = 1.2
    group.add(lamp)
  }

  function update(t, dt = 0.016) {
    const bp = (((t % period) + period) % period) / period
    const e = Math.max(0, 1 - bp * 2.4) // 1 at the instant of the burst, gone by ~40%
    const pulse = 0.5 + 0.5 * Math.sin(t * 4)

    flare.scale.setScalar((1.6 + pulse * 0.4 + e * e * 6) * k)
    flare.material.opacity = Math.min(1, 0.35 + pulse * 0.2 + e * 0.9)
    core.scale.setScalar((0.7 + pulse * 0.25 + e * 1.4) * k)
    core.material.opacity = 0.5 + e * 0.5
    pillar.material.opacity = 0.12 + pulse * 0.06 + e * 0.4
    pillar.scale.set(1 + e * 0.6, 1, 1 + e * 0.6)
    beamCore.material.opacity = 0.4 + pulse * 0.2 + e * 0.4
    beamCore.scale.set(1 + e * 0.8, 1, 1 + e * 0.8)

    const rp = Math.min(bp * 1.7, 1)
    wave.scale.setScalar(0.4 + rp * 3.6 * k)
    wave.material.opacity = (1 - rp) ** 1.5 * 0.95
    ringA.rotation.z = t * 0.9
    ringA.material.opacity = 0.45 + pulse * 0.4 + e * 0.3
    ringA.scale.setScalar(1 + e * 0.5)
    ringB.rotation.z = -t * 1.3
    ringB.material.opacity = 0.4 + (1 - pulse) * 0.4

    // Ambient motes.
    const ap = amb.geometry.attributes.position
    const ac = amb.geometry.attributes.color
    seeds.forEach((s, i) => {
      const u = (t * s.s * 0.4 + s.f) % 1
      const fade = Math.sin(u * Math.PI) ** 1.2
      let x, y, z
      if (th.mode === 'rise') {
        const ang = s.a + t * 0.6 * s.s + u * 2
        const r = s.r * (1 - u * 0.5)
        x = Math.cos(ang) * r; y = u * 2.6; z = Math.sin(ang) * r
      } else if (th.mode === 'fall') {
        const ang = s.a + t * 0.5 * s.s
        x = Math.cos(ang) * s.r; y = 2.8 - u * 2.8; z = Math.sin(ang) * s.r
      } else if (th.mode === 'spiral') {
        const ang = s.a + u * 9 * (s.m > 0.5 ? 1 : -1)
        const r = 0.5 + s.r * 0.45 * (0.6 + u * 0.6)
        x = Math.cos(ang) * r; y = u * 2.8; z = Math.sin(ang) * r
      } else {
        const ang = s.a + t * (0.9 + s.s)
        x = Math.cos(ang) * s.r * 1.1; y = 1 + Math.sin(t * s.s * 1.7 + s.a) * 0.9; z = Math.sin(ang) * s.r * 1.1
      }
      ap.setXYZ(i, x, y, z)
      tmp.lerpColors(c1, c2, s.m).multiplyScalar(fade * (1 + e * 0.6))
      ac.setXYZ(i, tmp.r, tmp.g, tmp.b)
    })
    ap.needsUpdate = true
    ac.needsUpdate = true

    // Burst sparks.
    const sp = sparks.geometry.attributes.position
    const sc = sparks.geometry.attributes.color
    const p = Math.min(bp / 0.6, 1)
    const out = 1 - (1 - p) ** 3
    const fadeB = bp < 0.6 ? (1 - p) ** 1.1 : 0
    dirs.forEach((d, i) => {
      const dist = out * 2.8 * k * d.v
      sp.setXYZ(i, d.x * dist, 1 + d.y * dist - p * p * 0.7, d.z * dist)
      tmp.lerpColors(c2, c1, i / BURST_N).multiplyScalar(fadeB * 1.3)
      sc.setXYZ(i, tmp.r, tmp.g, tmp.b)
    })
    sp.needsUpdate = true
    sc.needsUpdate = true

    for (const s of shards) {
      const u = (t * s.s * 0.3 + s.f) % 1
      const ang = s.a + t * s.s * 1.4
      s.m.position.set(Math.cos(ang) * s.r, th.mode === 'fall' ? 2.7 - u * 2.7 : 0.4 + Math.sin(t * s.s * 2 + s.a) * 0.5 + 0.6, Math.sin(ang) * s.r)
      s.m.rotation.set(t * s.s * 2, ang, t * s.s)
      s.m.material.opacity = th.mode === 'fall' ? 0.9 * Math.sin(u * Math.PI) ** 0.6 : 0.85
    }

    if (bolts) {
      boltClock += dt
      if (boltClock > 0.07) {
        boltClock = 0
        rollBolts()
      }
      bolts.material.opacity = 0.55 + Math.random() * 0.45 + e * 0.3
    }

    if (lamp) lamp.intensity = 5 + pulse * 3 + e * 40
  }

  function dispose() {
    group.traverse((o) => {
      o.geometry?.dispose()
      o.material?.dispose()
    })
    if (lamp && lamp.parent === group) lamp.dispose?.()
    else if (lamp) lamp.intensity = 0
  }
  return { group, update, dispose }
}
