// Live 3D previews for the Vacuums window. ONE shared WebGL renderer draws each visible row's
// model (slowly turning, bobbing, lit by a colour-orbiting rim light, with a pulsing glow,
// circling sparkles and, from Epic up, a light halo) and copies it into that row's 2D canvas.
// Rows scrolled out of view are skipped, and nothing runs while the window is closed.
import {
  ACESFilmicToneMapping, AdditiveBlending, AmbientLight, CanvasTexture, Color, DirectionalLight, Group,
  BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, PMREMGenerator, PointLight,
  Points, PointsMaterial, RingGeometry, Scene, Sprite, SpriteMaterial, SRGBColorSpace, WebGLRenderer, DoubleSide, TorusGeometry,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { VACUUM_RARITY } from './config.js'
import { buildVacuum } from './vacuumModels.js'

const SIZE = 248 // px of each preview (the tile is 124 CSS px; 2x for sharpness)

function radialTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}
function starTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
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
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 12)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(-32, -32, 64, 64)
  return new CanvasTexture(c)
}

export function createVacuumViews(slots, scrollRoot) {
  let renderer
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true })
  } catch {
    return { setActive() {} } // no WebGL: the SVG tile stays
  }
  renderer.setSize(SIZE, SIZE, false)
  renderer.setPixelRatio(1)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.setClearColor(0x000000, 0)

  const scene = new Scene()
  const pmrem = new PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.85
  scene.add(new AmbientLight('#ffffff', 0.5))
  const key = new DirectionalLight('#ffffff', 2.2)
  key.position.set(3, 4, 4)
  scene.add(key)
  const rim = new PointLight('#ffffff', 40, 9, 2)
  scene.add(rim)

  const camera = new PerspectiveCamera(30, 1, 0.1, 40)
  camera.position.set(0, 0.9, 6.2)
  camera.lookAt(0, -0.05, 0)

  const glowTex = radialTexture()
  const starTex = starTexture()
  const entries = new Map() // id -> showcase
  const visible = new Set()
  let active = false
  let raf = 0

  function showcase(slot) {
    const style = VACUUM_RARITY[slot.rarity] ?? VACUUM_RARITY.Common
    const tint = new Color(style.glow)
    const root = new Group()
    const model = buildVacuum(slot.id)
    const holder = new Group() // tilt + bob; the model spins inside it
    holder.rotation.x = 0.16
    const rot = new Group() // the part that turns: the model plus the airflow at its nozzle
    rot.add(model.group)
    holder.add(rot)
    root.add(holder)

    // Muzzle flare + air being pulled into the nozzle in a tightening spiral.
    const flare = new Sprite(new SpriteMaterial({ map: glowTex, color: tint, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0.9 }))
    flare.position.set(model.front + 0.05, 0, 0)
    rot.add(flare)
    const AIR = 28
    const airGeo = new BufferGeometry()
    airGeo.setAttribute('position', new BufferAttribute(new Float32Array(AIR * 3), 3))
    airGeo.setAttribute('color', new BufferAttribute(new Float32Array(AIR * 3), 3))
    const air = new Points(airGeo, new PointsMaterial({ map: glowTex, size: 0.2, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }))
    air.frustumCulled = false
    rot.add(air)
    const airSeeds = Array.from({ length: AIR }, (_, i) => ({ i, f: Math.random(), a: Math.random() * Math.PI * 2, s: 0.6 + Math.random() * 0.6 }))

    // Legendary / Mythic: two thin light rings circle the model.
    const orbits = []
    if (['Legendary', 'Mythic'].includes(slot.rarity)) {
      for (let i = 0; i < 2; i++) {
        const o = new Mesh(
          new TorusGeometry(1.55 + i * 0.15, 0.012, 8, 96),
          new MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false }),
        )
        o.rotation.set(i ? 1.0 : 0.45, 0, i ? 0.6 : -0.3)
        holder.add(o)
        orbits.push(o)
      }
    }

    const halo = new Sprite(new SpriteMaterial({ map: glowTex, color: tint, transparent: true, depthWrite: false, opacity: 0.7 }))
    halo.scale.setScalar(4.4)
    halo.position.z = -1.6
    root.add(halo)

    // Epic and up stand on a slowly turning ring of light.
    let floor = null
    if (['Epic', 'Legendary', 'Mythic'].includes(slot.rarity)) {
      floor = new Mesh(
        new RingGeometry(1.25, 1.4, 64),
        new MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      )
      floor.rotation.x = -Math.PI / 2
      floor.position.y = -1.3
      root.add(floor)
      const inner = new Mesh(
        new RingGeometry(0.6, 0.72, 48),
        new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      )
      inner.rotation.x = -Math.PI / 2
      inner.position.y = -1.3
      root.add(inner)
      floor.userData.inner = inner
    }

    const n = style.sparkles
    const seeds = Array.from({ length: n }, (_, i) => ({
      a: Math.random() * Math.PI * 2,
      r: 1.2 + Math.random() * 0.9,
      y: Math.random() * 3 - 1.5,
      s: 0.35 + Math.random() * 0.7,
      f: Math.random(),
      i,
    }))
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3))
    const sparkles = new Points(
      geo,
      new PointsMaterial({ map: starTex, color: tint.clone().lerp(new Color('#ffffff'), 0.2), size: 0.46, transparent: true, depthWrite: false, blending: AdditiveBlending }),
    )
    sparkles.frustumCulled = false
    root.add(sparkles)
    scene.add(root)
    root.visible = false
    return { root, holder, rot, model, halo, floor, seeds, sparkles, tint, style, flare, air, airSeeds, orbits }
  }

  function frame(t) {
    for (const slot of slots) {
      if (!visible.has(slot.canvas)) continue
      let e = entries.get(slot.id)
      if (!e) entries.set(slot.id, (e = showcase(slot)))
      const phase = slot.index * 0.7
      e.root.visible = true
      e.rot.rotation.y = t * 0.9 + phase
      e.holder.position.y = Math.sin(t * 1.6 + phase) * 0.08
      for (const s of e.model.spin) s.obj.rotation[s.axis] = t * s.speed
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + phase)
      for (const m of e.model.glow) m.emissiveIntensity = 0.7 + pulse * 0.9
      e.halo.material.opacity = 0.5 + pulse * 0.3
      e.halo.scale.setScalar(4.2 + pulse * 0.5)
      if (e.floor) {
        e.floor.rotation.z = t * 0.6
        e.floor.userData.inner.rotation.z = -t * 0.9
        e.floor.material.opacity = 0.55 + pulse * 0.4
      }
      // Airflow: motes start wide, far in front of the nozzle, and spiral into it.
      const ap = e.air.geometry.attributes.position
      const ac = e.air.geometry.attributes.color
      for (const a of e.airSeeds) {
        const u = (t * 0.55 * a.s + a.f) % 1
        const d = (1 - u) * 1.6
        const rad = 0.06 + d * 0.38
        const ang = a.a + u * 7
        ap.setXYZ(a.i, e.model.front + 0.06 + d, Math.cos(ang) * rad, Math.sin(ang) * rad)
        const fade = Math.sin(u * Math.PI) ** 1.5
        ac.setXYZ(a.i, e.tint.r * fade, e.tint.g * fade, e.tint.b * fade)
      }
      ap.needsUpdate = true
      ac.needsUpdate = true
      e.flare.scale.setScalar(0.55 + pulse * 0.35)
      e.flare.material.opacity = 0.55 + pulse * 0.4
      e.orbits.forEach((o, i) => {
        o.rotation.y = t * (i ? -0.8 : 0.6)
        o.material.opacity = 0.35 + pulse * 0.5
      })
      const pos = e.sparkles.geometry.attributes.position
      for (const s of e.seeds) {
        const life = (t * s.s * 0.35 + s.f) % 1
        const a = s.a + t * s.s
        pos.setXYZ(s.i, Math.cos(a) * s.r, -1.4 + life * 3.0 + s.y * 0.1, Math.sin(a) * s.r * 0.6)
      }
      pos.needsUpdate = true
      e.sparkles.material.opacity = 0.9
      rim.color.copy(e.tint)
      rim.position.set(Math.cos(t * 1.3 + phase) * 3, 1.5, Math.sin(t * 1.3 + phase) * 3 + 1)
      renderer.render(scene, camera)
      e.root.visible = false
      const ctx = slot.canvas.getContext('2d')
      ctx.clearRect(0, 0, SIZE, SIZE)
      ctx.drawImage(renderer.domElement, 0, 0, SIZE, SIZE)
      slot.canvas.parentElement.classList.add('live')
    }
  }

  const io = new IntersectionObserver(
    (list) => {
      for (const it of list) (it.isIntersecting ? visible.add(it.target) : visible.delete(it.target))
    },
    { root: scrollRoot, threshold: 0.01 },
  )
  slots.forEach((s, i) => {
    s.index = i
    s.canvas.width = s.canvas.height = SIZE
    io.observe(s.canvas)
  })

  function loop(ms) {
    if (!active) return
    try {
      frame(ms / 1000)
    } catch (err) {
      console.warn('[vacuum preview]', err)
      active = false
      return
    }
    raf = requestAnimationFrame(loop)
  }
  return {
    setActive(on) {
      if (on === active) return
      active = on
      cancelAnimationFrame(raf)
      if (on) raf = requestAnimationFrame(loop)
    },
  }
}
