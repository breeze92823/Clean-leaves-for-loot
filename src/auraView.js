// Live 3D previews for the Auras window: ONE shared WebGL renderer draws each visible row's aura
// effect (auraFx.js) around a dark blocky silhouette and copies it into the row's 2D canvas.
// Nothing runs while the window is closed.
import { ACESFilmicToneMapping, AmbientLight, BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { buildAuraFx } from './auraFx.js'

const SIZE = 248 // px of each preview (the tile is 124 CSS px; 2x for sharpness)

function silhouette() {
  const g = new Group()
  const mat = new MeshBasicMaterial({ color: '#0a0a14' })
  const part = (w, h, d, x, y) => {
    const m = new Mesh(new BoxGeometry(w, h, d), mat)
    m.position.set(x, y, 0)
    g.add(m)
  }
  part(0.5, 0.5, 0.5, 0, 1.7) // head
  part(0.8, 0.8, 0.4, 0, 1.05) // torso
  part(0.3, 0.8, 0.3, -0.45, 1.05) // arms
  part(0.3, 0.8, 0.3, 0.45, 1.05)
  part(0.35, 0.65, 0.35, -0.2, 0.33) // legs
  part(0.35, 0.65, 0.35, 0.2, 0.33)
  return g
}

export function createAuraViews(slots, scrollRoot) {
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
  renderer.setClearColor(0x000000, 0)

  const scene = new Scene()
  scene.add(new AmbientLight('#ffffff', 1))
  const camera = new PerspectiveCamera(42, 1, 0.1, 40)
  camera.position.set(0, 1.25, 5.6)
  camera.lookAt(0, 1.15, 0)

  const figure = silhouette()
  scene.add(figure)
  const entries = new Map()
  const visible = new Set()
  let active = false
  let raf = 0
  let last = 0

  function frame(t) {
    const dt = Math.min(t - last, 0.1)
    last = t
    for (const slot of slots) {
      if (!visible.has(slot.canvas)) continue
      let e = entries.get(slot.id)
      if (!e) {
        e = buildAuraFx(slot.id, { preview: true })
        e.group.visible = false
        scene.add(e.group)
        entries.set(slot.id, e)
      }
      e.group.visible = true
      e.group.rotation.y = t * 0.4
      e.update(t + slot.index * 0.9, dt)
      renderer.render(scene, camera)
      e.group.visible = false
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
      console.warn('[aura preview]', err)
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
      if (on) {
        last = performance.now() / 1000
        raf = requestAnimationFrame(loop)
      }
    },
  }
}
