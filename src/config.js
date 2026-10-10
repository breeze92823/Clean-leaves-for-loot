// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'clean-leaves-for-loot' // slug registered on bloxity.io
export const GAME_TITLE = 'Clean Leaves for Loot'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'
// Shows the Bloxbux (gem) buy buttons, e.g. in the Upgrades window (see .env.example).
export const BUY_WITH_BLOXBUX = import.meta.env.VITE_BUY_WITH_BLOXBUX === 'true'

// Colyseus game server (Clean-leaves-for-loot-backend). Empty = offline: no saving, no other players.
// Local dev falls back to the server's default port; a deployed build must set VITE_SERVER_URL.
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'ws://localhost:2567' : '')
export const NET = {
  poseHz: 15, // pose messages per second
  saveDebounce: 1.5, // s of quiet after a state change before saving
  saveMaxWait: 8, // s: a continuous change stream (training) still saves this often
  remoteLerp: 12, // 1/s: how fast remote players ease toward their last reported pose
  remoteFade: 40, // m: remote players further away than this are hidden
  maxRemotes: 24, // drawn at once (nearest first)
}

// --- World (metres: +X east, +Z south, +Y up) -------------------------------
export const GROUND_Y = 0
export const GROUND_SIZE = 1000 // square grass ground, centred on the origin (the hub floor sits on top)
export const WORLD_BOUNDS = { minX: -438, maxX: 27.5, minZ: -27.5, maxZ: 27.5 } // backstop behind the wall colliders
export const SPAWN = { x: 0, y: 0.3, z: 0 }
export const SPAWN_FACING = Math.PI // yaw the character faces on spawn (PI = toward -Z)

// --- Hub layout (hub.js / props.js) ------------------------------------------
// Square plaza walled on three sides; the west wall opens onto the leaf field,
// a canyon running to x = FIELD_END.
export const HUB = {
  half: 28, // plaza interior spans -half..half on X and Z
  innerWall: { depth: 8, height: 9 }, // first terrace
  outerWall: { depth: 14, height: 18 }, // second terrace behind it
  opening: { minZ: -14, maxZ: 14 }, // gap in the west wall
  fieldHalfWidth: 24, // canyon interior spans -this..this on Z
  fieldEnd: -434,
  stepUp: 0.6, // tallest ledge the player walks up without jumping
}

// Autumn leaves drifting from the sky; fade in as the player nears the corridor (x decreasing).
export const FALLING_LEAVES = {
  count: 650,
  size: 0.5,
  radius: 28, // half-extent of the box around the player
  height: 42, // spawn height; tall enough to start in the cliff-top tree canopies
  fallSpeed: 1.6, // m/s
  drift: 1.4, // sideways sway m/s
  startX: -8, // no leaves east of this
  fullX: -34, // full density west of this
  colors: ['#e8721c', '#f2a516', '#c93a1a', '#e0b020', '#a8481c', '#d9561e'],
}

export const HUB_COLORS = {
  floorA: '#cfc3ea',
  floorB: '#c4b6e3',
  wallA: '#f7a21b',
  wallB: '#ec8c12',
  topA: '#43c43a',
  topB: '#36b030',
  stone: '#c9bfe0',
  trunk: '#b4532a',
  leaves: '#3ec43a',
  wood: '#f08a1c',
  woodDark: '#d06a10',
  boardWood: '#7a3b1c',
  boardPanel: '#4a2416',
}

// --- Physics feel (player.js) -----------------------------------------------
export const PHYSICS = {
  moveSpeed: 10, // m/s on flat ground
  accel: 75, // m/s^2 toward the target velocity (full speed in ~0.13 s)
  decel: 69, // m/s^2 when no key is held
  turnSpeed: 12, // rad/s the body turns toward its heading
  aimTurnSpeed: 20, // rad/s the body turns to face the camera while blowing
  gravity: -22, // m/s^2
  jumpSpeed: 7.5, // m/s
  killY: -30, // fell this far below the ground: respawn
}
export const PLAYER_DIMS = { radius: 0.4, height: 1.8 }

