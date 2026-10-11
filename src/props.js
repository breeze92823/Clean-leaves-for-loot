// Everything standing in the hub: shop stands with their NPCs, leaderboards,
// the Worlds portal, the training mounds,
// the vacuum showcase and the zone signs on the field. Decorative (the Sell Loot stand is driven by sell.js):
// solid (colliders) but not interactive.
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  RepeatWrapping,
  RingGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  CanvasTexture,
  SRGBColorSpace,
} from 'three'
import { addCollider } from './colliders.js'
import { HUB_COLORS as C, LEAVES, VACUUMS, SELL_STAND, AURA_STAND, WORLD_PORTAL } from './config.js'
import { player } from './player.js'
import { RARITY, zoneTier } from './data/loot.js'
import { drawText, loadIcon, panel, textLabel } from './labels.js'
import { mesh, studMat, worldBox } from './hub.js'
import { plankTexture, stripeTexture, stripeTextureV } from './textures.js'
import { shortMoney, state } from './state.js'
import { net, onLeaderboard } from './net.js'
import { createTrainingPile } from './trainingPile.js'

const std = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: 0.8, ...extra })
const plankMat = (col) => new MeshStandardMaterial({ map: plankTexture(col), roughness: 0.85 })

// A group placed at (x, y, z) facing `rot` (local +Z is the front).
function placed(parent, x, y, z, rot = 0) {
  const g = new Group()
  g.position.set(x, y, z)
  g.rotation.y = rot
  parent.add(g)
  return g
}

// Yaw that turns local +Z from (x, z) toward (tx, tz).
const facing = (x, z, tx = 0, tz = 0) => Math.atan2(tx - x, tz - z)

// --- NPCs --------------------------------------------------------------------

function faceTexture(skin) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 64
  const g = c.getContext('2d')
  g.fillStyle = skin
  g.fillRect(0, 0, 256, 64)
  g.fillStyle = '#111'
  g.beginPath()
  g.ellipse(118, 24, 3.5, 7, 0, 0, Math.PI * 2)
  g.ellipse(138, 24, 3.5, 7, 0, 0, Math.PI * 2)
  g.fill()
  g.lineWidth = 3.5
  g.strokeStyle = '#111'
  g.beginPath()
  g.arc(128, 32, 13, 0.2 * Math.PI, 0.8 * Math.PI)
  g.stroke()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

const NPC_LOOKS = {
  noob: { skin: '#f6d32d', torso: '#1f6fe0', legs: '#4fae3a' },
  girl: { skin: '#f6dccb', torso: '#f2eef5', legs: '#3a3446', hair: '#f5b8d8' },
}

// Blocky R6-style figure, ~1.9 m tall, feet at the origin.
function npc(parent, look, x, y, z, rot = 0) {
  const L = NPC_LOOKS[look]
  const g = placed(parent, x, y, z, rot)
  const skin = std(L.skin)
  g.add(mesh(new BoxGeometry(0.38, 0.76, 0.38), std(L.legs), -0.2, 0.38, 0))
  g.add(mesh(new BoxGeometry(0.38, 0.76, 0.38), std(L.legs), 0.2, 0.38, 0))
  g.add(mesh(new BoxGeometry(0.8, 0.76, 0.4), std(L.torso), 0, 1.14, 0))
  const arms = []
  for (const s of [-1, 1]) {
    const pivot = new Group()
    pivot.position.set(s * 0.6, 1.5, 0)
    pivot.add(mesh(new BoxGeometry(0.38, 0.76, 0.38), look === 'noob' ? skin : std(L.torso), 0, -0.36, 0))
    g.add(pivot)
    arms.push(pivot)
  }
  const head = new CylinderGeometry(0.27, 0.27, 0.46, 20, 1, false, Math.PI)
  const headMat = new MeshStandardMaterial({ map: faceTexture(L.skin), roughness: 0.7 })
  g.add(mesh(head, [headMat, skin, skin], 0, 1.76, 0))
  if (L.hair) {
    const hair = std(L.hair)
    g.add(mesh(new BoxGeometry(0.66, 0.16, 0.62), hair, 0, 2.02, -0.02))
    g.add(mesh(new BoxGeometry(0.66, 0.95, 0.2), hair, 0, 1.55, -0.28))
    g.add(mesh(new BoxGeometry(0.12, 0.6, 0.5), hair, -0.31, 1.7, -0.05))
    g.add(mesh(new BoxGeometry(0.12, 0.6, 0.5), hair, 0.31, 1.7, -0.05))
  }
  g.userData.arms = arms
  return g
}

// --- Stands ----------------------------------------------------------------------

function stand(parent, { x, z, y = 0, rot, awning, title, titleFill, titleStroke = '#1a1a1a', npcLook = 'noob' }) {
  const g = placed(parent, x, y, z, rot)
  const wood = plankMat(C.wood)
  const dark = plankMat(C.woodDark)
  g.add(mesh(worldBox(5.4, 0.35, 3.6), dark, 0, 0.175, 0))
  g.add(mesh(worldBox(4.6, 1.15, 0.9, 2), wood, 0, 0.92, 1.15))
  g.add(mesh(worldBox(5.0, 0.2, 1.2, 2), dark, 0, 1.6, 1.15))
  for (const sx of [-2.35, 2.35]) for (const sz of [-1.45, 1.45]) g.add(mesh(worldBox(0.32, 3.3, 0.32, 2), wood, sx, 2.0, sz))
  g.add(mesh(worldBox(4.4, 1.2, 0.3, 2), wood, 0, 0.95, -1.5))

  const roof = mesh(new BoxGeometry(5.6, 0.22, 3.6), new MeshStandardMaterial({ map: stripeTexture(...awning, 10), roughness: 0.7 }), 0, 3.75, 0)
  roof.rotation.x = 0.16
  g.add(roof)
  const roll = mesh(
    new CylinderGeometry(0.38, 0.38, 5.8, 20),
    new MeshStandardMaterial({ map: stripeTextureV(...awning, 14), roughness: 0.6 }),
    0,
    3.48,
    1.85,
  )
  roll.rotation.z = Math.PI / 2
  g.add(roll)

  const person = npc(g, npcLook, 0, 0.35, -0.2)
  person.scale.setScalar(1.3)
  const label = textLabel(title, { height: 1.7, px: 110, fill: titleFill, stroke: titleStroke })
  label.object.position.set(0, 6, 0)
  g.add(label.object)
  addCollider(x, z, 5.4, 3.6, y + 3.8, rot, y)
  return person
}

