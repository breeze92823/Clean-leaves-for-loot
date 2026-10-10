// In-world text and painted panels, drawn to canvases. Everything painted here
// is repainted once the web font arrives (until then the fallback font shows),
// and dynamic ones repaint on setText. A repaint swaps in a fresh texture, so
// the canvas size may change with the text.
import { DoubleSide, FrontSide, Mesh, MeshBasicMaterial, PlaneGeometry, Sprite, SpriteMaterial } from 'three'
import { FONT_FAMILY } from './config.js'
import { toTexture } from './textures.js'

const painted = new Set()

export const fontsReady = Promise.race([
  document.fonts?.load(`700 64px "${FONT_FAMILY}"`) ?? Promise.resolve(),
  new Promise((r) => setTimeout(r, 4000)),
]).catch(() => {})
fontsReady.then(() => painted.forEach((p) => p.repaint()))

export const font = (px) => `700 ${px}px "${FONT_FAMILY}", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif`

// A canvas-backed quad. `paint()` returns a canvas; the quad is `height` metres
// tall and as wide as the canvas aspect demands (or exactly `width` if given).
function paintedQuad({ paint, height, width, billboard = false, doubleSided = false }) {
  const material = billboard
    ? new SpriteMaterial({ transparent: true, depthWrite: false })
    : new MeshBasicMaterial({ transparent: true, depthWrite: false, side: doubleSided ? DoubleSide : FrontSide })
  const object = billboard ? new Sprite(material) : new Mesh(new PlaneGeometry(1, 1), material)
  object.renderOrder = 2
  const quad = {
    object,
    paint,
    repaint() {
      const c = quad.paint()
      const old = material.map
      material.map = toTexture(c, { repeat: false })
      material.needsUpdate = !old
      old?.dispose()
      object.scale.set(width ?? (height * c.width) / c.height, height, 1)
    },
  }
  quad.repaint()
  painted.add(quad)
  // For short-lived labels: stop repainting and free the texture.
  quad.dispose = () => {
    painted.delete(quad)
    material.map?.dispose()
    material.dispose()
  }
  return quad
}

// Fill: a colour, or an array of colours for a top-to-bottom gradient per line.
export function drawText(g, text, x, y, { px, fill = '#fff', stroke = '#000', strokeW = px * 0.16, shadow = true, align = 'center' }) {
  g.font = font(px)
  g.textAlign = align
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  if (stroke) {
    g.lineWidth = strokeW * 2
    g.strokeStyle = stroke
    if (shadow) g.strokeText(text, x, y + px * 0.07)
    g.strokeText(text, x, y)
  }
  if (Array.isArray(fill)) {
    const grad = g.createLinearGradient(0, y - px * 0.45, 0, y + px * 0.45)
    fill.forEach((c, i) => grad.addColorStop(i / (fill.length - 1), c))
    g.fillStyle = grad
  } else {
    g.fillStyle = fill
  }
  g.fillText(text, x, y)
}

// Optional per-line `icon` (an Image) is drawn left of the text; repaints once it loads.
export function loadIcon(url) {
  const img = new Image()
  img.onload = () => painted.forEach((p) => p.repaint())
  img.src = url
  return img
}

// Stacked lines of outlined text. lines: [{ text, px?, fill?, stroke? }] or a string.
export function textLabel(lines, { height, px = 96, fill, stroke = '#1a1a1a', billboard = true, doubleSided } = {}) {
  let spec = (typeof lines === 'string' ? [{ text: lines }] : lines).map((l) => ({ px, fill, stroke, ...l }))
  const quad = paintedQuad({
    height,
    billboard,
    doubleSided,
    paint() {
      const probe = document.createElement('canvas').getContext('2d')
      let w = 0
      let h = 0
      for (const l of spec) {
        probe.font = font(l.px)
        w = Math.max(w, probe.measureText(l.text).width + l.px * 0.5 + (l.icon ? l.px * 1.1 : 0))
        h += l.px * 1.15
      }
      const c = document.createElement('canvas')
      c.width = Math.ceil(w)
      c.height = Math.ceil(h + 8)
      const g = c.getContext('2d')
      let y = 4
      for (const l of spec) {
        y += l.px * 0.575
        if (l.icon?.complete && l.icon.naturalWidth) {
          probe.font = font(l.px)
          const iw = l.px * 1.0
          const total = iw + l.px * 0.1 + probe.measureText(l.text).width
          const x0 = (c.width - total) / 2
          g.drawImage(l.icon, x0, y - iw / 2, iw, iw)
          drawText(g, l.text, x0 + iw + l.px * 0.1, y, { px: l.px, fill: l.fill ?? '#fff', stroke: l.stroke, align: 'left' })
        } else drawText(g, l.text, c.width / 2, y, { px: l.px, fill: l.fill ?? '#fff', stroke: l.stroke })
        y += l.px * 0.575
      }
      return c
    },
  })
  // Same line count expected: `height` covers the whole block of lines.
  quad.setLines = (next) => {
    spec = (typeof next === 'string' ? [{ text: next }] : next).map((l) => ({ px, fill, stroke, ...l }))
    quad.repaint()
  }
  return quad
}

// A fixed-size painted panel: draw(g, w, h) paints onto a w x h canvas.
export function panel(wPx, hPx, draw, { height, width, billboard = false, doubleSided } = {}) {
  return paintedQuad({
    height,
    width,
    billboard,
    doubleSided,
    paint() {
      const c = document.createElement('canvas')
      c.width = wPx
      c.height = hPx
      draw(c.getContext('2d'), wPx, hPx)
      return c
    },
  })
}
