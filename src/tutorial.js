// New-player tutorial: a banner under the level bar, a 3D guide (trail of arrowheads + bobbing beacon)
// toward where to go, and a bobbing UI arrow on the button to press. The step lives in
// state.tutorialStep, which net.js saves with the account; the server reports a saved account that
// predates the tutorial as finished, so only new accounts ever see it (state.tutorialReady gates it
// until that answer is in). The step machine itself is tutorialLogic.js.
import { ExtrudeGeometry, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Shape } from 'three'
import './tutorial.css'
import { DISABLE_TUTORIALS, LEAVES, SELL_STAND, TUTORIAL, VACUUM_STAND, VACUUMS } from './config.js'
import { player, floorAt } from './player.js'
import { notify, shortMoney, state, totalPower } from './state.js'
import { padWithMult } from './trainPads.js'
import { bagValue, payout, unlockedBag } from './sell.js'
import { nextStep } from './tutorialLogic.js'
import { isTouch } from './device.js'

const VACUUM = VACUUMS.find((v) => v.id === TUTORIAL.vacuum)
const ZONE1 = { x: (LEAVES.zones.edges[0] + LEAVES.zones.edges[1]) / 2, z: 0 }

const SPACING = 1.1 // m between trail arrows
const SPEED = 1.8 // m/s the trail crawls toward the target
const MAX_ARROWS = 140
const HIDE_WITHIN = 2.5 // m from the target where the trail disappears
const BEACON_HEIGHT = 4.5 // m above the ground the big arrow floats

// Where the UI arrow points on each step: [selector, side of the element it sits on].
const UI_TARGETS = {
  5: ['.shp [data-sell="all"]', 'top'],
  6: ['.shp [data-act="closeSell"]', 'left'],
  8: [`.vac [data-vacuum="${TUTORIAL.vacuum}"]`, 'top'],
}