// --- Leaderboards ------------------------------------------------------------------

function leaderboard(parent, x, z, rot, key, title, titleFill, valueHeader, valueColor) {
  const g = placed(parent, x, 0, z, rot)
  const wood = std(C.boardWood)
  for (const sx of [-2.0, 2.0]) g.add(mesh(new BoxGeometry(0.4, 2, 0.4), wood, sx, 1, 0))
  g.add(mesh(new BoxGeometry(4.8, 5.6, 0.4), wood, 0, 4.6, 0))
  // Empty until the server's leaderboard arrives (net.js); then the live top 10.
  let rows = []
  const board = panel(
    512,
    600,
    (ctx, w, h) => {
      ctx.fillStyle = C.boardPanel
      ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].me) {
          ctx.fillStyle = 'rgba(122,255,74,0.28)'
          ctx.fillRect(8, 86 + i * 50 - 25, w - 16, 48)
          ctx.strokeStyle = '#7aff4a'
          ctx.lineWidth = 3
          ctx.strokeRect(8, 86 + i * 50 - 25, w - 16, 48)
        }
        ctx.fillStyle = 'rgba(0,0,0,0.12)'
        ctx.fillRect(0, 86 + i * 50 + 22, w, 4)
      }
      drawText(ctx, 'Player', 140, 34, { px: 30, fill: '#62b4ff', strokeW: 3, shadow: false })
      drawText(ctx, valueHeader, 400, 34, { px: 30, fill: valueColor, strokeW: 3, shadow: false })
      const rankFill = ['#ffd84a', '#d8e2ee', '#e89a5a']
      rows.forEach((r, i) => {
        const y = 86 + i * 50
        const max = r.me ? 8 : 12
        const name = r.name.length > max ? `${r.name.slice(0, max - 1)}…` : r.name
        drawText(ctx, `#${i + 1} @${name}${r.me ? ' (You)' : ''}`, 40, y, { px: 30, fill: r.me ? '#7aff4a' : rankFill[i] ?? '#ffffff', strokeW: 3, shadow: false, align: 'left' })
        drawText(ctx, r.value, 400, y, { px: 30, fill: '#ffffff', strokeW: 3, shadow: false })
      })
    },
    { height: 5.0, width: 4.25 },
  )
  onLeaderboard((boards) => {
    const live = boards[key]
    rows = (live ?? []).map((r) => ({ name: r.name, value: shortMoney(r.value), me: r.id === net.sessionId }))
    board.repaint()
  })
  board.object.position.set(0, 4.6, 0.21)
  g.add(board.object)
  const label = textLabel(title, { height: title.length > 8 ? 1.0 : 1.4, px: 100, fill: titleFill, billboard: false })
  label.object.position.set(0, 8.2, 0.1)
  g.add(label.object)
  addCollider(x, z, 4.8, 0.6, 7.4, rot)
}

// --- Controls board ---------------------------------------------------------------

// Keycap rows painted on the board: [label, keys[]] (strings in `keys` are drawn as caps).
const CONTROL_ROWS = [
  ['Move', ['W', 'A', 'S', 'D']],
  ['Jump', ['SPACE']],
  ['Blow Leaves', ['F', 'or', 'CLICK']],
  ['Look', ['MOUSE']],
  ['Zoom', ['WHEEL']],
  ['Interact', ['E']],
  ['Hotbar', ['1', '2', '3']],
  ['Cursor', ['ESC', 'CLICK']],
]

const BOARD_SCALE = 2 // the controls board is drawn at double the leaderboard size

function controlsBoard(parent, x, z, rot) {
  const g = placed(parent, x, 0, z, rot)
  g.scale.setScalar(BOARD_SCALE)
  const wood = std(C.boardWood)
  for (const sx of [-2.0, 2.0]) g.add(mesh(new BoxGeometry(0.4, 2, 0.4), wood, sx, 1, 0))
  g.add(mesh(new BoxGeometry(4.8, 5.6, 0.4), wood, 0, 4.6, 0))
  const board = panel(
    512,
    600,
    (ctx, w, h) => {
      ctx.fillStyle = C.boardPanel
      ctx.fillRect(0, 0, w, h)
      CONTROL_ROWS.forEach(([name, keys], i) => {
        const y = 40 + i * 70
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.12)'
          ctx.fillRect(0, y - 32, w, 64)
        }
        drawText(ctx, name, 24, y, { px: 30, fill: '#ffe46a', strokeW: 3, shadow: false, align: 'left' })
        // Keycaps right-aligned.
        const caps = keys.map((k) => ({ k, w: k === 'or' ? 34 : Math.max(44, k.length * 18 + 24) }))
        let cx = w - 20 - caps.reduce((a, c) => a + c.w + 8, -8)
        for (const c of caps) {
          if (c.k === 'or') drawText(ctx, 'or', cx + c.w / 2, y, { px: 24, fill: '#ffffff', strokeW: 2, shadow: false })
          else {
            ctx.fillStyle = '#121212'
            ctx.beginPath()
            ctx.roundRect(cx, y - 24, c.w, 48, 9)
            ctx.fill()
            ctx.fillStyle = '#f2f2f2'
            ctx.beginPath()
            ctx.roundRect(cx + 3, y - 21, c.w - 6, 38, 7)
            ctx.fill()
            drawText(ctx, c.k, cx + c.w / 2, y - 2, { px: c.k.length > 3 ? 22 : 28, fill: '#121212', stroke: null, shadow: false })
          }
          cx += c.w + 8
        }
      })
    },
    { height: 5.0, width: 4.25 },
  )
  board.object.position.set(0, 4.6, 0.21)
  g.add(board.object)
  const label = textLabel('Controls', { height: 1.4, px: 100, fill: ['#ffffff', '#cfe6ff'], stroke: '#2a3a5a', billboard: false })
  label.object.position.set(0, 8.2, 0.1)
  g.add(label.object)
  addCollider(x, z, 4.8 * BOARD_SCALE, 0.6 * BOARD_SCALE, 7.4 * BOARD_SCALE, rot)

  // Attention highlight shown for a few seconds once the controls guide is finished: a pulsing
  // glow slab behind the panel and a bobbing arrow above it.
  const glow = mesh(new BoxGeometry(5.6, 6.4, 0.2), new MeshBasicMaterial({ color: '#ffe46a', transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }), 0, 4.6, -0.05)
  const arrow = mesh(new ConeGeometry(0.7, 1.4, 4), new MeshBasicMaterial({ color: '#ffe46a' }), 0, 10.4, 0.1)
  arrow.rotation.x = Math.PI // point down at the sign
  glow.visible = arrow.visible = false
  g.add(glow, arrow)
  let left = 0
  return {
    show(seconds = 5) {
      left = seconds
    },
    update(dt, t) {
      const on = left > 0
      if (on) left -= dt
      glow.visible = arrow.visible = on
      if (!on) return
      const fade = Math.min(1, left) // ease out over the last second
      glow.material.opacity = (0.35 + Math.sin(t * 8) * 0.2) * fade
      arrow.position.y = 10.4 + Math.sin(t * 6) * 0.35
      arrow.scale.setScalar(fade)
    },
  }
}

