// The on-screen HUD: system buttons, free-gift timer, menu tiles, currency
// stats, level bar, power, luck-event pill, boosts, spin packs and hotbar.
// Plain DOM over the canvas. Menu tiles open a placeholder panel; purchase
// buttons show a toast (no store yet).
import './hud.css'
import { DEV_MODE, INDEX, BUY_WITH_BLOXBUX, LEAVES, LEVEL_UP_POPUP, FREE_GIFT, UPGRADES, VACUUMS, AURAS, VACUUM_RARITY } from './config.js'
import { player, respawn } from './player.js'
import { ICONS, auraIcon, vacuumIcon } from './icons.js'
import { mmss } from './timers.js'
import { ITEM_CATALOG, ITEM_INFO, RARITY, RARITY_ROW_BG } from './data/loot.js'
import { closeIndex, indexProgress, openIndex } from './index.js'
import { createIndexViews } from './indexView.js'
import { playerScreen } from './screenPos.js'
import { addPlaySeconds, state, subscribe, setToast, onPowerGain, totalPower, cashMultiplier, powerGainMultiplier } from './state.js'
import { closeRebirth, openRebirth, rebirthLevel, rebirthProgress, tryRebirth } from './rebirth.js'
import { bagValue, closeSell, groupBag, isLocked, payout, sellAll, sellItem, toggleLock, unlockedBag } from './sell.js'
import { buyUpgrade, closeUpgrades, upgradeCost } from './upgrades.js'
import { claimGift, closeVacuums, pickVacuum } from './vacuums.js'
import { createVacuumViews } from './vacuumView.js'
import { settings, setSettings, subscribeSettings, sfx } from './settings.js'
import { closeAuras, pickAura } from './auras.js'
import { createAuraViews } from './auraView.js'

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
  return `${i ? +n.toFixed(n < 100 ? 1 : 0) : n}${units[i]}`
}

const icon = (name) => `<i>${ICONS[name]}</i>`
const gem = `<i>${ICONS.gem}</i>`

