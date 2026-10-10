// A procedural handheld leaf blower held in the player's right hand. Built in
// the avatar root's local (rig-unit) space, then parented to ArmR1 with the
// bone's bind-pose world transform cancelled out, so it sits the same on the
// procedural character and on player.glb (whose limb frames are twisted) and
// then swings with the arm.
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { buildVacuum } from '../vacuumModels.js'

const mats = {}
function material(key, color, extra) {
  return (mats[key] ||= new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...extra }))
}

function mesh(geo, mat, x, y, z, rx = 0) {
  const m = new Mesh(geo, mat)
  m.position.set(x, y, z)
  m.rotation.x = rx
  m.castShadow = true
  return m
}

// Nozzle points +Z (the character's forward), grip hangs along -Y.
function buildBlower() {
  const g = new Group()
  g.name = 'air_blower'
  const orange = material('orange', 0xf2762e)
  const dark = material('dark', 0x2b2f36)
  const grey = material('grey', 0xb8bec6)
  const q = Math.PI / 2

  // Grip + trigger guard, in the fist.
  g.add(mesh(new CylinderGeometry(0.2, 0.2, 0.9, 12), dark, 0, 0, 0))
  g.add(mesh(new BoxGeometry(0.14, 0.3, 0.1), dark, 0, 0.05, 0.28))
  // Motor housing above the grip.
  g.add(mesh(new CylinderGeometry(0.55, 0.55, 1.1, 16), orange, 0, 0.7, -0.15, q))
  g.add(mesh(new CylinderGeometry(0.4, 0.4, 0.1, 16), grey, 0, 0.7, -0.72, q)) // intake grille
  // Tube + flared nozzle pointing forward.
  g.add(mesh(new CylinderGeometry(0.28, 0.34, 1.4, 14), grey, 0, 0.7, 1.1, q))
  g.add(mesh(new ConeGeometry(0.34, 0.5, 14, 1, true), dark, 0, 0.7, 2.0, -q))
  return g
}

// Attach to `avatar` (a character group with `nodes`). Returns the blower, or
// null if the rig has no right arm.
export function attachBlower(avatar) {
  const arm = avatar?.nodes?.ArmR1
  if (!arm) return null
  const blower = buildBlower()

  avatar.updateMatrixWorld(true)
  const rootInv = new Matrix4().copy(avatar.matrixWorld).invert()
  const boneRel = new Matrix4().multiplyMatrices(rootInv, arm.matrixWorld)
  const bonePos = new Vector3().setFromMatrixPosition(boneRel)
  // Hand = the bottom of the arm (2.4 rig units below the shoulder pivot).
  const hand = bonePos.clone().add(new Vector3(0, -2.1, 0.1))
  const local = new Matrix4().copy(boneRel).invert().multiply(new Matrix4().makeTranslation(hand.x, hand.y, hand.z))
  local.decompose(blower.position, blower.quaternion, blower.scale)
  arm.add(blower)
  return blower
}

// Swap what the hand holds for the equipped vacuum's model (replacing the current one).
// The model is built along +X; turn it to +Z and put its nozzle at the old tube mouth so the
// airflow origin (main.js NOZZLE_LOCAL) still lines up.
const HELD_SCALE = 1.1
export function setHeldVacuum(blower, id) {
  if (!blower || blower.userData.heldId === id) return
  blower.userData.heldId = id
  for (const c of [...blower.children]) blower.remove(c)
  blower.userData.spin = []
  blower.userData.glow = []
  const model = buildVacuum(id)
  const wrap = new Group()
  wrap.rotation.y = -Math.PI / 2
  wrap.scale.setScalar(HELD_SCALE)
  wrap.add(model.group)
  // After the turn, +X (nozzle end) is +Z: shift so the nozzle sits at z = 2.25, height 0.7.
  wrap.position.set(0, 0.7, 2.25 - model.front * HELD_SCALE)
  wrap.traverse((o) => { if (o.isMesh) o.castShadow = true })
  blower.add(wrap)
  blower.userData.spin = model.spin
  blower.userData.glow = model.glow
}

export function animateHeldVacuum(blower, t) {
  if (!blower) return
  for (const s of blower.userData.spin ?? []) s.obj.rotation[s.axis] = t * s.speed
}