// --- Look ------------------------------------------------------------------
export const COLORS = {
  horizon: '#a9dbff',
  zenith: '#1f7fe6',
  grass: '#4cc23e',
  grassDark: '#3aa830',
}
export const FOG = { near: 90, far: 260 }
export const LIGHT = {
  sunColor: '#fff2d6',
  sunIntensity: 2.4,
  sunPosition: [30, 60, 20],
  shadowMapSize: 2048,
  shadowRange: 40, // half-width of the shadow frustum around the player
  hemiSky: '#e4f1ff',
  hemiGround: '#b9a98a',
  hemiIntensity: 1.5,
}

// Default (signed-out / fallback) character look.
export const CHARACTER_COLORS = { skin: '#f2c79a', suit: '#2f9e8f', hair: '#5a3a22' }

// --- Camera (camera.js) -------------------------------------------------------
export const CAMERA = {
  fov: 70,
  near: 0.1,
  far: 600,
  startPitch: 0.32, // radians above the horizon
  minPitch: -0.1,
  maxPitch: 1.2,
  distance: 9, // resting boom length, m
  minDistance: 3,
  maxDistance: 15,
  followLerp: 10, // 1/s: the ONE smoothing stage, on the point the camera follows
  targetHeight: 0.6, // look-at point as a fraction of player height
  lookSensitivity: 0.0026, // rad per pixel of right-drag
  zoomStep: 0.9, // m per wheel notch
  zoomEase: 12, // 1/s the zoom glides to its target
  speedDistance: 0.8, // m the boom pulls back at full speed
  speedFov: 4, // degrees the FOV widens at full speed
  speedEase: 3, // 1/s the speed framing eases in and out
  clearEase: 4, // 1/s the boom eases back out after a wall pulled it in
}

// --- Loose leaves + leaf blower (leaves.js) -------------------------------------
export const LEAVES = {
  minX: -38, // field strip (hub side)
  maxX: -432,
  halfZ: 23.2,
  // The field is a carpet of leaves split into 13 zones (zone i, hub side first, spans
  // edges[i]..edges[i+1] and uses palettes[i]). It is mounded and solid; blow it away to pass.
  zones: {
    edges: [-44, -74, -104, -134, -164, -194, -224, -254, -284, -314, -344, -374, -404, -434], // x boundaries
    cell: 0.5, // m per texel of the field state
    height: 2.0, // tallest mound, m (each spot is 45-100% of this)
    edgeTaper: 6, // m over which the carpet slopes down to the floor at the hub end
    blockMinHeight: 0.45, // a spot stops blocking once blown below this height, m
    luck: [1, 2, 3, 5, 7, 10, 14, 19, 25, 32, 40, 50, 60], // Luck multiplier of each zone: sets how hard it is to blow away and what it drops
    leaves: 54000, // leaves on top of the carpet (scaled by graphics quality)
    leafSize: [0.8, 1.3], // m
    wearMin: 0.06, // airflow strength below which nothing happens
    wearRate: 1.8, // carpet lost per second at full airflow
    lingerTime: 0.8, // s a landed leaf stays before it shrinks away
    fadeTime: 0.5, // s it takes to shrink away
    palettes: [
      ['#e8571f', '#f2a516', '#d6382b', '#f5c93a', '#b8631c', '#8fbf2e', '#c9421a', '#e98a1a'],
      ['#1fc7a0', '#14a98a', '#3ddcb4', '#0f8f7a', '#6ee8c6', '#2bb673', '#18d0c0', '#0c7d6a'],
      ['#b04ae8', '#d36bff', '#8a2fd0', '#f08aff', '#6d2bb5', '#c25cf0', '#e0a0ff', '#9a3ede'],
      ['#2f8cff', '#59adff', '#1c5fd6', '#8fcaff', '#0e3fa8', '#3fb4ff', '#76a8ff', '#2a74e8'],
      ['#ff3d6e', '#ff7a9c', '#d6204f', '#ffb0c4', '#a8123a', '#ff5c85', '#e8305e', '#ff9ab4'],
      ['#ffd21a', '#ffe566', '#e0a800', '#fff0a0', '#b88400', '#ffc933', '#f2b705', '#ffec8a'],
      ['#ff8a1f', '#ffa84d', '#e06a00', '#ffc58a', '#b84e00', '#ff9a33', '#f27a0a', '#ffb870'],
      ['#7cff3a', '#a6ff6e', '#4ed21a', '#c8ff9a', '#2e9a0a', '#8cf04a', '#62e028', '#b4ff80'],
      ['#3af0ff', '#7af6ff', '#12c4d6', '#b0fbff', '#0a8a9a', '#52e8f5', '#22d4e6', '#9af8ff'],
      ['#5a5aff', '#8a8aff', '#3a3ad6', '#b4b4ff', '#2420a8', '#6e6eff', '#4a4ae8', '#a0a0ff'],
      ['#ff4ad8', '#ff7ae6', '#d620b4', '#ffb0f2', '#a8128a', '#ff5ce0', '#e830c8', '#ff9af0'],
      ['#e8e8f8', '#ffffff', '#b8b8d8', '#f4f4ff', '#9090b8', '#d8d8f0', '#c8c8e4', '#fafaff'],
      ['#ffcf5a', '#fff2b0', '#e0a020', '#ffe38a', '#b87a10', '#fff8d0', '#f0b840', '#ffeaa0'],
    ],
  },
  // Leaf piles: the field is tiled into piles (per zone). A pile has hardness ("hp") like the
  // reference game's trees: blowing wears it at blowerPower / hp, so time to clear ~ hp / power.
  // hp = baseHp * luck^exponent. With power = baseHp (the start), clearing one pile takes about
  // 3 s in x1, 20 s in x2, 1 min in x3, 4-5 min in x5 and 10+ min in x7. There is no health bar.
  piles: {
    size: 6, // m, target width/depth of a pile
    clearAt: 0.12, // a pile is cleared (drops its loot) once its mound is down to this fraction
    baseHp: 1, // hp of an x1 pile; also the starting blower power (1 = Battery Fan)
    exponent: 2.8, // hp grows as luck^exponent
    leavesPerPile: 100, // Leaves counter (HUD) gained per pile blown away
    regrowDelay: 2, // s back in the hub before the whole field regrows (loot left lying is lost)
  },
  blower: {
    range: 13, // m the airflow reaches
    coneStart: 0.5, // cone radius at the nozzle, m
    spread: 0.45, // radius growth per metre
    pitch: -0.2, // airflow tilt below horizontal, rad
    speed: 24, // m/s at the core, next to the nozzle
    lift: 6, // m/s upward kick at the core
    swirl: 5, // m/s tangential swirl
    windup: 0.2, // s to full power
    winddown: 0.25,
    fall: [1.3, 2.2], // terminal fall speed, m/s (floaty)
    fovPunch: 3, // degrees of FOV kick at full power
    particles: 420,
  },
}

