// The leaf field: a displaced "carpet" mesh plus GPU-animated leaves on top.
//
// All of the field's state is one small half-float texture (see GLSL_COMMON). Blowing only edits the
// few texels under the airflow on the CPU. The carpet's height/shading and every leaf's resting spot,
// blown-off flight, landing and fade are computed in vertex shaders from that texture, so the cost
// is flat: no per-leaf JavaScript, no per-leaf buffer uploads, and it doesn't grow with field length.
import {
  BufferAttribute, BufferGeometry, CanvasTexture, ClampToEdgeWrapping, Color, DataTexture, DataUtils,
  DoubleSide, HalfFloatType, InstancedBufferAttribute, InstancedBufferGeometry, LinearFilter, Mesh,
  MeshStandardMaterial, PlaneGeometry, Points, RepeatWrapping, RGBAFormat, ShaderMaterial, SRGBColorSpace,
  UniformsLib, UniformsUtils, Vector2, Vector3, Vector4,
} from 'three'
import { CAMERA, LEAVES, LIGHT } from './config.js'
import { addPusher } from './colliders.js'
import { createBlowerSound } from './blowerSound.js'
import { blowerPower, clearSpeedMultiplier, reachMultiplier } from './state.js'
import { buildPiles, zoneHp, ZONE_COUNT } from './piles.js'

const B = LEAVES.blower
const Z = LEAVES.zones
const P = LEAVES.piles

// A white leaf (tinted per instance) with a midrib and side veins, pointing up the canvas.
export function leafTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  g.translate(64, 64)
  g.beginPath()
  g.moveTo(0, -60)
  g.bezierCurveTo(46, -34, 40, 30, 0, 52)
  g.bezierCurveTo(-40, 30, -46, -34, 0, -60)
  const fill = g.createLinearGradient(-40, 0, 40, 0)
  fill.addColorStop(0, '#f2f2f2')
  fill.addColorStop(0.5, '#ffffff')
  fill.addColorStop(1, '#e6e6e6')
  g.fillStyle = fill
  g.fill()
  g.strokeStyle = 'rgba(0,0,0,0.28)'
  g.lineWidth = 2.2
  g.beginPath()
  g.moveTo(0, -56)
  g.lineTo(0, 62)
  for (let k = -1; k < 4; k++) {
    const y = -34 + k * 18
    g.moveTo(0, y + 14)
    g.lineTo(24, y)
    g.moveTo(0, y + 14)
    g.lineTo(-24, y)
  }
  g.stroke()
  g.strokeStyle = '#d8d8d8'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(0, 50)
  g.lineTo(0, 64)
  g.stroke()
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// Grey-scale leaf-litter atlas for the carpet. R = which palette colour a leaf takes, G = shading
// (gap / body / vein). It is data, not colour, so the texture stays in the default (linear) space.
function litterTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = 'rgb(128,38,0)'
  g.fillRect(0, 0, 256, 256)
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const leaf = (x, y, rot, sc, sel) => {
    g.save()
    g.translate(x, y)
    g.rotate(rot)
    g.scale(sc, sc)
    g.beginPath()
    g.moveTo(0, -30)
    g.bezierCurveTo(23, -17, 20, 15, 0, 26)
    g.bezierCurveTo(-20, 15, -23, -17, 0, -30)
    g.fillStyle = `rgb(${sel},205,0)`
    g.fill()
    g.strokeStyle = `rgb(${sel},95,0)`
    g.lineWidth = 1.6
    g.beginPath()
    g.moveTo(0, -27)
    g.lineTo(0, 30)
    for (let k = -1; k < 3; k++) {
      const yy = -16 + k * 11
      g.moveTo(0, yy + 8)
      g.lineTo(12, yy)
      g.moveTo(0, yy + 8)
      g.lineTo(-12, yy)
    }
    g.stroke()
    g.restore()
  }
  for (let i = 0; i < 150; i++) {
    const x = rand() * 256
    const y = rand() * 256
    const rot = rand() * Math.PI * 2
    const sc = 0.8 + rand() * 0.5
    const sel = Math.floor(rand() * 255)
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) leaf(x + ox, y + oy, rot, sc, sel) // wrap so it tiles
  }
  const tex = new CanvasTexture(c)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.anisotropy = 4
  return tex
}

