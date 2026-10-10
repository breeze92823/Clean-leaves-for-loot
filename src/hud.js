// The on-screen HUD: system buttons, free-gift timer, menu tiles, currency
// stats, level bar, power, luck-event pill, boosts, spin packs and hotbar.
// Plain DOM over the canvas. Menu tiles open a placeholder panel; purchase
// buttons show a toast (no store yet).
import './hud.css'
import { DEV_MODE, DISABLE_TUTORIALS, INDEX, BUY_WITH_BLOXBUX, LEAVES, LEVEL_UP_POPUP, FREE_GIFT, DAILY, UPGRADES, VACUUMS, AURAS, VACUUM_RARITY } from './config.js'
import { player, respawn } from './player.js'
import { ICONS, auraIcon, vacuumIcon } from './icons.js'
import { mmss } from './timers.js'
import { ITEM_CATALOG, ITEM_INFO, RARITY, RARITY_ROW_BG } from './data/loot.js'
import { closeIndex, indexProgress, openIndex } from './index.js'
import { createIndexViews } from './indexView.js'
import { playerScreen } from './screenPos.js'
import { addPlaySeconds, state, subscribe, notify, setToast, onPowerGain, totalPower, cashMultiplier, powerGainMultiplier, boostActive, boostLeft } from './state.js'
import { closeRebirth, openRebirth, rebirthLevel, rebirthProgress, tryRebirth } from './rebirth.js'
import { bagValue, closeSell, groupBag, isLocked, payout, sellAll, sellItem, toggleLock, unlockedBag } from './sell.js'
import { buyUpgrade, closeUpgrades, upgradeCost } from './upgrades.js'
import { claimGift, closeVacuums, pickVacuum } from './vacuums.js'
import { createVacuumViews } from './vacuumView.js'
import { settings, setSettings, subscribeSettings, sfx } from './settings.js'
import { closeAuras, pickAura } from './auras.js'
import { createAuraViews } from './auraView.js'
import { claimDaily, closeDaily, dailyStatus, openDaily } from './daily.js'
import { isCompact } from './device.js'

const REF_W = 1920
const REF_H = 991

const GLYPH = Object.fromEntries(ITEM_CATALOG.map(([name, , glyph]) => [name, glyph]))

// 19900 -> 19.9K, 238000 -> 238K
export function short(n) {
  const units = ['', 'K', 'M', 'B', 'T', 'Qd']
  let i = 0
  while (Math.abs(n) >= 1000 && i < units.length - 1) {
    n /= 1000
    i++
  }
  return `${i ? +n.toFixed(n < 100 ? 1 : 0) : +n.toFixed(1)}${units[i]}`
}

const icon = (name) => `<i>${ICONS[name]}</i>`
const gem = `<i>${ICONS.gem}</i>`

// Rarity name in its colour; Mythic cycles through a gradient letter by letter.
function rarityLabel(rarity) {
  const c = VACUUM_RARITY[rarity].text
  if (typeof c === 'string') return `<span style="color:${c}">${rarity}</span>`
  return [...rarity].map((ch, i) => `<span style="color:${c[Math.min(c.length - 1, Math.floor((i / rarity.length) * c.length))]}">${ch}</span>`).join('')
}