export function createTutorial(scene, loot) {
  // --- Banner ----------------------------------------------------------------
  const banner = document.createElement('div')
  banner.className = 'anchor a-tut'
  banner.innerHTML = '<div class="tutorial" hidden><div class="tut-tag o-thin">TUTORIAL</div><div class="tut-text o"></div><div class="tut-sub o-thin"></div></div>'
  document.getElementById('hud')?.appendChild(banner)
  const box = banner.firstChild
  const tag = box.querySelector('.tut-tag')
  const text = box.querySelector('.tut-text')
  const sub = box.querySelector('.tut-sub')
  let shownKey = ''
  function paintBanner(key, t, s, complete = false) {
    if (key === shownKey) return
    const fresh = key.split('|')[0] !== shownKey.split('|')[0]
    shownKey = key
    box.hidden = !t
    box.classList.toggle('complete', complete)
    tag.textContent = complete ? 'DONE' : 'TUTORIAL'
    text.textContent = t ?? ''
    sub.textContent = s ?? ''
    sub.hidden = !s
    if (fresh) {
      box.style.animation = 'none'
      void box.offsetWidth // restart the pop-in
      box.style.animation = ''
    }
  }

  // --- UI arrow --------------------------------------------------------------
  const arrow = document.createElement('div')
  arrow.className = 'tut-arrow'
  arrow.innerHTML = '<svg viewBox="0 0 60 80"><path d="M18 4h24v34h14L30 76 4 38h14z" fill="#ffd23a" stroke="#121212" stroke-width="6" stroke-linejoin="round"/></svg>'
  arrow.hidden = true
  document.body.appendChild(arrow)
  let hl = null // the element currently glowing
  function clearUi() {
    arrow.hidden = true
    hl?.classList.remove('tut-hl')
    hl = null
  }
  function pointAt(selector, side) {
    const el = document.querySelector(selector)
    const r = el?.getBoundingClientRect()
    if (!el || !r || r.width === 0 || r.height === 0) return clearUi() // window not open (yet)
    if (hl !== el) {
      hl?.classList.remove('tut-hl')
      el.classList.add('tut-hl')
      hl = el
    }
    arrow.hidden = false
    arrow.dataset.side = side
    arrow.style.left = `${side === 'left' ? r.left - 6 : r.left + r.width / 2}px`
    arrow.style.top = `${side === 'left' ? r.top + r.height / 2 : r.top - 6}px`
  }

  // --- 3D guide --------------------------------------------------------------
  const shape = new Shape()
  shape.moveTo(0, 0.42)
  shape.lineTo(0.34, -0.2)
  shape.lineTo(0, -0.05)
  shape.lineTo(-0.34, -0.2)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 })
  geometry.center()
  // Drawn over everything so mounds, walls and stands never hide the way.
  const trailMat = new MeshStandardMaterial({ color: '#eef1f6', roughness: 0.5, depthTest: false, transparent: true })
  const beaconMat = new MeshStandardMaterial({ color: '#ffd23a', emissive: '#ff9a1f', emissiveIntensity: 0.6, roughness: 0.4, fog: false, depthTest: false, transparent: true })
  const guide = new Group()
  const trail = new InstancedMesh(geometry, trailMat, MAX_ARROWS)
  trail.frustumCulled = false
  trail.renderOrder = 20
  const beacon = new Mesh(geometry, beaconMat)
  beacon.scale.setScalar(3.2)
  beacon.frustumCulled = false
  beacon.renderOrder = 21
  beacon.visible = false
  guide.add(trail, beacon)
  scene.add(guide)
  const dummy = new Object3D()

  // The 3D target for a step, or null: the loot lying about, else the nearest x1 pile still hiding some.
  function target(step) {
    if (step === 1) return padWithMult(TUTORIAL.pad) ?? ZONE1
    if (step === 2 || step === 3) {
      let best = null
      let bestD = Infinity
      if (step === 3) {
        // Most valuable loot lying about first (ties: nearest), so the bag fills with the best stuff.
        let bestV = -1
        for (const d of loot.drops) {
          const dd = (d.x - player.position.x) ** 2 + (d.z - player.position.z) ** 2
          if (d.value > bestV || (d.value === bestV && dd < bestD)) {
            bestV = d.value
            bestD = dd
            best = d
          }
        }
      }
      return best ?? loot.hintPile(player.position.x, player.position.z) ?? ZONE1
    }
    if (step === 4) return SELL_STAND
    if (step === 7) return VACUUM_STAND
    return null
  }

  function drawGuide(step, t) {
    trail.count = 0
    beacon.visible = false
    const to = target(step)
    if (!to) return
    const dx = to.x - player.position.x
    const dz = to.z - player.position.z
    const dist = Math.hypot(dx, dz)
    const ux = dx / (dist || 1)
    const uz = dz / (dist || 1)
    const heading = Math.atan2(ux, uz)
    const phase = (t * SPEED) % SPACING
    let n = 0
    if (dist > HIDE_WITHIN) {
      for (let d = 1.4 + phase; d < dist - 0.6 && n < MAX_ARROWS; d += SPACING) {
        const x = player.position.x + ux * d
        const z = player.position.z + uz * d
        dummy.position.set(x, floorAt(x, z) + 0.3, z)
        dummy.rotation.set(Math.PI / 2 - 0.35, heading, 0, 'YXZ') // lie flat, tip toward the target
        dummy.updateMatrix()
        trail.setMatrixAt(n++, dummy.matrix)
      }
    }
    trail.count = n
    trail.instanceMatrix.needsUpdate = true
    beacon.visible = true
    beacon.position.set(to.x, (to.top ?? floorAt(to.x, to.z)) + BEACON_HEIGHT + Math.sin(t * 4) * 0.35, to.z)
    beacon.rotation.set(0, t * 2, Math.PI, 'YXZ') // point down, spin about the vertical
  }

  // --- Per frame -------------------------------------------------------------
  let prev = state.tutorialStep
  let completeUntil = 0
  function update(t) {
    if (DISABLE_TUTORIALS || !state.tutorialReady) return
    const step = state.tutorialStep
    if (prev < TUTORIAL.steps && step >= TUTORIAL.steps) completeUntil = performance.now() + TUTORIAL.completeMs
    prev = step

    if (step >= TUTORIAL.steps) {
      drawGuide(-1, t)
      clearUi()
      if (performance.now() < completeUntil) paintBanner('done', 'Tutorial Complete!', '', true)
      else paintBanner('', null)
      return
    }

    const unlocked = unlockedBag()
    const worth = payout(bagValue(unlocked))
    const next = nextStep(step, {
      power: totalPower(),
      clickGoal: TUTORIAL.clickPower,
      powerGoal: TUTORIAL.power,
      cash: state.cash,
      cost: VACUUM.cost,
      worth,
      bagCount: state.bag.length,
      bagFull: state.bag.length >= state.backpackMax,
      unlockedLeft: unlocked.length,
      hasLoot: loot.count > 0,
      sellOpen: state.sellOpen,
      vacuumsOpen: state.vacuumsOpen,
      bought: state.vacuumOwned.length > 1,
      done: TUTORIAL.steps,
    })
    if (next !== step) {
      state.tutorialStep = next
      notify() // saved by net.js
      return
    }

    drawGuide(step, t)
    const ui = UI_TARGETS[step]
    if (ui) pointAt(...ui)
    else clearUi()

    const need = Math.max(0, VACUUM.cost - state.cash)
    const [title, hint] = [
      [`Hold ${isTouch ? 'BLOW' : 'CLICK'} to gain Power (${Math.floor(Math.min(totalPower(), TUTORIAL.clickPower))}/${TUTORIAL.clickPower})`, ''],
      [`Stand on the x${TUTORIAL.pad} Power Training Pile (${Math.floor(Math.min(totalPower(), TUTORIAL.power))}/${TUTORIAL.power})`, 'It trains you automatically while you stand on it'],
      [`${isTouch ? 'Hold BLOW to clear' : 'Click and blow away'} the leaves in Zone 1!`, 'Follow the arrow to the high-value loot'],
      [`Collect loot worth $${shortMoney(need)}!`, `${isTouch ? 'Tap the E button' : 'Press E'} to pick it up (bag $${shortMoney(worth)}/$${shortMoney(need)})`],
      ['Sell your loot!', `Walk to the Sell Loot stall and ${isTouch ? 'tap E' : 'press E'}`],
      ['Press Sell All!', ''],
      ['Close the window', ''],
      ['Buy a better Vacuum!', `Walk to the Vacuums stall and ${isTouch ? 'tap E' : 'press E'}`],
      [`Buy the ${VACUUM.name}!`, ''],
    ][step]
    paintBanner(`${step}|${title}|${hint}`, title, hint)
  }

  return { update }
}