// --- Worlds portal --------------------------------------------------------------

function portal(parent, x, z, rot) {
  const g = placed(parent, x, 0, z, rot)
  const stone = studMat(C.stone, '#bdb2d8', 1)
  g.add(mesh(worldBox(6.8, 0.3, 3.4, 2), stone, 0, 0.15, 0.6))
  g.add(mesh(worldBox(5.8, 0.3, 2.4, 2), stone, 0, 0.45, 0.4))
  const purple = studMat('#9a34e6', '#8526d4', 1)
  for (const s of [-1, 1]) g.add(mesh(worldBox(1.3, 6.2, 1.4, 2), purple, s * 2.55, 3.7, 0))
  g.add(mesh(worldBox(6.4, 1.1, 1.6, 2), studMat('#2f72e8', '#245fd0', 1), 0, 7.35, 0))
  g.add(mesh(new BoxGeometry(3.8, 6.2, 0.4), new MeshBasicMaterial({ color: '#05050a' }), 0, 3.7, 0))
  const label = textLabel('Worlds', { height: 1.5, px: 100, fill: ['#ffc4ff', '#c45cf0', '#8a2bd0'], stroke: '#2a0a3a' })
  label.object.position.set(0, 9.6, 0)
  g.add(label.object)
  addCollider(x, z, 6.4, 1.6, 7.9, rot, 0.6)
  addCollider(x + Math.sin(rot) * 0.6, z + Math.cos(rot) * 0.6, 6.8, 3.4, 0.3, rot)
  addCollider(x + Math.sin(rot) * 0.4, z + Math.cos(rot) * 0.4, 5.8, 2.4, 0.6, rot)
  const lock = textLabel(`Unlock at Level ${WORLD_PORTAL.unlockLevel}`, {
    height: 1.4,
    px: 80,
    fill: ['#ffb0b0', '#ff4a4a'],
    stroke: '#3a0000',
  })
  lock.object.position.set(0, 3.7, 3)
  lock.object.visible = false
  g.add(lock.object)
  return {
    update() {
      const dx = player.position.x - x
      const dz = player.position.z - z
      lock.object.visible = state.level < WORLD_PORTAL.unlockLevel && dx * dx + dz * dz < WORLD_PORTAL.near ** 2
    },
  }
}

// --- Training mounds -------------------------------------------------------------

const REBIRTH_ICON = loadIcon(`${import.meta.env.BASE_URL}UI/rebirth.png`)

function mound(parent, x, y, z, { color, cost, mult, lava = false }, seed, floorAt) {
  const g = placed(parent, x, y, z)
  const pc = new Color(color)
  g.add(mesh(new BoxGeometry(3.6, 0.16, 3.6), std('#' + pc.clone().multiplyScalar(0.55).getHexString()), 0, 0.08, 0))
  g.add(mesh(new BoxGeometry(3.1, 0.18, 3.1), std('#' + pc.clone().lerp(new Color('#ffffff'), 0.35).getHexString()), 0, 0.09, 0))
  const pile = createTrainingPile({ x, y, z, color, lava, seed, floorAt })
  g.add(pile.group)
  const lines = []
  lines.push(cost ? { text: `${cost}`, px: 54, fill: '#ff9cf0', icon: REBIRTH_ICON } : { text: 'FREE', px: 54, fill: '#9cff7a' })
  lines.push({ text: `x${mult} Power`, px: 62, fill: '#ffffff' })
  const label = textLabel(lines, { height: lines.length > 1 ? 1.1 : 0.6 })
  label.object.position.set(0, 2.6, 0)
  g.add(label.object)
  return pile
}

// --- Vacuum showcase ------------------------------------------------------------

const TWIN = VACUUMS.find((v) => v.id === 'twin')
// Banner line: the unlock level until reached, then the price.
const twinPriceLine = () =>
  state.level < TWIN.unlockLevel
    ? { text: `Unlocks at Level ${TWIN.unlockLevel}`, px: 60, fill: ['#ffb0b0', '#ff4a4a'], stroke: '#3a0000' }
    : { text: `$${shortMoney(TWIN.cost)}`, px: 60, fill: ['#fff27a', '#ffb81a'], stroke: '#3a2a00' }
const twinBanner = () => [
  { text: 'Twin Turbine Vacuum', px: 64, fill: ['#ff9cf0', '#e43cc8'] },
  { text: 'Always 400% Better!', px: 56, fill: ['#9cff7a', '#3ad21a'] },
  twinPriceLine(),
]