// --- Bloxity (bloxity.js, avatar/) -------------------------------------------------
// SDK setting keys this game listens for; registering a listener makes the control
// appear in the portal's settings menu.
export const SETTINGS = {
  graphics_quality: { def: 'High', type: 'enum', values: ['Low', 'Medium', 'High', 'Ultra'] },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  fullscreen: { def: 'false', type: 'bool' },
}

// The base rig, measured from player.glb: origin at the feet, 6.4 units tall at bind pose.
export const RIG_HEIGHT = 6.4
// Bind-pose values of the rig nodes the SDK proportions drive.
export const RIG = { armOffsetX: 2, legOffsetX: 0.6, neckOffsetY: 0.6 }
// getProportions() ranges, straight from the SDK spec; clamped before they reach the scene graph.
export const PROPORTIONS = {
  height: { def: 1, min: 0.5, max: 1.6 },
  shoulderWidth: { def: 1, min: 0.5, max: 1.5 },
  armLength: { def: 1, min: 0.05, max: 3 },
  legOffsetX: { def: 1, min: -0.7, max: 5 },
  torsoScaleX: { def: 1, min: 0.3, max: 2 },
  neckHeight: { def: 1, min: 0.94, max: 1.2 },
  headScale: { def: 1, min: 0.3, max: 2.6 },
}

