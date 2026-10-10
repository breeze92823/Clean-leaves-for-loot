import { Clock, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer, Group, PointLight } from 'three'
import { CAMERA, LEAVES, SPAWN, SPAWN_FACING } from './config.js'
import * as bloxity from './bloxity.js'
import { inputState, install as installInput } from './input.js'
import { player, resetPlayer, step as stepPlayer } from './player.js'
import { setFovExtra, syncYawToPlayer, update as updateCamera } from './camera.js'
import { createLeaves } from './leaves.js'
import { createLoot } from './loot.js'
import { createFallingLeaves } from './fallingLeaves.js'
import { state, notify, trainPower, resetTrainTimer } from './state.js'
import { blowPad, noticePad, padAt, padUnlocked, setPads } from './trainPads.js'
import { resolveInteract } from './interact.js'
import { updateSell } from './sell.js'
import { updateUpgrades } from './upgrades.js'
import { updateVacuums } from './vacuums.js'
import { updateAuras } from './auras.js'
import { buildAuraFx } from './auraFx.js'
import { createFog, createGround, createLights, createSky } from './world.js'
import { buildHub } from './hub.js'
import { buildProps } from './props.js'
import { playerScreen } from './screenPos.js'
import { createHud } from './hud.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { attachBlower, setHeldVacuum, animateHeldVacuum } from './avatar/blower.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { initNet, sendPose, syncAvatar } from './net.js'
import { createRemotePlayers } from './remotePlayers.js'
import { createLoading, markLoaded } from './loading.js'
import { createTutorial } from './tutorial.js'
import { installClickSound } from './clickSound.js'
import { createLoginButton } from './login.js'
import { createTouchControls } from './touch.js'
import { isTouch } from './device.js'

// --- Bloxity + player state -----------------------------------------------
createLoading()
createLoginButton()
bloxity.init()
resetPlayer(SPAWN, SPAWN_FACING)
syncYawToPlayer()

// --- Renderer / scene -------------------------------------------------------
const GRAPHICS_PRESETS = {
  Low: { shadows: false, antialias: false, dpr: 1, leaves: 0.4 },
  Medium: { shadows: true, antialias: false, dpr: 1.5, leaves: 0.7 },
  High: { shadows: true, antialias: true, dpr: 2, leaves: 1 },
  Ultra: { shadows: true, antialias: true, dpr: 2, leaves: 1 },
}
const basePreset = GRAPHICS_PRESETS[bloxity.settings.graphics_quality] ?? GRAPHICS_PRESETS.High
// Phones: no MSAA, capped pixel ratio and fewer leaves keep a steady frame rate.
const preset = isTouch ? { ...basePreset, antialias: false, dpr: Math.min(basePreset.dpr, 1.5), leaves: Math.min(basePreset.leaves, 0.7) } : basePreset

const renderer = new WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.shadowMap.enabled = preset.shadows
renderer.shadowMap.type = PCFSoftShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr))
document.body.appendChild(renderer.domElement)
installInput(bloxity.showMenu, renderer.domElement)
installClickSound()

const scene = new Scene()
scene.fog = createFog()
const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
camera.position.set(0, 12, 24)

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

scene.add(createSky(), createGround())
const lights = createLights()
scene.add(lights.hemi, lights.sun, lights.sun.target)
buildHub(scene)
const props = buildProps(scene)
const leaves = createLeaves(scene, renderer, preset.leaves)
// Training mounds only react to the blower's airflow once unlocked (even from a distance).
const padOf = new Map(props.pads.map((p) => [p.pile, p]))
for (const pile of props.piles) {
  const pad = padOf.get(pile)
  if (!pad) {
    leaves.addTarget(pile.target)
    continue
  }
  const gated = Object.create(pile.target)
  gated.locked = () => !padUnlocked(pad)
  gated.blow = (...args) => pile.target.blow(...args)
  leaves.addTarget(gated)
}
setPads(props.pads)
const fallingLeaves = createFallingLeaves(scene, preset.leaves)
const loot = createLoot(scene, leaves.piles)
leaves.onPileCleared(loot.spawnFor)
leaves.onPileCleared(() => {
  state.leaves += LEAVES.piles.leavesPerPile
  notify()
})
createHud({ showMenu: bloxity.showMenu })
createTouchControls({ showMenu: bloxity.showMenu })
const tutorial = createTutorial(scene, loot)
const remotes = createRemotePlayers(scene)
initNet() // saves/loads progress and joins the shared room (no-op without a server)