function vacuumModel() {
  const g = new Group()
  const paint = std('#f39a2a', { metalness: 0.55, roughness: 0.3 })
  const purple = std('#7f77c4', { metalness: 0.7, roughness: 0.28, side: DoubleSide })
  const dark = std('#1d1d28', { metalness: 0.6, roughness: 0.5 })
  const chrome = std('#e8ecf4', { metalness: 1, roughness: 0.14 })
  const steel = std('#aeb4c2', { metalness: 0.9, roughness: 0.3 })
  const glowPink = new MeshBasicMaterial({ color: '#ff7ae8' })
  const hotMat = new MeshBasicMaterial({ color: '#ffb24a' })

  // Chassis: painted body on a dark skid, side louvres, a glowing seam.
  g.add(mesh(new BoxGeometry(1.0, 0.9, 2.0), paint, 0, 0, 0))
  g.add(mesh(new BoxGeometry(1.1, 0.14, 2.1), dark, 0, -0.5, 0))
  g.add(mesh(new BoxGeometry(1.04, 0.05, 1.5), glowPink, 0, 0.02, 0.05))
  for (let i = 0; i < 6; i++) g.add(mesh(new BoxGeometry(1.02, 0.05, 0.22), dark, 0, 0.3, -0.7 + i * 0.28))

  const fans = []
  const fans2 = []
  for (const s of [-1, 1]) {
    const x = s * 0.95
    // Turbine housing with a chrome bell-mouth, rear ring, bolts and a pink light band.
    const t = mesh(new CylinderGeometry(0.72, 0.72, 1.7, 40, 1, true), purple, x, 0, 0.1)
    t.rotation.x = Math.PI / 2
    g.add(t)
    g.add(mesh(new TorusGeometry(0.78, 0.13, 14, 40), chrome, x, 0, 0.98))
    g.add(mesh(new TorusGeometry(0.73, 0.09, 10, 36), paint, x, 0, -0.75))
    g.add(mesh(new TorusGeometry(0.73, 0.025, 8, 48), glowPink, x, 0, 0.35))
    for (let b = 0; b < 12; b++) {
      const a = (b / 12) * Math.PI * 2
      g.add(mesh(new SphereGeometry(0.035, 8, 6), steel, x + Math.cos(a) * 0.78, Math.sin(a) * 0.78, 1.04, false))
    }
    // Inner dark bore and fixed stator vanes.
    g.add(mesh(new CylinderGeometry(0.66, 0.66, 1.0, 32, 1, true), dark, x, 0, 0.45).rotateX(Math.PI / 2))
    for (let v = 0; v < 10; v++) {
      const vane = mesh(new BoxGeometry(0.03, 0.55, 0.28), steel, 0, 0, 0, false)
      const a = (v / 10) * Math.PI * 2
      vane.position.set(x + Math.sin(a) * 0.36, Math.cos(a) * 0.36, 0.3)
      vane.rotation.z = -a
      vane.rotation.y = 0.3
      g.add(vane)
    }
    // Rear stage (small, counter-rotating) and the big front fan.
    const rear = new Group()
    rear.position.set(x, 0, 0.55)
    for (let b = 0; b < 14; b++) {
      const blade = mesh(new BoxGeometry(0.07, 0.48, 0.02), steel, 0, 0, 0, false)
      blade.rotation.z = (b / 14) * Math.PI * 2
      blade.position.set(Math.sin(blade.rotation.z) * -0.26, Math.cos(blade.rotation.z) * 0.26, 0)
      blade.rotation.y = 0.5
      rear.add(blade)
    }
    g.add(rear)
    fans2.push(rear)

    const fan = new Group()
    fan.position.set(x, 0, 0.88)
    fan.add(mesh(new CircleGeometry(0.66, 32), dark, 0, 0, -0.02, false))
    for (let b = 0; b < 12; b++) {
      const blade = mesh(new BoxGeometry(0.13, 0.6, 0.025), chrome, 0, 0, 0, false)
      blade.rotation.z = (b / 12) * Math.PI * 2
      blade.position.set(Math.sin(blade.rotation.z) * -0.32, Math.cos(blade.rotation.z) * 0.32, 0)
      blade.rotation.y = 0.45 // pitched like a real fan blade
      fan.add(blade)
    }
    fan.add(mesh(new CylinderGeometry(0.14, 0.14, 0.12, 20), steel, 0, 0, 0, false).rotateX(Math.PI / 2))
    const spinner = mesh(new ConeGeometry(0.14, 0.34, 20), chrome, 0, 0, 0.2, false)
    spinner.rotation.x = Math.PI / 2
    fan.add(spinner)
    g.add(fan)
    fans.push(fan)
  }

  // Carry handle and the exhaust nozzle with a white-hot throat.
  const handle = mesh(new TorusGeometry(0.5, 0.1, 10, 20, Math.PI), paint, 0, 0.45, -0.3)
  handle.rotation.y = Math.PI / 2
  g.add(handle)
  const nozzle = mesh(new CylinderGeometry(0.3, 0.45, 1.2, 28, 1, true), purple, 0, -0.1, -1.4)
  nozzle.rotation.x = Math.PI / 2
  g.add(nozzle)
  g.add(mesh(new TorusGeometry(0.3, 0.07, 10, 28), chrome, 0, -0.1, -2.0))
  g.add(mesh(new TorusGeometry(0.45, 0.06, 10, 28), paint, 0, -0.1, -0.82))
  g.add(mesh(new CircleGeometry(0.27, 24), hotMat, 0, -0.1, -1.98, false).rotateY(Math.PI))
  for (const s of [-1, 1]) g.add(mesh(new BoxGeometry(0.1, 0.1, 1.3), steel, s * 0.45, -0.38, -0.3)) // side pipes

  g.userData.fans = fans
  g.userData.fans2 = fans2
  g.userData.fx = turbineFx(g)
  return g
}