// Procedural animation (avatar/animator.js), ported from +1 Cut Grass Adventure.
// Rotations are radians in CHARACTER space: +X swings a limb backward, +Y yaws, +Z rolls.
const deg = (d) => (d * Math.PI) / 180
export const ANIM = {
  airborneDelay: 0.07, // s off the ground before the air pose (ignores a step down a ledge)
  // Walk -> run is one cycle at two depths; phase advances with distance travelled.
  locomotion: {
    minFrequency: 0.7,
    maxFrequency: 3.6,
    strideDistance: 3.8, // m per cycle
    idleSpeed: 0.6,
    walkSpeed: 2.5,
    runSpeed: 8,
    sprintSpeed: 13,
    hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
    kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
    armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
    elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
    torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
    torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
    headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
    torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
    bob: { walk: 0.03, run: 0.07, sprint: 0.09 }, // m, on the avatar root
    bankAngle: deg(9),
    bankRate: 8,
  },
  idle: {
    breathFrequency: 0.35,
    breathAmount: deg(1.8),
    breathBob: 0.007,
    basePose: {
      ArmL1: { x: deg(-8), z: deg(14) },
      ArmL2: { x: deg(38) },
      ArmR1: { x: deg(4), z: deg(-6) },
      ArmR2: { x: deg(12) },
      LegL1: { x: deg(-4) },
      LegR1: { x: deg(4) },
    },
  },
  airborne: {
    rise: {
      LegL1: { x: deg(-38) }, LegR1: { x: deg(8) }, LegL2: { x: deg(62) }, LegR2: { x: deg(40) },
      ArmL1: { x: deg(-40), z: deg(34) }, ArmR1: { x: deg(-30), z: deg(-34) },
      ArmL2: { x: deg(30) }, ArmR2: { x: deg(30) }, Spine1: { x: deg(6) },
    },
    fall: {
      LegL1: { x: deg(-14) }, LegR1: { x: deg(10) }, LegL2: { x: deg(22) }, LegR2: { x: deg(18) },
      ArmL1: { x: deg(-70), z: deg(40) }, ArmR1: { x: deg(-60), z: deg(-40) },
      ArmL2: { x: deg(20) }, ArmR2: { x: deg(20) }, Spine1: { x: deg(-4) },
    },
    velocityReference: 8, // m/s vertical speed that reads as fully rising / falling
  },
  landing: {
    duration: 0.16,
    pose: {
      LegL1: { x: deg(-34) }, LegR1: { x: deg(-34) }, LegL2: { x: deg(58) }, LegR2: { x: deg(58) },
      ArmL1: { x: deg(-18), z: deg(20) }, ArmR1: { x: deg(-18), z: deg(-20) }, Spine1: { x: deg(14) },
    },
    bobY: -0.2,
  },
  // The right arm carries the leaf blower (parented to ArmR1, nozzle along the bind forward).
  blower: {
    hold: { ArmR1: { x: 0, z: deg(-6) }, ArmR2: {} },
    blowPitch: deg(11), // nozzle dips toward the airflow while blowing
  },
  transitions: { toLocomotion: 0.14, toAirborne: 0.12, toLanding: 0.06 }, // s to blend a pose change
}

// --- HUD (hud.js) ------------------------------------------------------------
// Starting values shown on the HUD (live state is in state.js). `power` is the blower power; `backpackMax` is the Bag capacity.
// Holding the blow button (hub or field) trains: every `interval` s adds `perTick` power and xp.
export const POWER_GAIN = { perTick: 1, interval: 1 }
// Level bar: reaching level N+1 needs xpPerLevel * N xp (25, 50, 75, ...), as in the Chop Trees reference.
export const LEVEL = { xpPerLevel: 25 }
// Rebirth (rebirth.js, the HUD's Rebirth tile): once level >= level * levelGrowth^rebirths the player
// may reset level and trained power for permanent boosts: trained-power gain x(1 + n * powerPer)
// and sell payouts x(1 + n * cashPer). Cash, vacuums, auras and upgrades are kept.
export const REBIRTH = { level: 25, levelGrowth: 2, powerPer: 0.5, cashPer: 0.5 }
// Treasure Index (index.js, the HUD's Index tile): every `step` distinct loot items discovered
// adds `boost` (0.25 = +25%) to the trained-power gain.
export const INDEX = { step: 10, boost: 0.25 }
// "LEVEL UP!" banner (hud.js): ms for the pop-in, hold and float-away fade.
export const LEVEL_UP_POPUP = { inMs: 420, holdMs: 900, outMs: 560 }
export const HUD_START = {
  level: 1,
  xp: 0,
  xpNext: LEVEL.xpPerLevel,
  rebirths: 0,
  power: 1, // trained power (the starting Battery Fan adds +0, so the HUD shows 1)
  leaves: 0,
  backpack: 0,
  backpackMax: 3,
  pets: 0,
  cash: Number(import.meta.env.VITE_START_CASH) || 0, // VITE_START_CASH overrides the starting money
  invitePct: 0,
}
// Upgrades window (upgrades.js), in row order. Cash price = cost * growth^level; the gem
// price is shown but gem purchases are not wired yet. `step` is the bonus per level.
export const UPGRADES = [
  { id: 'range', name: 'Range', desc: (s) => `+${s * 100}% Vaccum Area`, step: 0.05, cost: 5500, gems: 15, max: 20, icon: 'upRange' },
  { id: 'agility', name: 'Agility', desc: (s) => `+${s * 100}% Vaccum Speed`, step: 0.1, cost: 13500, gems: 15, max: 20, icon: 'upAgility' },
  { id: 'capacity', name: 'Capacity', desc: (s) => `+${s} Bag Space`, step: 1, cost: 115000, gems: 15, max: 10, icon: 'upCapacity' },
  { id: 'walk', name: 'Mobility', desc: (s) => `+${s} Walk Speed`, step: 1, cost: 9000, gems: 15, max: 10, icon: 'upWalk' }, // step = m/s
]
export const UPGRADE_GROWTH = 1.6
export const UPGRADE_STAND = { x: 16, z: 12 } // matches the 'Upgrades' stand in props.js