// Soft round air puffs + ground dust, one Points object with per-particle alpha/size/colour.
function createParticles(scene, count) {
  const n = count
  const pos = new Float32Array(n * 3)
  const vel = new Float32Array(n * 3)
  const age = new Float32Array(n).fill(1)
  const life = new Float32Array(n).fill(1)
  const size0 = new Float32Array(n)
  const peak = new Float32Array(n)
  const alpha = new Float32Array(n)
  const size = new Float32Array(n)
  const col = new Float32Array(n * 3)
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3).setUsage(35048))
  geo.setAttribute('aAlpha', new BufferAttribute(alpha, 1).setUsage(35048))
  geo.setAttribute('aSize', new BufferAttribute(size, 1).setUsage(35048))
  geo.setAttribute('aColor', new BufferAttribute(col, 3).setUsage(35048))
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: { uScale: { value: 500 } },
    vertexShader: `
      attribute float aAlpha; attribute float aSize; attribute vec3 aColor;
      uniform float uScale; varying float vA; varying vec3 vC;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
        vA = aAlpha; vC = aColor;
      }`,
    fragmentShader: `
      varying float vA; varying vec3 vC;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, d);
        gl_FragColor = vec4(vC, a * a * vA);
      }`,
  })
  const points = new Points(geo, mat)
  points.frustumCulled = false
  points.renderOrder = 2
  scene.add(points)

  let next = 0
  let live = 0 // particles still alive; the per-frame loop and uploads are skipped at 0
  const dustColor = new Color('#e9e4c4')
  const white = new Color('#ffffff')
  function emit(x, y, z, vx, vy, vz, s, lifeS, a, color) {
    const i = next++ % n
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz
    age[i] = 0; life[i] = lifeS; size0[i] = s; peak[i] = a
    col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b
    live = n
  }

  return {
    puff(nz, d) {
      const sp = 14 + Math.random() * 12
      emit(
        nz.x + d.x * 0.3, nz.y + d.y * 0.3, nz.z + d.z * 0.3,
        d.x * sp + (Math.random() - 0.5) * 3.2, d.y * sp + (Math.random() - 0.5) * 3.2, d.z * sp + (Math.random() - 0.5) * 3.2,
        0.14 + Math.random() * 0.12, 0.35 + Math.random() * 0.25, 0.22, white,
      )
    },
    dust(x, y, z) {
      const a = Math.random() * Math.PI * 2
      const sp = 1.5 + Math.random() * 3
      emit(x, y + 0.1, z, Math.cos(a) * sp, 1.5 + Math.random() * 2.5, Math.sin(a) * sp, 0.25 + Math.random() * 0.25, 0.6 + Math.random() * 0.5, 0.32, dustColor)
    },
    update(dt, viewH) {
      if (live === 0) return
      mat.uniforms.uScale.value = viewH / (2 * Math.tan((CAMERA.fov * Math.PI) / 360))
      let any = false
      for (let i = 0; i < n; i++) {
        if (age[i] >= 1) {
          if (size[i] !== 0) { alpha[i] = 0; size[i] = 0 }
          continue
        }
        any = true
        age[i] += dt / life[i]
        const k = Math.exp(-1.6 * dt)
        vel[i * 3] *= k; vel[i * 3 + 1] *= k; vel[i * 3 + 2] *= k
        pos[i * 3] += vel[i * 3] * dt
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt
        const t = Math.min(age[i], 1)
        alpha[i] = peak[i] * Math.min(t * 8, 1) * (1 - t)
        size[i] = size0[i] * (1 + t * 3)
      }
      if (!any) live = 0
      geo.attributes.position.needsUpdate = true
      geo.attributes.aAlpha.needsUpdate = true
      geo.attributes.aSize.needsUpdate = true
      geo.attributes.aColor.needsUpdate = true
    },
  }
}

// --- Shared GLSL -------------------------------------------------------------------
// The field state lives in one half-float texture (RGBA, one texel per Z.cell):
//   R remaining leaf (1 = full pile, 0 = cleared)   G time of the last wear (s mod 256, /256; 0 = long ago)
//   B wind heading when it was worn (0..1 of a turn) A static mound height factor (0..1)
const GLSL_COMMON = /* glsl */ `
  uniform sampler2D uState;
  uniform vec4 uGrid;      // x0, z0, 1/width, 1/depth (metres)
  uniform float uCell;     // metres per texel
  uniform float uH;        // tallest mound, m
  uniform float uEdges[${ZONE_COUNT + 1}]; // zone boundaries (x)
  uniform vec3 uPal[${ZONE_COUNT * 8}];   // zones x 8 leaf colours
  vec4 stateAt(vec2 xz) { return texture2D(uState, (xz - uGrid.xy) * uGrid.zw); }
  float surfH(vec4 s) { return uH * s.a * s.r; }
  float zoneOf(float x) { float z = 0.0; for (int i = 1; i < ${ZONE_COUNT}; i++) z += 1.0 - step(uEdges[i], x); return z; }
`