// Extreme-speed look for the showcase: fan blur, glowing wind funnels pulling air into both
// intakes, a roaring hot exhaust jet with shock diamonds, speed lines, spiralling light motes,
// leaves sucked in, and dust swirling round the base. Additive and in the model's space, so it
// all turns and bobs with it.
let glowTexCache
function glowTexture() {
  if (glowTexCache) return glowTexCache
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.3, 'rgba(255,255,255,0.5)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = gr
  x.fillRect(0, 0, 64, 64)
  glowTexCache = new CanvasTexture(c)
  glowTexCache.colorSpace = SRGBColorSpace
  return glowTexCache
}
// A disc of faint sweeping wedges: reads as spinning blades smeared by speed.
function blurTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')
  x.translate(64, 64)
  for (let i = 0; i < 24; i++) {
    x.fillStyle = `rgba(255,255,255,${i % 2 ? 0.1 : 0.4})`
    x.beginPath()
    x.moveTo(0, 0)
    x.arc(0, 0, 62, (i / 24) * Math.PI * 2, ((i + 1) / 24) * Math.PI * 2)
    x.fill()
  }
  const gr = x.createRadialGradient(0, 0, 8, 0, 0, 62)
  gr.addColorStop(0, 'rgba(255,255,255,0.9)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  x.globalCompositeOperation = 'destination-in'
  x.fillStyle = gr
  x.fillRect(-64, -64, 128, 128)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}
// Wrapped streaks for the airflow cones: u runs round the cone, v along it; dashes fade at both ends.
function streakTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')
  for (let i = 0; i < 90; i++) {
    const u = Math.random() * 256
    const v = Math.random() * 256
    const len = 30 + Math.random() * 90
    const gr = x.createLinearGradient(0, v, 0, v + len)
    gr.addColorStop(0, 'rgba(255,255,255,0)')
    gr.addColorStop(0.5, `rgba(255,255,255,${0.4 + Math.random() * 0.6})`)
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = gr
    const w = 1 + Math.random() * 2.5
    x.fillRect(u, v, w, len)
    if (v + len > 256) x.fillRect(u, v - 256, w, len) // wrap
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  return t
}
function leafTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const x = c.getContext('2d')
  x.fillStyle = '#fff'
  x.beginPath()
  x.ellipse(16, 16, 6, 12, 0.6, 0, Math.PI * 2)
  x.fill()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