// Rarity name in its colour; Mythic cycles through a gradient letter by letter.
function rarityLabel(rarity) {
  const c = VACUUM_RARITY[rarity].text
  if (typeof c === 'string') return `<span style="color:${c}">${rarity}</span>`
  return [...rarity].map((ch, i) => `<span style="color:${c[Math.min(c.length - 1, Math.floor((i / rarity.length) * c.length))]}">${ch}</span>`).join('')
}

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
      <div class="gun"><canvas></canvas>${ICONS.gun}</div>
      <div class="gname o-thin">${VACUUMS.find((v) => v.id === FREE_GIFT.vacuum).name}</div>
      <div class="gpow o">${short(VACUUMS.find((v) => v.id === FREE_GIFT.vacuum).power)} Power</div>
      <div class="gprice o"><s>$${short(VACUUMS.find((v) => v.id === FREE_GIFT.vacuum).cost)}</s><b>FREE</b></div>
    </button>
    <div class="menu">
      <button class="tile wide pressable" data-panel="Quests">${icon('pencil')}<span class="o">Quests</span></button>
      <button class="tile pressable" data-act="openIndex">${icon('book')}<span class="o">Index</span></button>
      <button class="tile pressable" data-panel="Config">${icon('gear')}<span class="o">Config</span></button>
      <button class="tile pressable" data-act="openRebirth">${icon('rebirth')}<span class="o">Rebirth</span><b class="pct o-thin" data-bind="rebirth"></b></button>
      <button class="tile pressable" data-panel="Daily">${icon('calendar')}<span class="o">Daily</span><b class="alert">!</b></button>
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
  </div>

  <div class="anchor a-bc">
    <div class="hotbar">
      <button class="slot active" data-slot="0">${icon('grid')}</button>
      <button class="slot" data-slot="1">${icon('key')}</button>
      <button class="slot" data-slot="2">${icon('vacuumTool')}</button>
    </div>
  </div>

  <div class="anchor a-hint">
    <div class="help">
      <div class="help-col" data-task="move">
        <div class="chk" aria-hidden="true">&#10003;</div>
        <h3 class="o">Move</h3>
        <div class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div>
        <div class="cap o-thin">Press any one</div>
      </div>
      <div class="help-col" data-task="jump">
        <div class="chk" aria-hidden="true">&#10003;</div>
        <h3 class="o">Jump</h3>
        <div class="keys"><kbd class="wide">SPACE</kbd></div>
        <div class="cap o-thin">Press it</div>
      </div>
      <div class="help-col" data-task="blow">
        <div class="chk" aria-hidden="true">&#10003;</div>
        <h3 class="o">Blow Leaves</h3>
        <div class="keys"><kbd>F</kbd><span class="or o-thin">or</span><kbd class="wide">CLICK</kbd></div>
        <div class="cap o-thin">Try it</div>
      </div>
      <div class="help-col" data-task="look">
        <div class="chk" aria-hidden="true">&#10003;</div>
        <h3 class="o">Look</h3>
        <div class="keys"><kbd class="wide">MOUSE</kbd></div>
        <div class="cap o-thin">Move the mouse</div>
      </div>
      <div class="help-col" data-task="zoom">
        <div class="chk" aria-hidden="true">&#10003;</div>
        <h3 class="o">Zoom</h3>
        <div class="keys"><kbd class="wide">WHEEL</kbd></div>
        <div class="cap o-thin">Scroll once</div>
      </div>
      <div class="help-col" data-optional>
        
        <h3 class="o">Menu</h3>
        <div class="keys"><kbd class="wide">ESC</kbd></div>
        <div class="cap o-thin">Free cursor</div>
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

  const fit = () => root.style.setProperty('--s', Math.min(window.innerWidth / REF_W, window.innerHeight / REF_H))
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
  if (DEV_MODE) {
    helpDone = true
    help.classList.add('hide')
  }
  const finishHelp = (msg) => {
    if (helpDone) return
    helpDone = true
    if (msg) helpMsg.textContent = msg
    setTimeout(() => help.classList.add('hide'), msg ? 1300 : 0)
  }
  const tick1 = (name) => {
    const el = tasks[name]
    if (helpDone || !el || el.classList.contains('done')) return
    el.classList.add('done')
    if (Object.values(tasks).every((t) => t.classList.contains('done'))) finishHelp('Great! You are ready!')
  }
  const moveKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
  let lookPx = 0
  window.addEventListener('keydown', (e) => {
    if (moveKeys.includes(e.code)) tick1('move')
    else if (e.code === 'Space') tick1('jump')
    else if (e.code === 'KeyF') tick1('blow')
    else if (e.code === 'Enter') finishHelp()
  })
  window.addEventListener('pointerdown', (e) => e.button === 0 && e.target.tagName === 'CANVAS' && tick1('blow'))
  window.addEventListener('pointermove', (e) => {
    if (!document.pointerLockElement && !(e.buttons & 2)) return
    lookPx += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0)
    if (lookPx > 250) tick1('look')
  })
  window.addEventListener('wheel', (e) => e.target.tagName === 'CANVAS' && tick1('zoom'), { passive: true })

  const slots = [...root.querySelectorAll('.slot')]
  const selectSlot = (i) => slots.forEach((s, k) => s.classList.toggle('active', k === i))

  root.addEventListener('click', (e) => {
    const el = e.target.closest('button')
    if (!el) return
    if (el.dataset.panel === 'Config') openConfig()
    else if (el.dataset.panel) openPanel(el.dataset.panel)
    else if (el.dataset.buy) say(`${el.dataset.buy}: store coming soon!`)
    else if (el.dataset.slot) selectSlot(+el.dataset.slot)
    else if (el.dataset.lock) toggleLock(el.dataset.lock)
    else if (el.dataset.sell === 'all') sellAll()
    else if (el.dataset.sell) sellItem(el.dataset.sell)
    else if (el.dataset.upgrade) buyUpgrade(el.dataset.upgrade)
    else if (el.dataset.vacuum) pickVacuum(el.dataset.vacuum)
    else if (el.dataset.aura) pickAura(el.dataset.aura)
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
    }
    const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code)
    if (n >= 0) selectSlot(n)
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
  const levelUp = root.querySelector('.levelup')
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
  }
  // "+N Power" pop floats up from the player's chest on every training tick (scattered randomly
  // around the player so rapid ticks don't stack), like the +Strength pop in the Chop Trees game.
  const pops = document.createElement('div')
  pops.className = 'pops'
  root.appendChild(pops)
  onPowerGain((n) => {
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
      s.sellOpen || s.upgradesOpen || s.vacuumsOpen || s.rebirthOpen || s.indexOpen || s.aurasOpen || back.classList.contains('open') || cfg.classList.contains('open'),
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
