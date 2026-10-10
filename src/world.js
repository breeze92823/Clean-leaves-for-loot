import {
  CanvasTexture,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  ShaderMaterial,
  BackSide,
} from 'three'
import { COLORS, FOG, GROUND_SIZE, GROUND_Y, LIGHT, MATERIAL_PBR } from './config.js'

// Everything is procedural: the grass is painted to a canvas once, the sky is a
// gradient shader, the lights are plain three lights. No imported assets.

// Deterministic PRNG so the grass looks the same every load.
function mulberry32(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TILE_PX = 512
const TILE_M = 8 // metres of ground covered by one texture tile

// Paints a tileable grass tile: mottled base, soft blotches, then blade strokes.
// Returns the colour canvas and a greyscale height canvas (for the bump map).
function paintGrass() {
  const rand = mulberry32(1337)
  const color = document.createElement('canvas')
  const height = document.createElement('canvas')
  color.width = color.height = height.width = height.height = TILE_PX
  const c = color.getContext('2d')
  const h = height.getContext('2d')

  c.fillStyle = COLORS.grass
  c.fillRect(0, 0, TILE_PX, TILE_PX)
  h.fillStyle = '#808080'
  h.fillRect(0, 0, TILE_PX, TILE_PX)

  // Draws at (x, y) and again at the wrapped offsets so the tile repeats seamlessly.
  const wrapped = (x, y, r, draw) => {
    for (const ox of [-TILE_PX, 0, TILE_PX]) {
      for (const oy of [-TILE_PX, 0, TILE_PX]) {
        if (x + ox + r < 0 || x + ox - r > TILE_PX || y + oy + r < 0 || y + oy - r > TILE_PX) continue
        draw(x + ox, y + oy)
      }
    }
  }

  // Large soft blotches of lighter/darker green.
  for (let i = 0; i < 90; i++) {
    const x = rand() * TILE_PX
    const y = rand() * TILE_PX
    const r = 30 + rand() * 70
    const dark = rand() < 0.5
    wrapped(x, y, r, (px, py) => {
      const g = c.createRadialGradient(px, py, 0, px, py, r)
      g.addColorStop(0, dark ? 'rgba(40,90,30,0.28)' : 'rgba(150,200,90,0.2)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      c.fillStyle = g
      c.fillRect(px - r, py - r, r * 2, r * 2)
    })
  }

  // Blades: short strokes in a range of greens, mirrored into the height map.
  const greens = [COLORS.grassDark, COLORS.grass, '#74b552', '#3f7a2e', '#8cc760']
  for (let i = 0; i < 9000; i++) {
    const x = rand() * TILE_PX
    const y = rand() * TILE_PX
    const len = 4 + rand() * 9
    const lean = (rand() - 0.5) * 5
    const shade = greens[Math.floor(rand() * greens.length)]
    const lift = 100 + Math.floor(rand() * 140)
    wrapped(x, y, len + 6, (px, py) => {
      c.strokeStyle = shade
      c.lineWidth = 1.3
      c.beginPath()
      c.moveTo(px, py)
      c.lineTo(px + lean, py - len)
      c.stroke()
      h.strokeStyle = `rgb(${lift},${lift},${lift})`
      h.lineWidth = 1.3
      h.beginPath()
      h.moveTo(px, py)
      h.lineTo(px + lean, py - len)
      h.stroke()
    })
  }
  return { color, height }
}

function makeTexture(canvas, srgb) {
  const t = new CanvasTexture(canvas)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(GROUND_SIZE / TILE_M, GROUND_SIZE / TILE_M)
  t.anisotropy = 8
  if (srgb) t.colorSpace = SRGBColorSpace
  return t
}

export function createGround() {
  const { color, height } = paintGrass()
  const mesh = new Mesh(
    new PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
    new MeshStandardMaterial({
      map: makeTexture(color, true),
      bumpMap: makeTexture(height, false),
      bumpScale: 1.2,
      ...MATERIAL_PBR.GROUND,
    }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = GROUND_Y
  mesh.receiveShadow = true
  return mesh
}

export function createSky() {
  const mesh = new Mesh(
    new SphereGeometry(250, 32, 16),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new Color(COLORS.zenith) }, bottom: { value: new Color(COLORS.horizon) } },
      vertexShader: 'varying float vY; void main() { vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 bottom; varying float vY; void main() { gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0, 0.6, vY)), 1.0); }',
    }),
  )
  mesh.renderOrder = -1
  return mesh
}

// Hemisphere fill + one shadow-casting sun. The sun's shadow box follows the
// player so a small map covers the whole play area at full resolution.
export function createLights() {
  const hemi = new HemisphereLight(LIGHT.hemiSky, LIGHT.hemiGround, LIGHT.hemiIntensity)
  const sun = new DirectionalLight(LIGHT.sunColor, LIGHT.sunIntensity)
  const offset = { x: LIGHT.sunPosition[0], y: LIGHT.sunPosition[1], z: LIGHT.sunPosition[2] }
  sun.castShadow = true
  sun.shadow.mapSize.set(LIGHT.shadowMapSize, LIGHT.shadowMapSize)
  const r = LIGHT.shadowRange
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 150 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03

  const follow = (x, z) => {
    sun.position.set(x + offset.x, offset.y, z + offset.z)
    sun.target.position.set(x, 0, z)
    sun.target.updateMatrixWorld()
  }
  follow(0, 0)
  return { hemi, sun, follow }
}

export const createFog = () => new Fog(COLORS.horizon, FOG.near, FOG.far)