function turbineFx(g) {
  const add = { transparent: true, depthWrite: false, blending: AdditiveBlending }
  const hot = new Color('#ff7ae8')
  const cool = new Color('#7ad8ff')
  const white = new Color('#ffffff')
  const flame = new Color('#ff6a2a')
  const tmp = new Color()
  const sides = [-1, 1]
  const FRONT = 0.95 // intake plane (z)
  const NOZ = -2.0 // nozzle mouth (z)
  const fans = g.userData.fans
  const fans2 = g.userData.fans2

  // Fan blur discs + glow, spinning with each fan.
  const blurTex = blurTexture()
  const blurs = fans.map((fan) => {
    const b = new Mesh(new CircleGeometry(0.74, 32), new MeshBasicMaterial({ map: blurTex, color: '#c8b8ff', side: DoubleSide, ...add, opacity: 0.7 }))
    b.position.z = 0.1
    fan.add(b)
    return b
  })
  const flares = sides.map((s) => {
    const f = new Sprite(new SpriteMaterial({ map: glowTexture(), color: hot, ...add, opacity: 0.8 }))
    f.position.set(s * 0.95, 0, FRONT + 0.15)
    f.scale.setScalar(2.2)
    g.add(f)
    return f
  })
  const nozFlare = new Sprite(new SpriteMaterial({ map: glowTexture(), color: '#ffb04a', ...add, opacity: 0.8 }))
  nozFlare.position.set(0, -0.1, NOZ - 0.1)
  nozFlare.scale.setScalar(2.2)
  g.add(nozFlare)

  // Wind funnels: streaky translucent cones, scrolling and swirling into each intake.
  const streak = streakTexture()
  const funnels = sides.map((s) => {
    const tex = streak.clone()
    tex.needsUpdate = true
    const geo = new CylinderGeometry(1.7, 0.72, 3.6, 40, 1, true).rotateX(Math.PI / 2)
    const m = new Mesh(geo, new MeshBasicMaterial({ map: tex, color: '#a8e8ff', side: DoubleSide, ...add, opacity: 0.55 }))
    m.position.set(s * 0.95, 0, FRONT + 1.8)
    g.add(m)
    return m
  })
  // The exhaust jet: a hot cone streaming away from the nozzle.
  const jetTex = streak.clone()
  jetTex.needsUpdate = true
  const jet = new Mesh(
    new CylinderGeometry(1.3, 0.28, 5, 36, 1, true).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ map: jetTex, color: '#ffa04a', side: DoubleSide, ...add, opacity: 0.6 }),
  )
  jet.position.set(0, -0.1, NOZ - 2.5)
  g.add(jet)
  const jetCore = new Mesh(
    new CylinderGeometry(0.55, 0.18, 4, 24, 1, true).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ color: '#fff0c0', side: DoubleSide, ...add, opacity: 0.22 }),
  )
  jetCore.position.set(0, -0.1, NOZ - 2)
  g.add(jetCore)
  const diamonds = [0.7, 1.5, 2.4, 3.4].map((d, i) => {
    const s = new Sprite(new SpriteMaterial({ map: glowTexture(), color: '#ffe6b0', ...add, opacity: 0.8 }))
    s.position.set(0, -0.1, NOZ - d)
    s.userData.base = 0.75 - i * 0.12
    g.add(s)
    return s
  })

  // Shock rings rolling off each intake.
  const rings = []
  for (const s of sides) {
    for (let i = 0; i < 4; i++) {
      const r = new Mesh(new RingGeometry(0.85, 0.92, 48), new MeshBasicMaterial({ color: cool, side: DoubleSide, ...add }))
      r.position.set(s * 0.95, 0, FRONT)
      g.add(r)
      rings.push({ r, s, f: i / 4 })
    }
  }

  // Speed lines converging on the intakes.
  const LINES = 44
  const lineGeo = new BufferGeometry()
  const lineCount = LINES * 2 * 2
  lineGeo.setAttribute('position', new BufferAttribute(new Float32Array(lineCount * 3), 3))
  lineGeo.setAttribute('color', new BufferAttribute(new Float32Array(lineCount * 3), 3))
  const lines = new LineSegments(lineGeo, new LineBasicMaterial({ vertexColors: true, ...add }))
  lines.frustumCulled = false
  g.add(lines)
  const lineSeeds = Array.from({ length: LINES * 2 }, (_, i) => ({ s: sides[i % 2], a: Math.random() * 6.28, f: Math.random(), v: 1.4 + Math.random() * 1.4, r: 0.15 + Math.random() * 0.8 }))

  const mk = (n, size, extra = {}) => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3))
    geo.setAttribute('color', new BufferAttribute(new Float32Array(n * 3), 3))
    const p = new Points(geo, new PointsMaterial({ map: glowTexture(), size, vertexColors: true, ...add, ...extra }))
    p.frustumCulled = false
    g.add(p)
    return p
  }
  const IN = 110
  const OUT = 130
  const DUST = 48
  const LEAVES = 36
  const motes = mk(IN, 0.2)
  const sparks = mk(OUT, 0.24)
  const dust = mk(DUST, 0.7, { opacity: 0.35 })
  const leavesGeo = new BufferGeometry()
  leavesGeo.setAttribute('position', new BufferAttribute(new Float32Array(LEAVES * 3), 3))
  leavesGeo.setAttribute('color', new BufferAttribute(new Float32Array(LEAVES * 3), 3))
  const leaves = new Points(leavesGeo, new PointsMaterial({ map: leafTexture(), size: 0.2, vertexColors: true, transparent: true, alphaTest: 0.4, depthWrite: false }))
  leaves.frustumCulled = false
  g.add(leaves)
  const moteSeeds = Array.from({ length: IN }, (_, i) => ({ s: sides[i % 2], a: Math.random() * 6.28, f: Math.random(), v: 0.8 + Math.random() * 0.9 }))
  const sparkSeeds = Array.from({ length: OUT }, () => ({ a: Math.random() * 6.28, f: Math.random(), v: 1.1 + Math.random() * 1.5, r: Math.random() * 0.3 }))
  const dustSeeds = Array.from({ length: DUST }, () => ({ a: Math.random() * 6.28, r: 1.4 + Math.random() * 2.2, v: 1.5 + Math.random() * 2, y: Math.random() * 0.5 }))
  const leafSeeds = Array.from({ length: LEAVES }, (_, i) => ({ s: sides[i % 2], a: Math.random() * 6.28, f: Math.random(), v: 0.5 + Math.random() * 0.5, c: new Color().setHSL(0.08 + Math.random() * 0.25, 0.7, 0.35 + Math.random() * 0.15) }))

  return {
    update(t) {
      for (const b of blurs) b.rotation.z = -t * 38
      fans2.forEach((f, i) => (f.rotation.z = -t * 60 * (i ? 1 : 1.03)))
      const pulse = 0.5 + 0.5 * Math.sin(t * 17)
      flares.forEach((f, i) => {
        f.scale.setScalar(2.0 + pulse * 0.5 + Math.sin(t * 9 + i) * 0.1)
        f.material.opacity = 0.55 + pulse * 0.35
      })
      nozFlare.scale.setScalar(2.0 + Math.sin(t * 23) * 0.35)
      nozFlare.material.opacity = 0.6 + Math.sin(t * 31) * 0.25

      funnels.forEach((f, i) => {
        f.material.map.offset.y = -t * 1.6 // streaks race toward the intake
        f.rotation.z = t * (i ? -2.4 : 2.4)
        f.material.opacity = 0.45 + pulse * 0.2
      })
      jet.material.map.offset.y = t * 2.4 // and out of the nozzle
      jet.rotation.z = t * 3
      jet.material.opacity = 0.5 + Math.sin(t * 29) * 0.12
      jetCore.material.opacity = 0.18 + Math.sin(t * 41) * 0.08
      jetCore.scale.set(1 + Math.sin(t * 37) * 0.08, 1 + Math.sin(t * 37) * 0.08, 1)
      diamonds.forEach((d, i) => {
        d.scale.setScalar(0.5 + 0.35 * Math.abs(Math.sin(t * 26 + i * 1.7)))
        d.material.opacity = d.userData.base * (0.6 + 0.4 * Math.sin(t * 33 + i))
      })

      for (const k of rings) {
        const u = (t * 1.1 + k.f) % 1
        k.r.position.z = FRONT + 0.1 + (1 - u) * 2.8
        k.r.scale.setScalar(0.35 + u * 1.2)
        k.r.material.opacity = Math.sin(u * Math.PI) * 0.5
      }

      const lp = lines.geometry.attributes.position
      const lc = lines.geometry.attributes.color
      lineSeeds.forEach((l, i) => {
        const u = (t * l.v * 0.9 + l.f) % 1
        const d = (1 - u) * 4
        const rad = (0.08 + d * 0.3) * (0.5 + l.r)
        const ang = l.a + u * 2.6
        const head = FRONT + 0.05 + d
        const tail = head + 0.6 + u * 0.8
        const x = l.s * 0.95
        const px = Math.cos(ang) * rad
        const py = Math.sin(ang) * rad
        lp.setXYZ(i * 2, x + px, py, head)
        lp.setXYZ(i * 2 + 1, x + px * 1.1, py * 1.1, tail)
        const fade = Math.sin(u * Math.PI)
        tmp.copy(cool).lerp(white, u)
        lc.setXYZ(i * 2, tmp.r * fade, tmp.g * fade, tmp.b * fade)
        lc.setXYZ(i * 2 + 1, 0, 0, 0)
      })
      lp.needsUpdate = true
      lc.needsUpdate = true

      const mp = motes.geometry.attributes.position
      const mc = motes.geometry.attributes.color
      moteSeeds.forEach((m, i) => {
        const u = (t * 0.6 * m.v + m.f) % 1
        const d = (1 - u) ** 1.3 * 3.2 // accelerates as it nears the fan
        const rad = 0.05 + d * 0.32
        const ang = m.a + u * 13
        mp.setXYZ(i, m.s * 0.95 + Math.cos(ang) * rad, Math.sin(ang) * rad, FRONT + 0.05 + d)
        const fade = Math.sin(u * Math.PI) ** 1.4
        tmp.copy(hot).lerp(cool, u)
        mc.setXYZ(i, tmp.r * fade, tmp.g * fade, tmp.b * fade)
      })
      mp.needsUpdate = true
      mc.needsUpdate = true

      const lvp = leaves.geometry.attributes.position
      const lvc = leaves.geometry.attributes.color
      leafSeeds.forEach((l, i) => {
        const u = (t * 0.35 * l.v + l.f) % 1
        const d = (1 - u) ** 1.6 * 3.6
        const rad = 0.1 + d * 0.4
        const ang = l.a + u * 9 + Math.sin(t * 5 + i) * 0.3
        lvp.setXYZ(i, l.s * 0.95 + Math.cos(ang) * rad, Math.sin(ang) * rad, FRONT + 0.1 + d)
        const k = Math.min(1, (1 - u) * 5) // shrink to nothing into the blades
        lvc.setXYZ(i, l.c.r * k, l.c.g * k, l.c.b * k)
      })
      lvp.needsUpdate = true
      lvc.needsUpdate = true

      const sp = sparks.geometry.attributes.position
      const sc = sparks.geometry.attributes.color
      sparkSeeds.forEach((s, i) => {
        const u = (t * 0.9 * s.v + s.f) % 1
        const spread = s.r + u * 0.9
        sp.setXYZ(i, Math.cos(s.a + t * 3) * spread, -0.1 + Math.sin(s.a + t * 3) * spread, NOZ - u * 5)
        const fade = (1 - u) ** 1.3
        tmp.set('#fff2b0').lerp(flame, Math.min(1, u * 1.6)).lerp(hot, Math.max(0, u - 0.6))
        sc.setXYZ(i, tmp.r * fade, tmp.g * fade, tmp.b * fade)
      })
      sp.needsUpdate = true
      sc.needsUpdate = true

      const dp = dust.geometry.attributes.position
      const dc = dust.geometry.attributes.color
      dustSeeds.forEach((d, i) => {
        const a = d.a + t * d.v
        dp.setXYZ(i, Math.cos(a) * d.r, -2.0 + d.y + Math.sin(t * 3 + i) * 0.1, Math.sin(a) * d.r)
        const k = 0.5 + 0.5 * Math.sin(t * 2 + i)
        dc.setXYZ(i, 0.75 * k, 0.65 * k, 0.5 * k)
      })
      dp.needsUpdate = true
      dc.needsUpdate = true
    },
  }
}