const LEAF_VERT = /* glsl */ `
  ${GLSL_COMMON}
  uniform float uTime;   // seconds mod 256
  uniform float uRateZ[${ZONE_COUNT}]; // each zone's wear speed, 1/s (blower power / pile hp): turns "how far below its threshold" into "how long ago"
  uniform float uLinger;
  uniform float uFade;
  uniform vec2 uSize;
  uniform vec3 uSun;
  attribute vec4 aSeed;  // x, z, random, random
  varying vec2 vUv;
  varying vec3 vCol;
  varying float vLit;
  #include <fog_pars_vertex>

  mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
  mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

  void main() {
    vec2 b = aSeed.xy;
    float r1 = aSeed.z;
    float r2 = aSeed.w;
    float r3 = fract(r1 * 57.31);
    float r4 = fract(r2 * 91.7 + r1 * 13.1);
    float size = mix(uSize.x, uSize.y, r3);

    // Resting spot: on the carpet surface, tipped to follow its slope.
    vec4 s = stateAt(b);
    float hh = surfH(s);
    float e = uCell;
    float hx = surfH(stateAt(b + vec2(e, 0.0)));
    float hz = surfH(stateAt(b + vec2(0.0, e)));
    vec3 n = normalize(vec3(hh - hx, e, hh - hz));

    // Exact (unfiltered) texel decides whether this leaf has been blown off.
    ivec2 ts = textureSize(uState, 0);
    ivec2 ti = clamp(ivec2(floor((b - uGrid.xy) * uGrid.zw * vec2(ts))), ivec2(0), ts - 1);
    vec4 sn = texelFetch(uState, ti, 0);
    float thr = 0.04 + 0.92 * r1;   // leaves with a high threshold peel off first
    bool cleared = sn.r <= thr;

    vec2 xz = b;
    float y = hh + 0.04 + r4 * 0.1;
    float uc = 0.0;
    float scale = 1.0;
    mat3 R = mat3(1.0);
    if (cleared) {
      float age = sn.g < 0.002 ? 1.0e4 : mod(uTime - sn.g * 256.0, 256.0);
      float tau = age + (thr - sn.r) / uRateZ[int(zoneOf(b.x))]; // seconds since this leaf let go
      float T = 1.6 + 1.2 * r3;                     // flight time
      uc = clamp(tau / T, 0.0, 1.0);
      float ang = sn.b * 6.2831853 - 3.14159265;
      vec2 wd = vec2(cos(ang), sin(ang));
      vec2 perp = vec2(-wd.y, wd.x);
      float tf = min(tau, T);
      float sp = 5.0 + 9.0 * r4;
      xz = b + wd * (sp * (1.0 - exp(-1.3 * tf)) / 1.3) + perp * (sin(tf * 2.7 + r1 * 30.0) * 0.3 * tf);
      float yEnd = surfH(stateAt(xz)) + 0.05;
      float arc = (1.2 + 2.2 * r3) * 4.0 * uc * (1.0 - uc);
      y = mix(y + 0.2, yEnd, uc * uc * (3.0 - 2.0 * uc)) + arc + sin(tau * 9.0 + r2 * 40.0) * 0.12 * sin(uc * 3.14159);
      float amp = (1.0 - uc) * min(tau * 4.0, 1.0);
      R = rotY(tau * (4.0 + 6.0 * r4) * (1.0 - uc)) * rotX(sin(tau * 6.0 + r1 * 20.0) * 1.1 * amp) * rotZ(cos(tau * 5.0 + r2 * 20.0) * 1.1 * amp);
      scale = 1.0 - smoothstep(uLinger, uLinger + uFade, tau - T);
      n = normalize(mix(n, vec3(0.0, 1.0, 0.0), uc));
    }

    float a = r2 * 6.2831853;
    vec3 d = vec3(cos(a), 0.0, sin(a));
    vec3 bx = normalize(d - n * dot(d, n));
    vec3 bz = cross(bx, n);
    vec3 lp = R * (vec3(position.x, 0.0, position.z) * size * scale);
    vec3 world = vec3(xz.x, y, xz.y) + bx * lp.x + n * lp.y + bz * lp.z;

    float zone = zoneOf(b.x);
    vCol = uPal[int(zone) * 8 + int(r4 * 7.99)] * (0.85 + 0.3 * fract(r1 * 7.7));
    vec3 nw = bx * (R * vec3(0.0, 1.0, 0.0)).x + n * (R * vec3(0.0, 1.0, 0.0)).y + bz * (R * vec3(0.0, 1.0, 0.0)).z;
    vLit = (0.55 + 0.45 * max(dot(nw, uSun), 0.0)) * mix(0.78, 1.0, clamp(hh / uH, 0.0, 1.0));
    vUv = uv;

    vec4 mvPosition = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const LEAF_FRAG = /* glsl */ `
  uniform sampler2D uLeaf;
  varying vec2 vUv;
  varying vec3 vCol;
  varying float vLit;
  #include <fog_pars_fragment>
  void main() {
    vec4 t = texture2D(uLeaf, vUv);
    if (t.a < 0.45) discard;
    gl_FragColor = vec4(vCol * t.rgb * vLit, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

// Mound noise in 0..1 (baked into the state texture's alpha channel).
function moundNoise(x, z) {
  const a = Math.sin(x * 0.62 + Math.sin(z * 0.41) * 1.7)
  const b = Math.sin(z * 0.83 - x * 0.37 + 1.3)
  const c = Math.sin((x + z) * 0.21 + 2.0)
  const n = 0.5 + 0.5 * (a * 0.5 + b * 0.3 + c * 0.2) + 0.06 * Math.sin(x * 2.3 + z * 1.9)
  return Math.min(1, Math.max(0, n))
}

export function createLeaves(scene, renderer, quality = 1) {
  const C = Z.cell
  const X0 = Z.edges[Z.edges.length - 1]
  const X1 = Z.edges[0]
  const Z0 = -LEAVES.halfZ - 1
  const W = Math.round((X1 - X0) / C)
  const D = Math.round((2 * (LEAVES.halfZ + 1)) / C)
  const H = Z.height

  // --- Field state (CPU copy for blowing + collision, half-float texture for the GPU).
  const rem = new Float32Array(W * D).fill(1)
  const noise = new Float32Array(W * D)
  const lastWear = new Float32Array(W * D).fill(-1e6)
  const data = new Uint16Array(W * D * 4)
  const half = DataUtils.toHalfFloat
  for (let j = 0; j < D; j++) {
    for (let i = 0; i < W; i++) {
      const k = j * W + i
      // Mound height factor: bumpy 45-100%, tapering to flat over the last few metres by the hub
      // so the carpet's open front edge slopes down into the floor instead of ending in a wall.
      const x = X0 + (i + 0.5) * C
      const edge = Math.min(1, Math.max(0, (X1 - x) / Z.edgeTaper))
      noise[k] = (0.45 + 0.55 * moundNoise(x, Z0 + (j + 0.5) * C)) * edge * edge * (3 - 2 * edge)
      data[k * 4] = half(1)
      data[k * 4 + 1] = 0
      data[k * 4 + 2] = half(0.5)
      data[k * 4 + 3] = half(noise[k])
    }
  }
  // --- Piles: the unit that drops loot. pileLeft = sum of (mound factor x remaining) per pile.
  const { list: pileList, pileOf, cellZone } = buildPiles(X0, Z0, W, D, C, noise)
  const pileLeft = Float64Array.from(pileList, (p) => p.weight)
  const pileDone = new Uint8Array(pileList.length)
  const clearedListeners = new Set()
  let dirty = false // anything blown since the last reset
  const rateZ = new Array(ZONE_COUNT).fill(Z.wearRate * 0.8) // wear speed per zone (uniform for the leaf shader)
  const wearK = new Float32Array(ZONE_COUNT) // blower power / pile hp per zone

  const stateTex = new DataTexture(data, W, D, RGBAFormat, HalfFloatType)
  stateTex.minFilter = stateTex.magFilter = LinearFilter
  stateTex.wrapS = stateTex.wrapT = ClampToEdgeWrapping
  stateTex.generateMipmaps = false
  stateTex.needsUpdate = true
  const heightAt = (k) => H * noise[k] * rem[k]

  const palette = new Float32Array(ZONE_COUNT * 8 * 3)
  const tmpC = new Color()
  for (let zi = 0; zi < ZONE_COUNT; zi++) {
    for (let ci = 0; ci < 8; ci++) {
      const pal = Z.palettes[Math.min(zi, Z.palettes.length - 1)]
      tmpC.set(pal[ci % pal.length])
      palette.set([tmpC.r, tmpC.g, tmpC.b], (zi * 8 + ci) * 3)
    }
  }
  const palVecs = Array.from({ length: ZONE_COUNT * 8 }, (_, i) => new Vector3(palette[i * 3], palette[i * 3 + 1], palette[i * 3 + 2]))
  const shared = {
    uState: { value: stateTex },
    uGrid: { value: new Vector4(X0, Z0, 1 / (W * C), 1 / (D * C)) },
    uCell: { value: C },
    uH: { value: H },
    uEdges: { value: [...Z.edges] },
    uPal: { value: palVecs },
    uTime: { value: 0 },
  }

  // --- Carpet: a grid mesh whose height and shading come from the state texture.
  const sp = quality > 0.5 ? 0.75 : 1
  const nx = Math.round((X1 - X0) / sp)
  const nz = Math.round((D * C) / sp)
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3)
  const nrm = new Float32Array((nx + 1) * (nz + 1) * 3)
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const v = (j * (nx + 1) + i) * 3
      pos[v] = X0 + (i * (X1 - X0)) / nx
      pos[v + 2] = Z0 + (j * D * C) / nz
      nrm[v + 1] = 1
    }
  }
  const index = new Uint32Array(nx * nz * 6)
  let ii = 0
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i
      const b = a + 1
      const c2 = a + nx + 1
      const d2 = c2 + 1
      index.set([a, c2, b, b, c2, d2], ii)
      ii += 6
    }
  }
  const carpetGeo = new BufferGeometry()
  carpetGeo.setAttribute('position', new BufferAttribute(pos, 3))
  carpetGeo.setAttribute('normal', new BufferAttribute(nrm, 3))
  carpetGeo.setIndex(new BufferAttribute(index, 1))
  const litter = litterTexture()
  const carpetMat = new MeshStandardMaterial({ roughness: 0.95, metalness: 0 })
  carpetMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, { uLitter: { value: litter } })
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}\nvarying vec3 vWorldP; varying vec2 vSuv; varying float vHn;`)
      .replace('#include <beginnormal_vertex>', /* glsl */ `
        vec2 xz0 = position.xz;
        float e0 = uCell;
        float h0 = surfH(stateAt(xz0));
        float hxp = surfH(stateAt(xz0 + vec2(e0, 0.0)));
        float hxm = surfH(stateAt(xz0 - vec2(e0, 0.0)));
        float hzp = surfH(stateAt(xz0 + vec2(0.0, e0)));
        float hzm = surfH(stateAt(xz0 - vec2(0.0, e0)));
        vec3 objectNormal = normalize(vec3(hxm - hxp, 2.0 * e0, hzm - hzp));
      `)
      .replace('#include <begin_vertex>', /* glsl */ `
        vec3 transformed = vec3(position.x, h0 + 0.01, position.z);
        vWorldP = transformed;
        vSuv = (xz0 - uGrid.xy) * uGrid.zw;
        vHn = h0 / uH;
      `)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}\nuniform sampler2D uLitter; varying vec3 vWorldP; varying vec2 vSuv; varying float vHn;
        vec3 palCol(float zone, float sel) { return uPal[int(zone) * 8 + int(sel * 7.99)]; }`)
      .replace('#include <map_fragment>', /* glsl */ `
        if (texture2D(uState, vSuv).r < 0.05) discard;
        float zn = zoneOf(vWorldP.x);
        vec4 l1 = texture2D(uLitter, vWorldP.xz * 0.22);
        vec4 l2 = texture2D(uLitter, vWorldP.xz * 0.61 + vec2(0.37, 0.11));
        vec3 c1 = palCol(zn, l1.r) * mix(0.3, 1.0, l1.g);
        vec3 c2 = palCol(zn, l2.r) * mix(0.3, 1.0, l2.g);
        diffuseColor.rgb = mix(c1, c2, 0.35) * mix(0.5, 1.0, clamp(vHn * 1.4, 0.0, 1.0)) * 0.9;
      `)
  }
  const carpet = new Mesh(carpetGeo, carpetMat)
  carpet.frustumCulled = false
  carpet.receiveShadow = quality > 0.5
  scene.add(carpet)

  // --- Leaves on top: static data on the GPU, positions / flight computed in the vertex shader.
  const count = Math.round(Z.leaves * quality)
  const seeds = new Float32Array(count * 4)
  const area = (X1 - X0) * (2 * LEAVES.halfZ)
  const stride = Math.sqrt(area / count)
  const cols = Math.ceil((X1 - X0) / stride)
  let n = 0
  const rows = Math.ceil((2 * LEAVES.halfZ) / stride)
  for (let gz = 0; gz < rows && n < count; gz++) {
    for (let gx = 0; gx < cols && n < count; gx++) {
      const x = X0 + (gx + Math.random()) * stride
      const z = -LEAVES.halfZ + (gz + Math.random()) * stride
      if (x >= X1 || z >= LEAVES.halfZ) continue
      seeds.set([x, z, Math.random(), Math.random()], n * 4)
      n++
    }
  }
  for (; n < count; n++) seeds.set([X0 + Math.random() * (X1 - X0), (Math.random() * 2 - 1) * LEAVES.halfZ, Math.random(), Math.random()], n * 4)
  const plane = new PlaneGeometry(1, 1)
  plane.rotateX(-Math.PI / 2)
  const leafGeo = new InstancedBufferGeometry()
  leafGeo.index = plane.index
  leafGeo.setAttribute('position', plane.attributes.position)
  leafGeo.setAttribute('uv', plane.attributes.uv)
  leafGeo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4))
  leafGeo.instanceCount = count
  const sun = new Vector3(...LIGHT.sunPosition).normalize()
  const leafMat = new ShaderMaterial({
    uniforms: UniformsUtils.merge([UniformsLib.fog, {
      uLeaf: { value: leafTexture() },
      uRateZ: { value: rateZ },
      uLinger: { value: Z.lingerTime },
      uFade: { value: Z.fadeTime },
      uSize: { value: new Vector2(Z.leafSize[0], Z.leafSize[1]) },
      uSun: { value: sun },
    }]),
    vertexShader: LEAF_VERT,
    fragmentShader: LEAF_FRAG,
    side: DoubleSide,
    fog: true,
  })
  Object.assign(leafMat.uniforms, shared)
  const leafMesh = new Mesh(leafGeo, leafMat)
  leafMesh.frustumCulled = false
  scene.add(leafMesh)

  // --- Collision: the player is pushed out of any texel whose mound is still tall.
  addPusher((p, radius) => {
    if (p.x > X1 + 1) return
    const i0 = Math.max(0, Math.floor((p.x - radius - X0) / C))
    const i1 = Math.min(W - 1, Math.floor((p.x + radius - X0) / C))
    const j0 = Math.max(0, Math.floor((p.z - radius - Z0) / C))
    const j1 = Math.min(D - 1, Math.floor((p.z + radius - Z0) / C))
    const hw = C * 0.5
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (heightAt(j * W + i) < Z.blockMinHeight) continue
        const bx = X0 + (i + 0.5) * C
        const bz = Z0 + (j + 0.5) * C
        const lx = p.x - bx
        const lz = p.z - bz
        const qx = Math.max(-hw, Math.min(hw, lx))
        const qz = Math.max(-hw, Math.min(hw, lz))
        let dx = lx - qx
        let dz = lz - qz
        const dist = Math.hypot(dx, dz)
        if (dist >= radius) continue
        if (dist > 1e-6) {
          p.x += (dx / dist) * (radius - dist)
          p.z += (dz / dist) * (radius - dist)
        } else {
          const ex = hw - Math.abs(lx)
          const ez = hw - Math.abs(lz)
          if (ex < ez) p.x += Math.sign(lx || 1) * (ex + radius)
          else p.z += Math.sign(lz || 1) * (ez + radius)
        }
      }
    }
  })

  // --- Blower.
  const particles = createParticles(scene, B.particles)
  const sound = createBlowerSound()
  let power = 0
  let dustTimer = 0
  let puffTimer = 0
  let sweepAt = 20
  const wv = { x: 0, y: 0, z: 0 }
  let w = 0
  // Cone size this frame (the Range upgrade scales its length and mouth; set in update()).
  let range = B.range
  let coneStart = B.coneStart
  let MAX_LAT = coneStart + range * B.spread
  function sampleWind(x, y, z, N0, Dv, gust) {
    const rx = x - N0.x, ry_ = y - N0.y, rz = z - N0.z
    const d = rx * Dv.x + ry_ * Dv.y + rz * Dv.z
    w = 0
    if (d < -0.3 || d > range) return
    const qx = rx - d * Dv.x, qy = ry_ - d * Dv.y, qz = rz - d * Dv.z
    const r2 = qx * qx + qy * qy + qz * qz
    const R = coneStart + Math.max(d, 0) * B.spread
    if (r2 >= R * R) return
    const u2 = r2 / (R * R)
    w = (1 - u2) * Math.pow(1 - Math.max(d, 0) / range, 0.6) * power * gust
    const r = Math.sqrt(r2) + 1e-4
    const sw = (B.swirl * w) / r
    wv.x = Dv.x * B.speed * w + (Dv.y * qz - Dv.z * qy) * sw
    wv.y = Dv.y * B.speed * w + (Dv.z * qx - Dv.x * qz) * sw + B.lift * w
    wv.z = Dv.z * B.speed * w + (Dv.x * qy - Dv.y * qx) * sw
  }

  const newlyCleared = []
  const targets = []
  const nozzle = new Vector3()
  const dir = new Vector3()
  const dirH = new Vector3()

  return {
    get power() { return power },
    piles: pileList,
    get dirty() { return dirty },

    // A free-standing blowable pile: { x, y, z, radius, blow(w, wx, wz, dt, bp) }.
    addTarget(t) { targets.push(t) },

    // fn(pile) the moment a pile has been blown away.
    onPileCleared(fn) {
      clearedListeners.add(fn)
      return () => clearedListeners.delete(fn)
    },

    // The whole field regrows: every pile is back at full height.
    reset() {
      rem.fill(1)
      for (let k = 0; k < rem.length; k++) {
        data[k * 4] = half(1)
        data[k * 4 + 1] = 0
        data[k * 4 + 2] = half(0.5)
      }
      lastWear.fill(-1e6)
      pileDone.fill(0)
      for (let p = 0; p < pileList.length; p++) pileLeft[p] = pileList[p].weight
      dirty = false
      stateTex.needsUpdate = true
    },

    // nozzleWorld: where air leaves the tube. forwardH: unit horizontal aim (x, z).
    update(dt, t, nozzleWorld, forwardH, blowing, viewH) {
      const bp = blowerPower() * clearSpeedMultiplier()
      const reachK = reachMultiplier()
      range = B.range * reachK
      coneStart = B.coneStart * reachK
      MAX_LAT = coneStart + range * B.spread
      for (let zi = 0; zi < ZONE_COUNT; zi++) {
        wearK[zi] = bp / zoneHp(zi)
        rateZ[zi] = Math.max(1e-5, Z.wearRate * 0.8 * wearK[zi])
      }
      power = Math.min(1, Math.max(0, power + (blowing ? dt / B.windup : -dt / B.winddown)))
      sound.set(power)
      const tm = t % 256
      shared.uTime.value = tm

      const cp2 = Math.cos(B.pitch)
      dirH.set(forwardH.x, 0, forwardH.z).normalize()
      dir.set(dirH.x * cp2, Math.sin(B.pitch), dirH.z * cp2)
      nozzle.copy(nozzleWorld)
      const gust = 0.88 + 0.12 * Math.sin(t * 17) * Math.sin(t * 5.3 + 1)

      if (power > 0.02) {
        // Wear every texel the airflow reaches (a bounding box around the cone, then the exact test).
        const reach = range
        const px = dirH.z, pz = -dirH.x // lateral axis
        const fx = nozzle.x + dirH.x * reach, fz = nozzle.z + dirH.z * reach
        const minX = Math.min(nozzle.x - Math.abs(px) * coneStart, fx - Math.abs(px) * MAX_LAT)
        const maxX = Math.max(nozzle.x + Math.abs(px) * coneStart, fx + Math.abs(px) * MAX_LAT)
        const minZ = Math.min(nozzle.z - Math.abs(pz) * coneStart, fz - Math.abs(pz) * MAX_LAT)
        const maxZ = Math.max(nozzle.z + Math.abs(pz) * coneStart, fz + Math.abs(pz) * MAX_LAT)
        const i0 = Math.max(0, Math.floor((minX - X0) / C))
        const i1 = Math.min(W - 1, Math.floor((maxX - X0) / C))
        const j0 = Math.max(0, Math.floor((minZ - Z0) / C))
        const j1 = Math.min(D - 1, Math.floor((maxZ - Z0) / C))
        let changed = false
        const stamp = Math.max(tm / 256, 0.004)
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const k = j * W + i
            if (rem[k] <= 0) continue
            const cx = X0 + (i + 0.5) * C
            const cz = Z0 + (j + 0.5) * C
            const rx = cx - nozzle.x, rz = cz - nozzle.z
            const dh = rx * dirH.x + rz * dirH.z
            if (dh < -0.3 || dh > reach) continue
            const lat = rx * px + rz * pz
            if (lat > MAX_LAT || lat < -MAX_LAT) continue
            sampleWind(cx, heightAt(k) * 0.5, cz, nozzle, dir, gust)
            if (w <= Z.wearMin) continue
            // Harder piles (higher zones) wear slower: wearK = blower power / pile hp.
            let loss = ((w - Z.wearMin) * Z.wearRate * wearK[cellZone[k]] * dt) / (0.6 + 0.8 * noise[k])
            if (rem[k] < 0.3) loss *= 1 + (0.3 - rem[k]) * 8 // finish off thin remains
            const before = rem[k]
            rem[k] = Math.max(0, before - loss)
            if (rem[k] < 0.015) rem[k] = 0
            const pi = pileOf[k]
            pileLeft[pi] -= (before - rem[k]) * noise[k]
            if (!pileDone[pi] && pileLeft[pi] <= pileList[pi].weight * P.clearAt) {
              pileDone[pi] = 1
              newlyCleared.push(pileList[pi])
            }
            dirty = true
            const hl = Math.hypot(wv.x, wv.z)
            const hx = hl > 1e-3 ? wv.x / hl : dirH.x
            const hz = hl > 1e-3 ? wv.z / hl : dirH.z
            data[k * 4] = half(rem[k])
            data[k * 4 + 1] = half(stamp)
            data[k * 4 + 2] = half((Math.atan2(hz, hx) + Math.PI) / (2 * Math.PI))
            lastWear[k] = t
            changed = true
          }
        }
        if (changed) stateTex.needsUpdate = true

        // Free-standing piles (the training mounds): sample the airflow over each one.
        let hit = null
        let hitD = Infinity
        let hw = 0, hx = 0, hz = 0
        for (const tg of targets) {
          if (tg.locked?.()) continue // e.g. a training mound the player hasn't unlocked
          if (Math.abs(tg.x - nozzle.x) > range + tg.radius || Math.abs(tg.z - nozzle.z) > range + tg.radius) continue
          let bw = 0
          let bx = 0
          let bz = 0
          for (let o = 0; o < 5; o++) {
            const ox = o === 0 ? 0 : Math.cos(o * 1.5708) * tg.radius * 0.7
            const oz = o === 0 ? 0 : Math.sin(o * 1.5708) * tg.radius * 0.7
            sampleWind(tg.x + ox, tg.y, tg.z + oz, nozzle, dir, gust)
            if (w > bw) { bw = w; bx = wv.x; bz = wv.z }
          }
          const d = Math.hypot(tg.x - nozzle.x, tg.z - nozzle.z)
          if (bw > 0 && d < hitD) { hit = tg; hitD = d; hw = bw; hx = bx; hz = bz }
        }
        if (hit) hit.blow(hw, hx, hz, dt, bp) // only the nearest pile in the airflow
        if (newlyCleared.length) {
          for (const p of newlyCleared) for (const fn of clearedListeners) fn(p)
          newlyCleared.length = 0
        }

        // Dust where the airflow meets the ground.
        dustTimer -= dt
        if (power > 0.4 && dir.y < -0.01 && dustTimer <= 0) {
          dustTimer = 0.04
          const dHit = Math.min((nozzle.y - 0.05) / -dir.y, range) * (0.45 + Math.random() * 0.55)
          const hx = nozzle.x + dir.x * dHit + (Math.random() - 0.5) * dHit * 0.5
          const hz = nozzle.z + dir.z * dHit + (Math.random() - 0.5) * dHit * 0.5
          if (hx < X1) particles.dust(hx, 0, hz)
        }
        // Airflow puffs.
        puffTimer -= dt
        while (puffTimer <= 0 && power > 0.25) {
          particles.puff(nozzle, dir)
          puffTimer += 1 / (110 * power)
        }
      }

      // Texels untouched for a long time get a "long ago" stamp so the 256 s clock can't wrap
      // and bring blown leaves back.
      if (t > sweepAt) {
        sweepAt = t + 20
        let any = false
        for (let k = 0; k < rem.length; k++) {
          if (rem[k] < 1 && data[k * 4 + 1] !== 0 && t - lastWear[k] > 100) { data[k * 4 + 1] = 0; any = true }
        }
        if (any) stateTex.needsUpdate = true
      }

      particles.update(dt, viewH)
    },
  }
}
