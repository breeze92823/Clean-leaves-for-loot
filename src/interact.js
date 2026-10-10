// "Press E" prompts. Systems offer what is in reach each frame; the nearest one is shown
// and runs when E is pressed.
import { inputState } from './input.js'

const el = document.createElement('div')
el.className = 'prompt o'
el.innerHTML = '<kbd>E</kbd><span></span>'
el.style.display = 'none'
document.body.appendChild(el)
const text = el.querySelector('span')
el.addEventListener('pointerdown', (e) => {
  inputState.interact = true // touch: the prompt is the E button (touch.css makes it tappable)
  e.stopPropagation()
})

let best = null
let shown = null

export function offer(label, run, dist) {
  if (!best || dist < best.dist) best = { label, run, dist }
}

// Call once per frame after every system has offered.
export function resolveInteract() {
  const label = best ? best.label : null
  if (label !== shown) {
    shown = label
    if (label) text.textContent = label
    el.style.display = label ? 'flex' : 'none'
  }
  if (best && inputState.interact) best.run()
  inputState.interact = false
  best = null
}