// 3725 s -> 1:02:05
const hms = (sec) => {
  const t = Math.max(0, Math.ceil(sec))
  return `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

// Daily Login tile text, e.g. "76 Power + 2x Cash 30m" or "$58.6K".
function dailyLabel(r) {
  const kind = { power: 'Power', cash: 'Cash' }
  return [
    r.power && `${short(r.power)} Power`,
    ...(r.boosts ?? []).map((b) => `${DAILY.boostMult}x ${kind[b.kind]} ${b.minutes}m`),
    r.cash && `$${short(r.cash)}`,
  ]
    .filter(Boolean)
    .join(' + ')
}
const dailyIcon = (r) => (r.vacuum ? '<canvas></canvas>' : r.power || (r.boosts ?? []).some((b) => b.kind === 'power') ? ICONS.tornado : ICONS.cash)

function template() {
  return `
  <div class="anchor a-tl">
    <div class="trail">
      <i class="trail-flag">🏁</i>
      <div class="trail-bar">
        ${[...LEAVES.zones.palettes]
          .map((p, i) => `<div class="trail-seg" style="--c:${p[0]}"><span class="o-thin">${i + 1}</span></div>`)
          .reverse()
          .join('')}
        <div class="trail-me" data-bind="trailMe"></div>
      </div>
    </div>
    <button class="gift pressable" data-act="gift">
      <div class="t o" data-bind="gift"></div>
      <div class="gun"><canvas></canvas></div>
      <div class="gname o-thin">${VACUUMS.find((v) => v.id === FREE_GIFT.vacuum).name}</div>
      <div class="gpow o">${short(VACUUMS.find((v) => v.id === FREE_GIFT.vacuum).power)} Power</div>
      <div class="gprice o"><s>$${short(VACUUMS.find((v) => v.id === FREE_GIFT.vacuum).cost)}</s><b>FREE</b></div>
    </button>
    <div class="menu">
      <button class="tile pressable" data-act="openIndex">${icon('book')}<span class="o">Index</span></button>
      <button class="tile pressable" data-panel="Config">${icon('gear')}<span class="o">Config</span></button>
      <button class="tile pressable" data-act="openRebirth">${icon('rebirth')}<span class="o">Rebirth</span><b class="pct o-thin" data-bind="rebirth"></b></button>
      <button class="tile pressable" data-act="openDaily">${icon('calendar')}<span class="o">Daily</span></button>
    </div>
  </div>

  <div class="anchor a-bl">
    <div class="stats">
      <div class="stat leaf">${icon('leaf')}<span class="o" data-bind="leaves"></span></div>
      <div class="stat">${icon('backpack')}<span class="o" data-bind="backpack"></span></div>
      <div class="stat">${icon('rebirth')}<span class="o" data-bind="rebirths"></span></div>
      <div class="stat cash">${icon('cash')}<span class="o" data-bind="cash"></span></div>
    </div>
  </div>

  <div class="anchor a-tc">
    <button class="home-btn pressable" data-act="home"><span class="o">HOME</span></button>
    <div class="center">
      <div style="position:relative">
        <div class="level-icon"><img src="${import.meta.env.BASE_URL}UI/swirl.png" alt="" draggable="false" style="display:block;width:100%;height:100%;object-fit:contain"></div>
        <div class="level">
          <div class="fill" data-bind="xpFill"></div>
          <div class="lv o" data-bind="level"></div>
          <div class="xp o" data-bind="xp"></div>
        </div>
      </div>
      <div class="power o" data-bind="power"></div>
    </div>
  </div>

  <div class="anchor a-tr">
    <div class="boosts">
      <div class="boost-pill power" data-bind="boostPower"></div>
      <div class="boost-pill cash" data-bind="boostCash"></div>
    </div>
  </div>

  <div class="anchor a-hint">
    <div class="help">
      <div class="help-col" data-task="move">
        <div class="chk" aria-hidden="true">&#10003;</div>
        <h3 class="o">Move</h3>
        <div class="keys"><kbd data-code="KeyW,ArrowUp">W</kbd><kbd data-code="KeyA,ArrowLeft">A</kbd><kbd data-code="KeyS,ArrowDown">S</kbd><kbd data-code="KeyD,ArrowRight">D</kbd></div>
        <div class="cap o-thin">Press any one</div>
      </div>
      <div class="help-col" data-task="jump">
        <div class="chk" aria-hidden="true">&#10003;</div>
        <h3 class="o">Jump</h3>
        <div class="keys"><kbd class="wide" data-code="Space">SPACE</kbd></div>
        <div class="cap o-thin">Press it</div>
      </div>
      <div class="help-col" data-task="blow">
        <div class="chk" aria-hidden="true">&#10003;</div>
        <h3 class="o">Blow Leaves</h3>
        <div class="keys"><kbd data-code="KeyF">F</kbd><span class="or o-thin">or</span><kbd class="wide" data-code="Click">CLICK</kbd></div>
        <div class="cap o-thin">Try it</div>
      </div>
      <div class="help-col" data-task="look">
        <div class="chk" aria-hidden="true">&#10003;</div>
        <h3 class="o">Look</h3>
        <div class="keys"><kbd class="wide" data-code="Mouse">MOUSE</kbd></div>
        <div class="cap o-thin">Move the mouse</div>
      </div>
      <div class="help-col" data-task="zoom">
        <div class="chk" aria-hidden="true">&#10003;</div>
        <h3 class="o">Zoom</h3>
        <div class="keys"><kbd class="wide" data-code="Wheel">WHEEL</kbd></div>
        <div class="cap o-thin">Scroll once</div>
      </div>
      <div class="help-col" data-task="cursor">
        <div class="chk" aria-hidden="true">&#10003;</div>
        <h3 class="o">Cursor</h3>
        <div class="keys"><kbd class="wide" data-code="Cursor">CLICK</kbd></div>
        <div class="cap o-thin">Click the world</div>
      </div>
      <div class="help-go o" data-bind="helpMsg">Try each control to continue</div>
      <div class="help-skip o-thin">Enter = skip</div>
    </div>
  </div>

  <div class="anchor a-cc">
    <div class="upg shp">
      <div class="upg-head">
        <i class="shp-cash">${ICONS.cash}</i>
        <h2 class="o">Sell Shop</h2>
        <button class="upg-x pressable" data-act="closeSell"><svg viewBox="0 0 40 40"><path d="M11 11 L29 29 M29 11 L11 29" stroke="#121212" stroke-width="10" stroke-linecap="round"/><path d="M11 11 L29 29 M29 11 L11 29" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg></button>
      </div>
      <div class="upg-body">
        <div class="upg-list">
          <div class="shp-total">
            <span class="o" data-bind="sellTotal"></span>
            <button class="ubtn all pressable" data-sell="all"><span class="o">Sell All</span></button>
          </div>
          <div class="shp-items" data-bind="sellList"></div>
        </div>
      </div>
    </div>
  </div>
  <div class="anchor a-cc">
    <div class="upg upgr">
      <div class="upg-head">
        <i class="upg-arrow">${ICONS.upArrow}</i>
        <h2 class="o">Upgrades</h2>
        <button class="upg-x pressable" data-act="closeUpgrades"><svg viewBox="0 0 40 40"><path d="M11 11 L29 29 M29 11 L11 29" stroke="#121212" stroke-width="10" stroke-linecap="round"/><path d="M11 11 L29 29 M29 11 L11 29" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg></button>
      </div>
      <div class="upg-body">
        <div class="upg-list">
          ${UPGRADES.map(
            (u) => `<div class="upg-row${BUY_WITH_BLOXBUX ? '' : ' solo'}" data-upg="${u.id}">
            <div class="upg-ico">${ICONS[u.icon]}</div>
            <div class="upg-name"><span class="o">${u.name}</span><span class="lv o">Lv.0</span></div>
            <div class="upg-desc o">${u.desc(u.step)}</div>
            <button class="ubtn cash pressable" data-upgrade="${u.id}"><span class="o"></span></button>
            ${BUY_WITH_BLOXBUX ? `<button class="ubtn gems pressable" data-buy="${u.name} upgrade"><span class="o">${gem}${u.gems}</span></button>` : ''}
          </div>`,
          ).join('')}
        </div>
      </div>
    </div>
  </div>
  <div class="anchor a-cc">
    <div class="upg vac">
      <div class="upg-head">
        <i class="vac-flame">${ICONS.vacFlame}</i>
        <h2 class="o">Vacuums</h2>
        <button class="upg-x pressable" data-act="closeVacuums"><svg viewBox="0 0 40 40"><path d="M11 11 L29 29 M29 11 L11 29" stroke="#121212" stroke-width="10" stroke-linecap="round"/><path d="M11 11 L29 29 M29 11 L11 29" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg></button>
      </div>
      <div class="upg-body">
        <div class="upg-list">
          ${VACUUMS.map(
            (v) => `<div class="vac-row" data-vac="${v.id}">
            <div class="vac-ico" style="--t1:${VACUUM_RARITY[v.rarity].tile[0]};--t2:${VACUUM_RARITY[v.rarity].tile[1]}">${vacuumIcon(['#c8ccd4', '#6a6a76'])}<canvas></canvas></div>
            <div class="vac-name o${v.name.length > 15 ? ' long' : ''}">${v.name}</div>
            <div class="vac-rar o-thin">${rarityLabel(v.rarity)}</div>
            <div class="vac-pow o">${icon('tornado')}+${short(v.power)} Power</div>
            <button class="ubtn cash pressable" data-vacuum="${v.id}"><span class="o"></span></button>
            ${BUY_WITH_BLOXBUX && v.gems ? `<button class="ubtn gems pressable" data-buy="${v.name}"><span class="o">${gem}${v.gems}</span></button>` : ''}
          </div>`,
          ).join('')}
        </div>
      </div>
    </div>
  </div>
  <div class="anchor a-cc">
    <div class="upg aur">
      <div class="upg-head">
        <i class="vac-flame">${ICONS.vacFlame}</i>
        <h2 class="o">Auras</h2>
        <button class="upg-x pressable" data-act="closeAuras"><svg viewBox="0 0 40 40"><path d="M11 11 L29 29 M29 11 L11 29" stroke="#121212" stroke-width="10" stroke-linecap="round"/><path d="M11 11 L29 29 M29 11 L11 29" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg></button>
      </div>
      <div class="upg-body">
        <div class="upg-list">
          ${AURAS.map(
            (a) => `<div class="aur-row" data-aur="${a.id}">
            <div class="aur-ico">${auraIcon(a.look)}<canvas></canvas></div>
            <div class="aur-name o">${a.name}</div>
            <div class="aur-boost o">${icon('tornado')}x${a.boost} Boost</div>
            <button class="ubtn cash pressable" data-aura="${a.id}"><span class="o"></span></button>
            ${BUY_WITH_BLOXBUX && a.gems ? `<button class="ubtn gems pressable" data-buy="${a.name}"><span class="o">${gem}${a.gems}</span></button>` : ''}
          </div>`,
          ).join('')}
        </div>
      </div>
    </div>
  </div>
  <div class="anchor a-cc">
    <div class="upg idx">
      <div class="upg-head">
        <i class="upg-arrow">${ICONS.book}</i>
        <h2 class="o">Index</h2>
        <span class="idx-count o" data-bind="idxCount"></span>
        <button class="upg-x pressable" data-act="closeIndex"><svg viewBox="0 0 40 40"><path d="M11 11 L29 29 M29 11 L11 29" stroke="#121212" stroke-width="10" stroke-linecap="round"/><path d="M11 11 L29 29 M29 11 L11 29" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg></button>
      </div>
      <div class="upg-body">
        <div class="idx-grid">
          ${ITEM_CATALOG.map(
            ([name, rarity]) => `<div class="idx-tile" data-idx="${name}">
            <canvas></canvas>
            <span class="idx-rar o-thin" style="color:${RARITY[rarity].fill}">${rarity}</span>
            <span class="idx-name o-thin"></span>
            <span class="idx-val o-thin"></span>
          </div>`,
          ).join('')}
        </div>
        <div class="idx-foot">
          <div class="idx-msg o-thin" data-bind="idxMsg"></div>
          <div class="idx-bar"><div class="idx-fill" data-bind="idxFill"></div><span class="o-thin" data-bind="idxBar"></span></div>
        </div>
      </div>
    </div>
  </div>
  <div class="anchor a-cc">
    <div class="upg reb">
      <div class="upg-head">
        <i class="upg-arrow">${ICONS.rebirth}</i>
        <h2 class="o">Rebirth</h2>
        <button class="upg-x pressable" data-act="closeRebirth"><svg viewBox="0 0 40 40"><path d="M11 11 L29 29 M29 11 L11 29" stroke="#121212" stroke-width="10" stroke-linecap="round"/><path d="M11 11 L29 29 M29 11 L11 29" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg></button>
      </div>
      <div class="upg-body">
        <div class="reb-grid">
          <div class="reb-cell power">${icon('tornado')}<span class="o" data-bind="rebPowerNow"></span></div>
          <div class="reb-arrow o">&raquo;</div>
          <div class="reb-cell power">${icon('tornado')}<span class="o" data-bind="rebPowerNext"></span></div>
          <div class="reb-cell cash">${icon('cash')}<span class="o" data-bind="rebCashNow"></span></div>
          <div class="reb-arrow o">&raquo;</div>
          <div class="reb-cell cash">${icon('cash')}<span class="o" data-bind="rebCashNext"></span></div>
          <div class="reb-cell lvl"><span class="o" data-bind="rebLvlNow"></span></div>
          <div class="reb-arrow o">&raquo;</div>
          <div class="reb-cell lvl"><span class="o">Lvl. 1</span></div>
        </div>
        <div class="reb-bar"><div class="reb-fill" data-bind="rebFill"></div><span class="o" data-bind="rebBar"></span></div>
        <button class="ubtn reb-btn pressable" data-act="rebirth"><span class="o">Rebirth</span></button>
        <div class="reb-warn o-thin">&#9888; Rebirthing resets Level and Power! &#9888;</div>
      </div>
    </div>
  </div>
  <div class="anchor a-cc">
    <div class="upg cfg">
      <div class="upg-head">
        <i class="upg-arrow">${icon('gear')}</i>
        <h2 class="o">Settings</h2>
        <button class="upg-x pressable" data-act="closeConfig"><svg viewBox="0 0 40 40"><path d="M11 11 L29 29 M29 11 L11 29" stroke="#121212" stroke-width="10" stroke-linecap="round"/><path d="M11 11 L29 29 M29 11 L11 29" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg></button>
      </div>
      <div class="upg-body">
        <div class="cfg-sec o">Sounds</div>
        <div class="cfg-row">
          <span class="cfg-name o">Sound Effects</span>
          <div class="cfg-slider"><div class="cfg-fill" data-bind="sfxFill"></div><input type="range" min="0" max="100" step="1" data-cfg="sfx" aria-label="Sound Effects volume"><span class="cfg-val o-thin" data-bind="sfxVal"></span></div>
        </div>
        <div class="cfg-sec o">Graphics</div>
        <div class="cfg-row">
          <span class="cfg-name o">VFX</span>
          <div class="cfg-toggle"><button class="ubtn pressable" data-vfx="on"><span class="o">ON</span></button><i class="o">/</i><button class="ubtn pressable" data-vfx="off"><span class="o">OFF</span></button></div>
        </div>
      </div>
    </div>
  </div>
  <div class="anchor a-cc">
    <div class="upg dly">
      <div class="upg-head">
        <i class="dly-cal">${ICONS.calendar}</i>
        <h2 class="o">Daily Login!</h2>
        <button class="upg-x pressable" data-act="closeDaily"><svg viewBox="0 0 40 40"><path d="M11 11 L29 29 M29 11 L11 29" stroke="#121212" stroke-width="10" stroke-linecap="round"/><path d="M11 11 L29 29 M29 11 L11 29" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg></button>
      </div>
      <div class="upg-body">
        <div class="dly-grid">
          ${DAILY.rewards
            .map(
              (r, i) => `<button class="dly-tile pressable${i === DAILY.rewards.length - 1 ? ' last' : ''}" data-day="${i + 1}" style="--c1:${r.look[0]};--c2:${r.look[1]};--c3:${r.look[2] ?? r.look[1]}">
            <div class="dly-day o">Day ${i + 1}</div>
            <div class="dly-rar o-thin">${rarityLabel(r.rarity)}</div>
            <div class="dly-ico">${dailyIcon(r)}<b class="dly-claim o">Claim!</b><b class="dly-done">&#10003;</b></div>
            <div class="dly-txt o${r.vacuum ? ' big' : ''}">${r.vacuum ? VACUUMS.find((v) => v.id === r.vacuum).name : dailyLabel(r)}</div>
          </button>`,
            )
            .join('')}
        </div>
        <div class="dly-foot o" data-bind="dailyFoot"></div>
      </div>
    </div>
  </div>
  <div class="levelup idxup"><div class="levelup-t o">INDEX BOOST!</div><div class="levelup-s o" data-bind="idxUpSub"></div></div>
  <div class="levelup"><div class="levelup-t o">LEVEL UP!</div><div class="levelup-s o" data-bind="levelUpSub"></div></div>
  <div class="modal-back"><div class="modal"><button class="x o-thin">X</button><h2 class="o"></h2><p>Coming soon!</p></div></div>
  <div class="toast o"></div>`
}

export function createHud({ showMenu }) {
  const root = document.createElement('div')
  root.id = 'hud'
  root.innerHTML = template()
  document.body.appendChild(root)

  const bind = {}
  root.querySelectorAll('[data-bind]').forEach((el) => (bind[el.dataset.bind] = el))

  // Desktop lays the HUD out in 1920x991. Phones / small windows use the compact layout (.mob in hud.css):
  // a smaller reference space so text stays legible, and windows (--sw) scaled to fit the short screen.
  const fit = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const mob = isCompact()
    root.classList.toggle('mob', mob)
    root.style.setProperty('--s', mob ? Math.min(w / 1250, h / 620) : Math.min(w / REF_W, h / REF_H))
    root.style.setProperty('--sw', mob ? Math.min(w / 800, h / 560) : Math.min(w / REF_W, h / REF_H))
  }
  window.addEventListener('resize', fit)
  fit()

  // Panels and toasts.
  const back = root.querySelector('.modal-back')
  const toast = root.querySelector('.toast')
  let toastTimer = 0
  const say = (text) => {
    toast.textContent = text
    toast.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1600)
  }
  const openPanel = (title) => {
    back.querySelector('h2').textContent = title
    back.classList.add('open')
  }
  const closePanel = () => back.classList.remove('open')
  back.addEventListener('click', (e) => {
    if (e.target === back || e.target.closest('.x')) closePanel()
  })

  // Settings window (Config tile): Sound Effects volume + VFX on/off.
  const cfg = root.querySelector('.cfg')
  const sfxInput = cfg.querySelector('[data-cfg="sfx"]')
  const vfxBtns = [...cfg.querySelectorAll('[data-vfx]')]
  const openConfig = () => {
    document.exitPointerLock?.()
    cfg.classList.add('open')
  }
  const closeConfig = () => cfg.classList.remove('open')
  sfxInput.addEventListener('input', () => setSettings({ sfx: +sfxInput.value }))
  const renderConfig = () => {
    sfxInput.value = settings.sfx
    bind.sfxVal.textContent = settings.sfx
    bind.sfxFill.style.width = `${settings.sfx}%`
    vfxBtns.forEach((b) => b.classList.toggle('sel', (b.dataset.vfx === 'on') === settings.vfx))
    pops.style.display = settings.vfx ? '' : 'none'
  }

  // Controls tutorial: each control ticks off once the player has actually used it.
  const help = root.querySelector('.help')
  const helpMsg = help.querySelector('.help-go')
  const tasks = {}
  help.querySelectorAll('[data-task]').forEach((el) => (tasks[el.dataset.task] = el))
  let helpDone = false
  if (DEV_MODE || DISABLE_TUTORIALS) {
    helpDone = true
    help.classList.add('hide')
  }
  // Hold the guide back until the server says whether this is a new account; saved ones skip it.
  help.classList.add('hide')
  const syncHelp = () => {
    if (helpDone || !state.tutorialReady) return
    if (state.controlsDone) {
      helpDone = true
      return
    }
    help.classList.remove('hide')
  }
  subscribe(syncHelp)
  syncHelp()
  const finishHelp = (msg) => {
    if (helpDone) return
    helpDone = true
    state.controlsDone = true // saved with the account, so it never shows again
    notify()
    if (msg) helpMsg.textContent = msg
    setTimeout(() => help.classList.add('hide'), msg ? 1300 : 0)
    if (msg) setTimeout(() => window.dispatchEvent(new Event('controls-done')), 1300) // props.js lights up the Controls board
  }
  // Highlight the control being taught: the first unfinished task glows, and each of its keys
  // lights up (green) once pressed. Each control finishes on first use (any one WASD key is enough).
  const order = ['move', 'jump', 'blow', 'look', 'zoom', 'cursor']
  const refreshActive = () => {
    const cur = order.find((n) => !tasks[n].classList.contains('done'))
    order.forEach((n) => tasks[n].classList.toggle('active', n === cur))
    if (cur === 'cursor' && cursorPhase < 0) setCursorPhase(document.pointerLockElement ? 1 : 0) // start from what the mouse is doing now
  }
  // Cursor step, read from the live pointer-lock state so it only asks for what comes next:
  // 0 free -> click to grab it, 1 grabbed -> ESC to free it, 2 freed -> click to take it back.
  let cursorPhase = -1
  const CURSOR_STEPS = [
    ['CLICK', '1/3 - Click the world to grab the mouse'],
    ['ESC', '2/3 - Press ESC to free your mouse'],
    ['CLICK', '3/3 - Click the world to get camera control back'],
  ]
  const setCursorPhase = (p) => {
    cursorPhase = p
    const kbd = tasks.cursor.querySelector('kbd')
    kbd.textContent = CURSOR_STEPS[p][0]
    kbd.classList.remove('hit')
    tasks.cursor.querySelector('.cap').textContent = CURSOR_STEPS[p][1]
  }
  const cursorEvent = (ev) => {
    if (helpDone || !tasks.cursor.classList.contains('active')) return
    if (cursorPhase === 0 && (ev === 'click' || ev === 'locked')) setCursorPhase(1)
    else if (cursorPhase === 1 && (ev === 'esc' || ev === 'unlocked')) setCursorPhase(2)
    else if (cursorPhase === 2 && (ev === 'click' || ev === 'locked')) tick1('cursor')
  }
  const hitKey = (name, code) => {
    const el = tasks[name]
    if (helpDone || !el || el.classList.contains('done')) return
    const keys = [...el.querySelectorAll('kbd')]
    keys.forEach((k) => k.dataset.code.split(',').includes(code) && k.classList.add('hit'))
    tick1(name)
  }
  const tick1 = (name) => {
    const el = tasks[name]
    if (helpDone || !el || el.classList.contains('done')) return
    el.classList.add('done')
    el.querySelectorAll('kbd').forEach((k) => k.classList.add('hit'))
    refreshActive()
    if (Object.values(tasks).every((t) => t.classList.contains('done'))) finishHelp('Great! You are ready!')
  }
  refreshActive()
  const moveKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
  let lookPx = 0
  window.addEventListener('keydown', (e) => {
    if (moveKeys.includes(e.code)) hitKey('move', e.code)
    else if (e.code === 'Space') hitKey('jump', e.code)
    else if (e.code === 'KeyF') hitKey('blow', e.code)
    else if (e.code === 'Escape') cursorEvent('esc')
    else if (e.code === 'Enter') finishHelp()
  })
  // Esc while the pointer is locked is swallowed by the browser: it just releases the lock.
  // Look only turns the camera while the mouse is captured, so say so when it is free (e.g. after ESC).
  const lookCap = tasks.look.querySelector('.cap')
  const syncLookCap = () => {
    lookCap.textContent = document.pointerLockElement ? 'Move the mouse' : 'Click the world, then move the mouse'
    tasks.look.classList.toggle('free', !document.pointerLockElement)
  }
  syncLookCap()
  document.addEventListener('pointerlockchange', () => {
    syncLookCap()
    cursorEvent(document.pointerLockElement ? 'locked' : 'unlocked')
  })
  window.addEventListener('pointerdown', (e) => e.button === 0 && e.target.tagName === 'CANVAS' && (hitKey('blow', 'Click'), cursorEvent('click')))
  window.addEventListener('pointermove', (e) => {
    if (!document.pointerLockElement && !(e.buttons & 2)) return
    lookPx += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0)
    if (lookPx > 250) hitKey('look', 'Mouse')
  })
  window.addEventListener('wheel', (e) => e.target.tagName === 'CANVAS' && hitKey('zoom', 'Wheel'), { passive: true })

  root.addEventListener('click', (e) => {
    const el = e.target.closest('button')
    if (!el) return
    if (el.dataset.panel === 'Config') openConfig()
    else if (el.dataset.panel) openPanel(el.dataset.panel)
    else if (el.dataset.buy) say(`${el.dataset.buy}: store coming soon!`)
    else if (el.dataset.lock) toggleLock(el.dataset.lock)
    else if (el.dataset.sell === 'all') sellAll()
    else if (el.dataset.sell) sellItem(el.dataset.sell)
    else if (el.dataset.upgrade) buyUpgrade(el.dataset.upgrade)
    else if (el.dataset.vacuum) pickVacuum(el.dataset.vacuum)
    else if (el.dataset.aura) pickAura(el.dataset.aura)
    else if (el.dataset.day) dailyTile(+el.dataset.day)
    else if (el.dataset.act === 'openDaily') openDaily()
    else if (el.dataset.act === 'closeDaily') closeDaily()
    else if (el.dataset.act === 'openIndex') openIndex()
    else if (el.dataset.act === 'closeIndex') closeIndex()
    else if (el.dataset.act === 'openRebirth') openRebirth()
    else if (el.dataset.act === 'closeRebirth') closeRebirth()
    else if (el.dataset.act === 'rebirth') tryRebirth()
    else if (el.dataset.act === 'closeAuras') closeAuras()
    else if (el.dataset.act === 'closeVacuums') closeVacuums()
    else if (el.dataset.act === 'closeSell') closeSell()
    else if (el.dataset.act === 'closeUpgrades') closeUpgrades()
    else if (el.dataset.act === 'closeConfig') closeConfig()
    else if (el.dataset.vfx) setSettings({ vfx: el.dataset.vfx === 'on' })
    else if (el.dataset.act === 'portal') showMenu()
    else if (el.dataset.act === 'home') respawn()
    else if (el.dataset.act === 'gift') claimGift()
    else if (el.dataset.act === 'chat') say('Chat coming soon!')
  })
  // Keep clicks on the HUD from reaching the game's pointer handlers.
  root.addEventListener('pointerdown', (e) => e.target.closest('button, .modal-back, .upg') && e.stopPropagation())
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      closePanel()
      closeConfig()
      closeSell()
      closeUpgrades()
      closeVacuums()
      closeAuras()
      closeRebirth()
      closeIndex()
      closeDaily()
    }
  })

  setToast(say)
  const sellPanel = root.querySelector('.shp')
  const s = state
  function renderSell() {
    sellPanel.classList.toggle('open', s.sellOpen)
    if (!s.sellOpen) return
    bind.sellTotal.textContent = `+ $${payout(bagValue(unlockedBag())).toLocaleString('en-US')}`
    bind.sellList.innerHTML = groupBag(s.bag)
      .map((g) => {
        const locked = isLocked(g.name)
        return `<div class="shp-row${locked ? ' locked' : ''}">
          <div class="shp-ico">${GLYPH[g.name] ?? '💰'}</div>
          <div class="shp-name o">${g.name}${g.count > 1 ? ` x${g.count}` : ''}</div>
          <div class="shp-val o">+ $${payout(g.value).toLocaleString('en-US')}</div>
          <button class="ubtn sell pressable" data-sell="${g.name}"><span class="o">Sell</span></button>
          <button class="ubtn lock pressable" data-lock="${g.name}"><span class="o">${locked ? 'Unlock' : 'Lock'}</span></button>
        </div>`
      })
      .join('')
  }
  const upgPanel = root.querySelector('.upgr')
  const upgRows = [...root.querySelectorAll('.upg-row')].map((row) => ({
    id: row.dataset.upg,
    lv: row.querySelector('.lv'),
    cash: row.querySelector('.ubtn.cash'),
  }))
  function renderUpgrades() {
    upgPanel.classList.toggle('open', s.upgradesOpen)
    if (!s.upgradesOpen) return
    for (const r of upgRows) {
      const cost = upgradeCost(r.id)
      r.lv.textContent = `Lv.${s.upgrades[r.id]}`
      r.cash.firstChild.textContent = cost === Infinity ? 'MAX' : `$${short(cost)}`
      r.cash.classList.toggle('poor', cost > s.cash)
    }
  }
  const vacPanel = root.querySelector('.vac')
  const vacRows = [...root.querySelectorAll('.vac-row')].map((row) => ({
    id: row.dataset.vac,
    row,
    cash: row.querySelector('.ubtn.cash'),
    gems: row.querySelector('.ubtn.gems'),
  }))
  const vacViews = createVacuumViews(
    [...root.querySelectorAll('.vac-row')].map((row) => ({
      id: row.dataset.vac,
      rarity: VACUUMS.find((x) => x.id === row.dataset.vac).rarity,
      canvas: row.querySelector('canvas'),
    })),
    vacPanel.querySelector('.upg-list'),
  )
  function renderVacuums() {
    vacPanel.classList.toggle('open', s.vacuumsOpen)
    vacViews.setActive(s.vacuumsOpen)
    if (!s.vacuumsOpen) return
    for (const r of vacRows) {
      const v = VACUUMS.find((x) => x.id === r.id)
      const owned = s.vacuumOwned.includes(r.id)
      r.cash.firstChild.textContent = s.vacuum === r.id ? 'Equipped' : owned ? 'Equip' : `$${short(v.cost)}`
      r.cash.classList.toggle('on', s.vacuum === r.id)
      r.cash.classList.toggle('poor', !owned && v.cost > s.cash)
      r.row.classList.toggle('solo', owned || !r.gems)
      if (r.gems) r.gems.style.display = owned ? 'none' : ''
    }
  }
  const aurPanel = root.querySelector('.aur')
  const aurRows = [...root.querySelectorAll('.aur-row')].map((row) => ({
    id: row.dataset.aur,
    row,
    cash: row.querySelector('.ubtn.cash'),
    gems: row.querySelector('.ubtn.gems'),
  }))
  const aurViews = createAuraViews(
    aurRows.map((r) => ({ id: r.id, canvas: r.row.querySelector('canvas') })),
    aurPanel.querySelector('.upg-list'),
  )
  function renderAuras() {
    aurPanel.classList.toggle('open', s.aurasOpen)
    aurViews.setActive(s.aurasOpen)
    if (!s.aurasOpen) return
    for (const r of aurRows) {
      const a = AURAS.find((x) => x.id === r.id)
      const owned = s.auraOwned.includes(r.id)
      r.cash.firstChild.textContent = s.aura === r.id ? 'Equipped' : owned ? 'Equip' : a.cost ? `$${short(a.cost)}` : 'FREE'
      r.cash.classList.toggle('on', s.aura === r.id)
      r.cash.classList.toggle('free', !a.cost && !owned)
      r.cash.classList.toggle('poor', !owned && a.cost > s.cash)
      r.cash.classList.toggle('afford', s.aura !== r.id && (owned || (a.cost > 0 && a.cost <= s.cash)))
      r.row.classList.toggle('solo', owned || !r.gems)
      if (r.gems) r.gems.style.display = owned ? 'none' : ''
    }
  }
  const idxPanel = root.querySelector('.idx')
  const idxTiles = [...idxPanel.querySelectorAll('.idx-tile')].map((el) => ({
    name: el.dataset.idx,
    el,
    canvas: el.querySelector('canvas'),
    label: el.querySelector('.idx-name'),
    val: el.querySelector('.idx-val'),
  }))
  const idxViews = createIndexViews(
    idxTiles.map((t) => ({ name: t.name, canvas: t.canvas })),
    idxPanel.querySelector('.idx-grid'),
    (name) => s.discovered.includes(name),
  )
  function renderIndex() {
    idxPanel.classList.toggle('open', s.indexOpen)
    idxViews.setActive(s.indexOpen)
    if (!s.indexOpen) return
    for (const t of idxTiles) {
      const found = s.discovered.includes(t.name)
      t.el.classList.toggle('found', found)
      t.label.textContent = found ? t.name : '???'
      t.val.textContent = found ? `$${short(ITEM_INFO[t.name].value)}` : '???'
    }
    const { done, step } = indexProgress()
    bind.idxCount.textContent = `${s.discovered.length}/${ITEM_CATALOG.length}`
    const next = (Math.floor(s.discovered.length / step) + 1) * INDEX.boost
    bind.idxMsg.textContent = `Collect ${step - done} Items for ${Math.round(next * 100)}% Power Boost!`
    bind.idxFill.style.width = `${(done / step) * 100}%`
    bind.idxBar.textContent = `${done}/${step} Collected`
  }
  // Daily Login: the tile for the day that is up claims it; the others explain why not.
  const dlyPanel = root.querySelector('.dly')
  const dlyTiles = [...dlyPanel.querySelectorAll('.dly-tile')]
  const dlyViews = createVacuumViews(
    DAILY.rewards.flatMap((r, i) => (r.vacuum ? [{ id: r.vacuum, rarity: r.rarity, canvas: dlyTiles[i].querySelector('canvas') }] : [])),
    null,
  )
  function dailyTile(day) {
    const { claimable, next, claimed } = dailyStatus()
    if (claimable && day === next) claimDaily()
    else if (day <= claimed) say('Already claimed!')
    else say(`Day ${day} unlocks after day ${day - 1}!`)
  }
  function renderDaily() {
    const { claimable, next, claimed, msLeft } = dailyStatus()
    dlyPanel.classList.toggle('open', s.dailyOpen)
    dlyViews.setActive(s.dailyOpen)
    if (!s.dailyOpen) return
    dlyTiles.forEach((el, i) => {
      el.classList.toggle('claimed', i < claimed)
      el.classList.toggle('current', claimable && i + 1 === next)
    })
    bind.dailyFoot.textContent = claimable ? 'Your reward is ready!' : `Next reward in ${hms(msLeft / 1000)}`
  }
  const rebPanel = root.querySelector('.reb')
  const mult = (x) => `x${+x.toFixed(2)}`
  function renderRebirth() {
    rebPanel.classList.toggle('open', s.rebirthOpen)
    if (!s.rebirthOpen) return
    const need = rebirthLevel()
    bind.rebPowerNow.textContent = mult(powerGainMultiplier())
    bind.rebPowerNext.textContent = mult(powerGainMultiplier(s.rebirths + 1))
    bind.rebCashNow.textContent = mult(cashMultiplier())
    bind.rebCashNext.textContent = mult(cashMultiplier(s.rebirths + 1))
    bind.rebLvlNow.textContent = `Lvl. ${need}`
    bind.rebFill.style.width = `${rebirthProgress() * 100}%`
    bind.rebBar.textContent = `Lvl. ${Math.min(s.level, need)} / ${need}`
  }
  // "LEVEL UP!" banner: replays whenever the level rises (a rebirth reset does not trigger it).
  const levelUp = root.querySelector('.levelup:not(.idxup)')
  const { inMs, holdMs, outMs } = LEVEL_UP_POPUP
  const totalMs = inMs + holdMs + outMs
  let lastLevel = s.level
  let levelUpAnim = null
  const levelUpSfx = new Audio(`${import.meta.env.BASE_URL}audio/level_up.mp3`)
  levelUpSfx.volume = 0.4
  function renderLevelUp() {
    if (s.level > lastLevel) {
      try {
        levelUpSfx.volume = 0.4 * sfx()
        levelUpSfx.currentTime = 0
        levelUpSfx.play()?.catch(() => {})
      } catch {}
      bind.levelUpSub.textContent = `Level ${s.level}`
      levelUpAnim?.cancel()
      levelUpAnim = levelUp.animate(
        [
          { opacity: 0, transform: 'translateX(-50%) translateY(14px) scale(0.4)', offset: 0 },
          { opacity: 1, transform: 'translateX(-50%) scale(1.14)', offset: (inMs * 0.62) / totalMs },
          { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: inMs / totalMs },
          { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: (inMs + holdMs) / totalMs },
          { opacity: 0, transform: 'translateX(-50%) translateY(-46px) scale(1)', offset: 1 },
        ],
        { duration: totalMs, easing: 'ease-out' },
      )
    }
    lastLevel = s.level
  }
  // Win fanfare (no audio file needed): a rising C-major arpeggio ending on a held chord.
  let audioCtx = null
  function playWin() {
    try {
      audioCtx ??= new (window.AudioContext || window.webkitAudioContext)()
      const ctx = audioCtx
      ctx.resume?.()
      const t0 = ctx.currentTime + 0.02
      const note = (freq, at, dur, vol) => {
        vol *= sfx()
        if (vol < 0.0002) return
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'triangle'
        o.frequency.value = freq
        g.gain.setValueAtTime(0.0001, t0 + at)
        g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur)
        o.connect(g).connect(ctx.destination)
        o.start(t0 + at)
        o.stop(t0 + at + dur + 0.05)
      }
      ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.09, 0.22, 0.16))
      ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f) => note(f, 0.4, 0.9, 0.09))
    } catch {}
  }
  // "INDEX BOOST!" banner: plays each time another full set of INDEX.step items is discovered.
  const idxUp = root.querySelector('.idxup')
  let lastSets = Math.floor(s.discovered.length / INDEX.step)
  function renderIndexBoost() {
    const sets = Math.floor(s.discovered.length / INDEX.step)
    if (sets > lastSets) {
      playWin()
      bind.idxUpSub.textContent = `Power Boost is now +${Math.round(sets * INDEX.boost * 100)}%!`
      idxUp.animate(
        [
          { opacity: 0, transform: 'translateX(-50%) translateY(14px) scale(0.4)', offset: 0 },
          { opacity: 1, transform: 'translateX(-50%) scale(1.14)', offset: 0.12 },
          { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: 0.2 },
          { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: 0.8 },
          { opacity: 0, transform: 'translateX(-50%) translateY(-46px) scale(1)', offset: 1 },
        ],
        { duration: 2800, easing: 'ease-out' },
      )
    }
    lastSets = sets
  }
  function render() {
    renderIndexBoost()
    renderLevelUp()
    renderDaily()
    renderRebirth()
    renderIndex()
    renderAuras()
    renderVacuums()
    renderSell()
    renderUpgrades()
    bind.level.textContent = `Level ${s.level}`
    bind.xp.textContent = `${s.xp}/${s.xpNext}`
    bind.xpFill.style.width = `${(100 * s.xp) / s.xpNext}%`
    bind.power.textContent = `Power : ${short(totalPower())}`
    bind.leaves.textContent = short(s.leaves)
    bind.backpack.textContent = `${s.backpack}/${s.backpackMax}`
    bind.rebirths.textContent = short(s.rebirths)
    bind.cash.textContent = `$${short(s.cash)}`
    bind.rebirth.textContent = `${Math.floor(rebirthProgress() * 100)}%`
  }
  const giftBtn = root.querySelector('.gift')
  const giftViews = createVacuumViews(
    [{ id: FREE_GIFT.vacuum, rarity: VACUUMS.find((v) => v.id === FREE_GIFT.vacuum).rarity, canvas: giftBtn.querySelector('canvas') }],
    null,
  )
  giftViews.setActive(true)
  let lastTick = performance.now()
  function tick() {
    const now = performance.now()
    const dt = (now - lastTick) / 1000
    lastTick = now
    if (document.visibilityState === 'visible' && dt < 2 && !state.giftClaimed) addPlaySeconds(dt)
    giftBtn.hidden = state.giftClaimed
    const left = FREE_GIFT.playSeconds - state.playSeconds
    bind.gift.textContent = left > 0 ? `FREE IN ${mmss(left)}` : 'CLAIM!'
    giftBtn.classList.toggle('ready', left <= 0)
    tickBoosts()
    if (s.dailyOpen || dailyWas !== dailyStatus().claimable) renderDaily()
    dailyWas = dailyStatus().claimable
  }
  // Active x2 boosts: a pill with the time left; totals (Power, payouts) re-render when one ends.
  let dailyWas = dailyStatus().claimable
  let boostSig = ''
  function tickBoosts() {
    for (const [kind, name] of [['power', 'Power'], ['cash', 'Cash']]) {
      const el = bind[kind === 'power' ? 'boostPower' : 'boostCash']
      const left = boostLeft(kind)
      el.style.display = left > 0 ? '' : 'none'
      if (left > 0) el.textContent = `${DAILY.boostMult}x ${name} ${hms(left / 1000)}`
    }
    const sig = `${boostActive('power')}${boostActive('cash')}`
    if (sig !== boostSig) {
      boostSig = sig
      render()
    }
  }
  // "+N Power" pop floats up from the player's chest on every training tick (scattered randomly
  // around the player so rapid ticks don't stack), like the +Strength pop in the Chop Trees game.
  const pops = document.createElement('div')
  pops.className = 'pops'
  root.appendChild(pops)
  // Tick sound: one preloaded element, restarted per tick. Quieter than the one-off cash/level-up
  // sfx (0.5/0.4) since it repeats every training tick.
  const powerSfx = new Audio(`${import.meta.env.BASE_URL}audio/power_gain.mp3`)
  powerSfx.preload = 'auto'
  onPowerGain((n) => {
    try {
      powerSfx.volume = 0.3 * sfx()
      powerSfx.currentTime = 0
      powerSfx.play()?.catch(() => {})
    } catch {}
    if (!settings.vfx) return
    const el = document.createElement('div')
    el.className = 'chop-pop'
    el.style.left = `${playerScreen.x * 100 + (Math.random() - 0.5) * 16}%`
    el.style.top = `${playerScreen.y * 100 - 4 + (Math.random() - 0.5) * 16}%`
    el.innerHTML = `<span class="chop-pop-row"><img class="chop-pop-ico" src="${import.meta.env.BASE_URL}UI/swirl.png" alt="" draggable="false"><span class="o">+${short(n)}</span></span>`
    pops.appendChild(el)
    if (pops.childElementCount > 12) pops.firstChild.remove()
    el.addEventListener('animationend', () => el.remove())
    setTimeout(() => el.remove(), 1200)
  })
  // Any window open: blur the world behind it and freeze wheel zoom (input.js reads the same class).
  const syncWindowOpen = () =>
    document.body.classList.toggle(
      'win-open',
      s.sellOpen || s.dailyOpen || s.upgradesOpen || s.vacuumsOpen || s.rebirthOpen || s.indexOpen || s.aurasOpen || back.classList.contains('open') || cfg.classList.contains('open'),
    )
  new MutationObserver(syncWindowOpen).observe(back, { attributes: true, attributeFilter: ['class'] })
  new MutationObserver(syncWindowOpen).observe(cfg, { attributes: true, attributeFilter: ['class'] })
  subscribeSettings(renderConfig)
  renderConfig()
  render()
  subscribe(render)
  subscribe(syncWindowOpen)
  syncWindowOpen()
  tick()
  setInterval(tick, 250)
  // Corridor progress: hub edge (bottom) -> end of the field (top).
  const trailSpan = LEAVES.minX - LEAVES.maxX
  let wasInField = false
  const trailLoop = () => {
    const t = Math.min(1, Math.max(0, (LEAVES.minX - player.position.x) / trailSpan))
    bind.trailMe.style.bottom = `calc(${t * 100}% - 20px)`
    // In the leaf corridor the menu tiles and level bar give way to a Home button.
    const inField = player.position.x < LEAVES.minX
    if (inField !== wasInField) root.classList.toggle('in-field', (wasInField = inField))
    requestAnimationFrame(trailLoop)
  }
  trailLoop()
  return { render }
}