// --- Player avatar ----------------------------------------------------------
// Always the game's own character (player.glb, or the procedural fallback). A
// signed-in player's equipped Bloxity cosmetics are attached to it and the
// customizer's body proportions applied; it rebuilds on customizer edits and
// sign-in/out.
const playerGroup = new Group()
scene.add(playerGroup)

// The equipped aura's light/particle show surrounds the player (auraFx.js); swapped on equip.
let auraId = null
let auraFx = null
const auraLamp = new PointLight(0xffffff, 0, 10, 2) // always in the scene so equipping never changes the light count
auraLamp.position.y = 1.2
playerGroup.add(auraLamp)
function syncAura() {
  if (state.aura === auraId) return
  auraId = state.aura
  if (auraFx) {
    playerGroup.remove(auraFx.group)
    auraFx.dispose()
    auraFx = null
  }
  if (auraId) {
    auraFx = buildAuraFx(auraId, { light: auraLamp })
    playerGroup.add(auraFx.group)
  }
}

let avatar = null
let blower = null
let animator = null
let generation = 0
let hubTime = 0 // s spent back in the hub since the field was last blown

function setAvatar(next) {
  if (avatar) playerGroup.remove(avatar)
  disposeAnimator(animator)
  avatar = next
  blower = attachBlower(avatar)
  setHeldVacuum(blower, state.vacuum)
  playerGroup.add(avatar)
  animator = makeAnimator(avatar)
}

setAvatar(buildDefaultCharacter()) // visible immediately; replaced once the rig loads

async function loadAvatar() {
  // The SDK fires twice per change (optimistic + confirmed); only the newest load may land.
  const mine = ++generation
  try {
    const group = await loadBaseCharacter()
    if (mine !== generation) return
    const equipped = bloxity.authState.user ? bloxity.getEquippedAvatar() : null
    await attachEquippedAccessories(group, equipped, { skinTextureUrl: bloxity.getSkinTextureUrl() })
    if (mine !== generation) return
    applyProportions(group, bloxity.getProportions())
    setAvatar(group)
  } finally {
    if (mine === generation) markLoaded('avatar')
  }
}

let signedIn = null
bloxity.subscribeAuth((s) => {
  const now = !!s.user
  if (now !== signedIn) {
    signedIn = now
    loadAvatar() // also runs once at start to swap in the real rig
  }
})
// The SDK event can precede the skin URL / proportions being current, so resend shortly after too.
let resyncTimer = 0
function syncAvatarSoon() {
  syncAvatar()
  clearTimeout(resyncTimer)
  resyncTimer = setTimeout(syncAvatar, 1000)
}
bloxity.onAvatarChanged(() => {
  loadAvatar()
  syncAvatarSoon()
})
bloxity.onProportionsChanged(() => {
  applyProportions(avatar, bloxity.getProportions())
  syncAvatarSoon()
})

bloxity.onSetting((key, value) => {
  if (key === 'graphics_quality') renderer.shadowMap.enabled = (GRAPHICS_PRESETS[value] ?? GRAPHICS_PRESETS.High).shadows
})