// Vacuums window (vacuums.js): leaf blowers, worst to best. `power` adds to the blower power
// while equipped; the first is owned and equipped from the start. `gems` is the Bloxbux price.
// Each one's 3D preview is built in vacuumModels.js by id.
export const VACUUMS = [
  { id: 'battery', name: 'Battery Fan', rarity: 'Common', power: 0, cost: 0, gems: 0 },
  { id: 'suburban', name: 'Suburban Electric', rarity: 'Common', power: 3, cost: 200, gems: 2 },
  { id: 'gas', name: 'Gas-Powered Handheld', rarity: 'Common', power: 9, cost: 600, gems: 3 },
  { id: 'drum', name: 'Drum Vacuum', rarity: 'Uncommon', power: 15, cost: 2400, gems: 6 },
  { id: 'wheel', name: 'Wheel Vacuum', rarity: 'Uncommon', power: 30, cost: 5000, gems: 9 },
  { id: 'dual', name: 'Dual Tube Blaster', rarity: 'Uncommon', power: 45, cost: 12000, gems: 15 },
  { id: 'turbo', name: 'Turbo Vacuum', rarity: 'Uncommon', power: 80, cost: 28000, gems: 25 },
  { id: 'widemouth', name: 'Wide Mouth Vacuum', rarity: 'Rare', power: 170, cost: 65000, gems: 35 },
  { id: 'packgun', name: 'Backpack Vacuum Gun', rarity: 'Rare', power: 350, cost: 135000, gems: 55 },
  { id: 'industrial', name: 'Industrial Vacuum', rarity: 'Rare', power: 720, cost: 300000, gems: 80 },
  { id: 'cyclone', name: 'Cyclone Vacuum', rarity: 'Rare', power: 1500, cost: 700000, gems: 110 },
  { id: 'jet', name: 'Jet Vacuum', rarity: 'Epic', power: 3500, cost: 1500000, gems: 160 },
  { id: 'doublemotor', name: 'Double Motor Vacuum', rarity: 'Epic', power: 7000, cost: 4000000, gems: 210 },
  { id: 'cannon', name: 'Cannon Vacuum', rarity: 'Epic', power: 14000, cost: 10000000, gems: 290 },
  { id: 'quadvent', name: 'Quad Vent Vacuum', rarity: 'Epic', power: 28000, cost: 25000000, gems: 380 },
  { id: 'rotor', name: 'Rotor Vacuum', rarity: 'Legendary', power: 65000, cost: 40000000, gems: 480 },
  { id: 'twin', name: 'Twin Turbine Vacuum', rarity: 'Legendary', power: 90000, cost: 70000000, gems: 540, unlockLevel: 5 },
  { id: 'triple', name: 'Triple Barrel', rarity: 'Legendary', power: 130000, cost: 125000000, gems: 600 },
  { id: 'heavy', name: 'Heavy Duty Vacuum', rarity: 'Legendary', power: 280000, cost: 250000000, gems: 750 },
  { id: 'fourengine', name: 'Four Engine Vacuum', rarity: 'Legendary', power: 600000, cost: 800000000, gems: 900 },
  { id: 'megaturbo', name: 'Mega Turbo Vacuum', rarity: 'Legendary', power: 1000000, cost: 2000000000, gems: 1050 },
  { id: 'tornado', name: 'Tornado Vacuum', rarity: 'Mythic', power: 2500000, cost: 6000000000, gems: 1200 },
  { id: 'reactor', name: 'Reactor Vacuum', rarity: 'Mythic', power: 5500000, cost: 13000000000, gems: 1375 },
  { id: 'shoulder', name: 'Shoulder Turbine', rarity: 'Mythic', power: 11000000, cost: 25000000000, gems: 1499 },
]
// Rarity look in the Vacuums window: label colour (Mythic is a gradient), the preview tile's
// centre/edge colours, the light/sparkle colour and how many sparkles circle the model.
export const VACUUM_RARITY = {
  Common: { text: '#d6dde4', tile: ['#ffffff', '#c4ccd6'], glow: '#bfe6ff', sparkles: 6 },
  Uncommon: { text: '#2bdc2b', tile: ['#ffffff', '#a8eca0'], glow: '#7dff6a', sparkles: 10 },
  Rare: { text: '#3ac8ff', tile: ['#ffffff', '#9ad8ff'], glow: '#4ac8ff', sparkles: 14 },
  Epic: { text: '#d42aff', tile: ['#fff6ff', '#e0a6ff'], glow: '#e44aff', sparkles: 20 },
  Legendary: { text: '#ffc21a', tile: ['#fffbe8', '#ffd98a'], glow: '#ffc21a', sparkles: 26 },
  Mythic: { text: ['#c02aff', '#3a5aff', '#1ad8ff'], tile: ['#f4f0ff', '#a8b0ff'], glow: '#6a7aff', sparkles: 34 },
}
export const TWIN_STAND = { x: -16.5, z: 24 } // the Twin Turbine showcase in props.js (E to buy)
export const VACUUM_STAND = { x: 2, z: 12 } // matches the 'Vacuums' stand in props.js