// --- Assembly -------------------------------------------------------------------------

export function buildProps(scene) {
  const root = new Group()
  scene.add(root)
  const npcs = []

  // North: Worlds portal, Sell Loot with the three leaderboards behind it.
  const worldPortal = portal(root, -17, -21, facing(-17, -21, 0, 4))
  npcs.push(stand(root, { x: SELL_STAND.x, z: SELL_STAND.z, rot: 0.08, awning: ['#2fd14a', '#f4f4f4'], title: 'Sell Loot', titleFill: ['#f6ff7a', '#b6f22a', '#5fc81a'] }))
  leaderboard(root, -6, -22.5, 0.05, 'power', 'Power', ['#ffe48a', '#f6a21a'], 'Power', '#ffb23a')
  leaderboard(root, 4.5, -24, 0, 'rebirths', 'Rebirths', ['#ff8a8a', '#e2222a'], 'Rebirths', '#ff5a5a')
  leaderboard(root, 14, -23, -0.2, 'leaves', 'Leaves Cleaned', ['#c4ff7a', '#4cc81a'], 'Leaves', '#7aff4a')
  leaderboard(root, 23, -23.5, -0.3, 'level', 'Levels', ['#a8e4ff', '#1f9bff'], 'Level', '#62c4ff')

  // Beside the west opening (left as you walk out to the field): the controls reference.
  const controls = controlsBoard(root, -23, 19.5, facing(-23, 19.5, 0, 4))
  window.addEventListener('controls-done', () => controls.show(5)) // hud.js, after the guide is completed

  // East: Auras, Upgrades.
  npcs.push(stand(root, { x: AURA_STAND.x, z: AURA_STAND.z, rot: facing(AURA_STAND.x, AURA_STAND.z, 0, 4), awning: ['#ff3fd0', '#f4f4f4'], title: 'Auras', titleFill: ['#ffb4f0', '#ff4fc8', '#d61f9e'], npcLook: 'girl' }))

  // South: training mounds on a two-step plinth, feedback board, Vacuums.
  const H = 28
  const plinth = studMat('#9a8fe0', '#8b7fd6', 2)
  const px0 = -7.5
  const pw = H - px0
  // Three terraces climbing toward the south wall; each strip is one row of mounds.
  const tiers = [
    { d: 11, top: 0.5 },
    { d: 7.4, top: 1.0 },
    { d: 3.8, top: 1.5 },
  ]
  for (const t of tiers) {
    root.add(mesh(worldBox(pw, t.top, t.d), plinth, px0 + pw / 2, t.top / 2, H - t.d / 2))
    addCollider(px0 + pw / 2, H - t.d / 2, pw, t.d, t.top)
  }
  // Two rows, listed in screen order from the spawn view (screen-left = +x): the front row on the
  // lowest terrace, the back row on the top one, with the middle terrace left open between them.
  // `cost` = rebirths needed to train here (0 = free), like the Train Strength trees in the
  // Chop Trees game. The R$ mounds had no rebirth count, so they follow that game's ladder
  // (x10 -> 14, x25 -> 17, x100 -> 20, x300 -> 25, x1000 -> 30).
  const mounds = [
    { color: '#9a3ae0', cost: 8, mult: 6, tier: 0 },
    { color: '#c040e8', cost: 5, mult: 4, tier: 0 },
    { color: '#e8262a', cost: 14, mult: 10, tier: 0 },
    { color: '#2a5ee8', cost: 2, mult: 2, tier: 0 },
    { color: '#1fa88a', cost: 0, mult: 1.5, tier: 0 },
    { color: '#2fb040', cost: 25, mult: 300, tier: 2 },
    { color: '#ffd21f', cost: 17, mult: 25, tier: 2 },
    { color: '#3fd8ff', cost: 11, mult: 8, tier: 2 },
    { color: '#a01818', cost: 20, mult: 100, tier: 2 },
    { color: '#ff6a10', cost: 30, mult: 1000, lava: true, tier: 2 },
  ]
  const lavaMats = []
  const piles = []
  const pads = []
  const floorAt = (wx, wz) => (wx < px0 || wx > H ? 0 : tiers.reduce((top, t) => (wz >= H - t.d ? Math.max(top, t.top) : top), 0))
  const rowX = (i) => 25 - (i % 5) * 6.2 // five per row, screen-left (+x) first
  mounds.forEach((m, i) => {
    const ti = m.tier
    const mx = rowX(i) - (ti === 2 ? 1.5 : 0)
    const mz = H - tiers[ti].d + 1.9
    const pile = mound(root, mx, tiers[ti].top, mz, m, i + 1, floorAt)
    piles.push(pile)
    pads.push({ x: mx, z: mz, top: tiers[ti].top, cost: m.cost, mult: m.mult, pile })
    if (m.lava) lavaMats.push(pile.leafMat, pile.coreMat)
  })
  const zone = textLabel(
    [
      { text: 'Training Zone', px: 110, fill: ['#ffffff', '#e8e8f0'], stroke: '#6a6a80' },
      { text: 'Gain Passive Strength', px: 70, fill: ['#8cff5a', '#3cc81a'], stroke: '#14400a' },
    ],
    { height: 4.8, billboard: false },
  )
  zone.object.material.opacity = 0.85
  // Clear of the wall's drip planes (at H - 0.05) so the leaves don't cut through the text.
  zone.object.position.set(17, 7.4, H - 0.4)
  zone.object.rotation.y = Math.PI
  root.add(zone.object)

  // One row along the south wall in front of the mounds, screen-left (+x) to right: Upgrades,
  // feedback board, Vacuums, twin turbine.
  npcs.push(stand(root, { x: 16, z: 12, rot: Math.PI, awning: ['#2f8cff', '#f4f4f4'], title: 'Upgrades', titleFill: ['#8fe0ff', '#2f9cff', '#1a5ee0'] }))

  const fb = placed(root, 9, 0, 12.5, facing(9, 12.5, 0, 4))
  const fbWood = std(C.boardWood)
  for (const s of [-1.35, 1.35]) fb.add(mesh(new BoxGeometry(0.35, 3.2, 0.35), fbWood, s, 1.6, 0))
  fb.add(mesh(new BoxGeometry(3.0, 0.3, 0.35), fbWood, 0, 3.1, 0))
  const fbPanel = panel(
    256,
    200,
    (ctx, w, h) => {
      ctx.fillStyle = '#5b2a6e'
      ctx.fillRect(0, 0, w, h)
      ;['Send us your', 'Feedback or', 'Ideas !'].forEach((t, i) =>
        drawText(ctx, t, w / 2, 50 + i * 50, { px: 34, fill: '#ffffff', stroke: null }),
      )
    },
    { height: 2.0, width: 2.4 },
  )
  fbPanel.object.position.set(0, 1.9, 0.2)
  fb.add(fbPanel.object)
  addCollider(9, 12.5, 3.1, 0.6, 3.3, facing(9, 12.5, 0, 4))

  npcs.push(stand(root, { x: 2, z: 12, rot: Math.PI, awning: ['#ee2a2a', '#f4f4f4'], title: 'Vacuums', titleFill: ['#ffb05a', '#ff5a1a', '#e2261a'], titleStroke: '#3a0a00' }))

  // Southwest: twin turbine showcase.
  const vac = vacuumModel()
  vac.position.set(-16.5, 2.4, 24)
  vac.scale.setScalar(1.15)
  root.add(vac)
  const vacLabel = textLabel(twinBanner(), { height: 1.9 })
  let twinLevel = state.level
  vacLabel.object.position.set(-16.5, 4.9, 24)
  root.add(vacLabel.object)
  root.add(mesh(new CylinderGeometry(1.2, 1.4, 0.3, 24), std('#6a5fc0'), -16.5, 0.15, 24))
  addCollider(-16.5, 24, 2.4, 2.4, 0.3)

  // West: the field, its luck sign and countdown, and scattered loot.
  const luckSign = textLabel(
    [
      { text: 'Uncommon', px: 120, fill: ['#8cff5a', '#2cc81a'], stroke: '#0a3a0a' },
      { text: 'x1 Luck', px: 84, fill: ['#8cff5a', '#2cc81a'], stroke: '#0a3a0a' },
    ],
    { height: 5.5, billboard: false, doubleSided: false },
  )
  luckSign.object.position.set(-44, 5.5, 0)
  luckSign.object.rotation.y = Math.PI / 2
  root.add(luckSign.object)
  // One sign per further zone boundary: its Luck and the best loot tier it tends to drop.
  const ZONE_COUNT = LEAVES.zones.luck.length
  for (let zi = 1; zi < LEAVES.zones.luck.length; zi++) {
    const tier = zoneTier(zi, ZONE_COUNT)
    const { fill, glow } = RARITY[tier]
    const sign = textLabel(
      [
        { text: tier, px: 120, fill: [glow, fill], stroke: '#1a1a1a' },
        { text: `x${LEAVES.zones.luck[zi]} Luck`, px: 84, fill: [glow, fill], stroke: '#1a1a1a' },
      ],
      { height: 5.5, billboard: false, doubleSided: false },
    )
    sign.object.position.set(LEAVES.zones.edges[zi], 5.5, 0)
    sign.object.rotation.y = Math.PI / 2
    root.add(sign.object)
  }
  return {
    piles,
    pads,
    update(dt, t) {
      for (const pile of piles) pile.update(dt)
      controls.update(dt, t)
      worldPortal.update()
      for (const fan of vac.userData.fans) fan.rotation.z += dt * 40
      vac.userData.fx.update(t)
      if (state.level !== twinLevel) {
        twinLevel = state.level
        vacLabel.setLines(twinBanner())
      }
      vac.rotation.y += dt * 0.6
      // Hover with a fast, tiny engine shudder.
      vac.position.y = 2.4 + Math.sin(t * 1.5) * 0.15 + Math.sin(t * 60) * 0.012
      vac.rotation.z = Math.sin(t * 47) * 0.006
      for (const m of lavaMats) m.emissiveIntensity = 0.35 + Math.sin(t * 3) * 0.15
      npcs.forEach((n, i) => {
        const [l, r] = n.userData.arms
        l.rotation.x = Math.sin(t * 1.6 + i) * 0.08
        r.rotation.x = -Math.sin(t * 1.6 + i) * 0.08
      })
    },
  }
}