// --- Loop -------------------------------------------------------------------
const clock = new Clock()
const fwd = new Vector3()
const nozzle = new Vector3()
const chest = new Vector3()
const HUB_X = -30 // x of the plaza's west wall line; further east counts as the hub
const NOZZLE_LOCAL = new Vector3(0, 0.7, 2.25) // tube mouth in blower space (see avatar/blower.js)

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1) // clamp huge frames (tab switch, breakpoint)
  stepPlayer(dt)

  // Standing on an unlocked training pad blows by itself (sound, arm pose) and trains x its
  // multiplier; elsewhere only a held blow trains.
  const pad = padAt()
  noticePad(pad)
  const padTraining = !!pad && padUnlocked(pad)
  const padLocked = !!pad && !padTraining // a locked mound: clicking blows nothing
  const blowing = padTraining || (inputState.blow && !padLocked)
  player.autoBlow = padTraining

  playerGroup.position.set(player.position.x, player.position.y, player.position.z)
  playerGroup.rotation.y = player.facing // player.js turns the heading at a fixed rate
  animator?.update(dt, {
    grounded: player.grounded,
    speed: Math.hypot(player.velocity.x, player.velocity.z),
    verticalVelocity: player.velocity.y,
    turn: inputState.move.x,
    blowing,
  })
  sendPose(player, Math.hypot(player.velocity.x, player.velocity.z), blowing ? 'blow' : '')
  remotes.update(dt, clock.elapsedTime, player.position)
  setHeldVacuum(blower, state.vacuum) // no-op unless a different vacuum was equipped
  animateHeldVacuum(blower, clock.elapsedTime)
  syncAura()
  auraFx?.update(clock.elapsedTime, dt)
  playerGroup.updateMatrixWorld(true) // so the nozzle below follows this frame's pose

  // Airflow leaves the blower's mouth (falls back to chest height if the rig has none).
  fwd.set(0, 0, 1).applyQuaternion(playerGroup.quaternion)
  const chestY = player.position.y + 1.1
  if (blower) nozzle.copy(NOZZLE_LOCAL).applyMatrix4(blower.matrixWorld)
  if (!blower || !Number.isFinite(nozzle.x) || nozzle.distanceTo(playerGroup.position) > 3.5) {
    nozzle.set(player.position.x + fwd.x * 1, chestY, player.position.z + fwd.z * 1)
  }
  leaves.update(dt, clock.elapsedTime, nozzle, fwd, blowing, renderer.domElement.height)
  setFovExtra(leaves.power * LEAVES.blower.fovPunch)
  if (padTraining) {
    blowPad(pad, dt)
    trainPower(dt, pad.mult)
  } else if (blowing) trainPower(dt)
  else resetTrainTimer()

  // Back in the hub for a moment: the field regrows and loot left lying in it is lost.
  if (player.position.x > HUB_X && leaves.dirty) {
    hubTime += dt
    if (hubTime > LEAVES.piles.regrowDelay) {
      leaves.reset()
      loot.reset()
      hubTime = 0
    }
  } else hubTime = 0
  loot.update(dt, clock.elapsedTime)
  updateSell()
  updateUpgrades()
  updateVacuums()
  updateAuras()
  resolveInteract()
  tutorial.update(clock.elapsedTime)

  fallingLeaves.update(dt, clock.elapsedTime, player.position)
  props.update(dt, clock.elapsedTime)
  updateCamera(camera, dt)
  chest.set(player.position.x, player.position.y + 1.1, player.position.z).project(camera)
  playerScreen.x = chest.x * 0.5 + 0.5
  playerScreen.y = 0.5 - chest.y * 0.5
  lights.follow(player.position.x, player.position.z)
  renderer.render(scene, camera)
  markLoaded('scene')
})

window.addEventListener('beforeunload', bloxity.teardown)

// Dev-only console hook, e.g. __game.teleport(10, 0, -5)
if (import.meta.env.DEV) {
  window.__game = { player, state, leaves, loot, teleport: (x, y, z, facing = player.facing) => { resetPlayer({ x, y, z }, facing); syncYawToPlayer() } }
}