// Auras window (auras.js): one aura is equipped at a time and multiplies the total blower
// power by `boost`. `cost` 0 = free to claim. `gems` is the Bloxbux price. `look` paints the icon.
export const AURAS = [
  { id: 'interstellar', name: 'Interstellar', boost: 1.5, cost: 0, gems: 0, look: 'gift' },
  { id: 'static', name: 'Static', boost: 1.2, cost: 100000, gems: 59, look: ['#6ad8ff', '#2f8cff', '#1fae7a'] },
  { id: 'cinderveil', name: 'Cinderveil', boost: 1.4, cost: 1500000, gems: 115, look: ['#ff5a3a', '#2a2a32', '#2fae3a'] },
  { id: 'shardfall', name: 'Shardfall', boost: 1.6, cost: 25000000, gems: 225, look: ['#6aff4a', '#2fae3a', '#2f5ae8'] },
  { id: 'slipstream', name: 'Slipstream', boost: 1.9, cost: 400000000, gems: 395, look: ['#4ac8ff', '#3fae5a', '#2f5ae8'] },
  { id: 'frostfire', name: 'Frostfire', boost: 2.2, cost: 7000000000, gems: 619, look: ['#3a8aff', '#3fae5a', '#2f5ae8'] },
]
export const SELL_STAND = { x: -6, z: -16.5 } // the 'Sell Loot' stand in props.js
export const AURA_STAND = { x: 20, z: -14 } // the 'Auras' stand in props.js

// Looping countdowns, seconds: period and the value shown on load.
export const TIMERS = {
  luckEvent: { period: 4 * 60, startAt: 3 * 60 + 54 },
  freeGift: { period: 17 * 60, startAt: 16 * 60 + 42 },
}
export const FONT_FAMILY = 'Fredoka'

export const MATERIAL_PBR = {
  PLAYER: { roughness: 0.7, metalness: 0 },
  GROUND: { roughness: 0.95, metalness: 0 },
}

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Coerce one raw SDK string against its SETTINGS entry.
export function coerceSetting(key, raw) {
  const spec = SETTINGS[key]
  if (!spec) return raw
  const value = raw === '' || raw == null ? spec.def : raw
  if (spec.type === 'bool') return value === 'true'
  if (spec.type === 'enum') return spec.values.includes(value) ? value : spec.def
  const n = Number(value)
  return clamp(Number.isFinite(n) ? n : Number(spec.def), spec.min, spec.max)
}
