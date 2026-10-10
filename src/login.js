// "Log in with Bloxity" button: visible only while nobody is signed in, hidden once auth.user exists.
// Hidden until auth has settled (so it doesn't flash during loading) and in VITE_DEV_MODE (no SDK).
import { DEV_MODE } from './config.js'
import { sdk, subscribeAuth } from './bloxity.js'
import { isTouch } from './device.js'

const PORTAL_URL = 'https://bloxity.io'

function openLogin() {
  const SDK = sdk()
  try {
    const auth = SDK?.auth
    for (const name of ['login', 'signIn', 'showLogin', 'openLogin', 'requestLogin']) {
      if (typeof auth?.[name] === 'function') return auth[name]()
    }
    if (typeof SDK?.portal?.showLogin === 'function') return SDK.portal.showLogin()
  } catch {
    // Fall through to the portal page.
  }
  window.open(PORTAL_URL, '_blank', 'noopener')
}

export function createLoginButton() {
  if (DEV_MODE) return
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.textContent = 'Log in with Bloxity'
  btn.hidden = true
  btn.style.cssText =
    'position:fixed;top:14px;left:14px;z-index:50;padding:10px 20px;border:3px solid #1d2b53;' +
    'border-radius:12px;background:#ffd23f;color:#1d2b53;font:600 18px Fredoka,system-ui,sans-serif;cursor:pointer;' +
    'box-shadow:0 4px 0 #1d2b53'
  // Phones: bottom centre, clear of the HUD corners and the thumb controls.
  if (isTouch) btn.style.cssText += ';top:auto;bottom:10px;left:50%;transform:translateX(-50%);padding:6px 14px;font-size:15px;white-space:nowrap'
  btn.addEventListener('click', openLogin)
  document.body.appendChild(btn)
  subscribeAuth((s) => {
    btn.hidden = !s.ready || !!s.user
  })
}
