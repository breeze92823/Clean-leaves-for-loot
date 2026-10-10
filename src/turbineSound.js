// Proximity audio for the Twin Turbine showcase: a screaming twin-jet whine, a roaring air
// rush and a sub rumble that swell as the player walks up. Procedural, built lazily, never throws.
import { sfx } from './settings.js'

const JET_VOLUME = 0.7 // 0..1, the recorded loop at full closeness

export function createTurbineSound() {
  // The recorded jet loop is the main voice; the procedural layer below adds wind rush and rumble.
  let jet = null
  try {
    jet = new Audio(`${import.meta.env.BASE_URL}audio/jet-vaccum.mp3`)
    jet.loop = true
    jet.volume = 0
  } catch {}
  function setJet(closeness) {
    if (!jet) return
    try {
      const v = Math.min(1, closeness ** 1.5 * JET_VOLUME * sfx())
      jet.volume = v
      jet.playbackRate = 0.95 + closeness * 0.2 // closer = faster, higher rush
      if (v > 0.003) {
        if (jet.paused) jet.play()?.catch(() => {})
      } else if (!jet.paused) jet.pause()
    } catch {}
  }
  let ctx = null
  let nodes = null
  let failed = false

  function init() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) throw new Error('no WebAudio')
      ctx = new AC()
      const master = ctx.createGain()
      master.gain.value = 0
      master.connect(ctx.destination)

      // Roaring airflow: looped noise through a swept band-pass.
      const len = ctx.sampleRate * 2
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
      const noise = ctx.createBufferSource()
      noise.buffer = buf
      noise.loop = true
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1100
      bp.Q.value = 0.5
      const roar = ctx.createGain()
      roar.gain.value = 0.5
      noise.connect(bp).connect(roar).connect(master)

      // Two slightly detuned turbine whines (the "twin") with a fast flutter.
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 23
      const lfoDepth = ctx.createGain()
      lfoDepth.gain.value = 18
      lfo.connect(lfoDepth)
      const whines = [820, 868].map((f) => {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = f
        lfoDepth.connect(o.frequency)
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 2600
        const g = ctx.createGain()
        g.gain.value = 0.07
        o.connect(lp).connect(g).connect(master)
        o.start()
        return o
      })

      // Sub rumble.
      const sub = ctx.createOscillator()
      sub.type = 'sawtooth'
      sub.frequency.value = 48
      const slp = ctx.createBiquadFilter()
      slp.type = 'lowpass'
      slp.frequency.value = 140
      const subGain = ctx.createGain()
      subGain.gain.value = 0.35
      sub.connect(slp).connect(subGain).connect(master)

      noise.start()
      sub.start()
      lfo.start()
      nodes = { master, bp, whines, sub }
    } catch {
      failed = true
    }
  }

  // closeness: 0 (out of earshot) .. 1 (right beside it).
  return {
    set(closeness) {
      setJet(closeness)
      if (failed) return
      if (!ctx) {
        if (closeness < 0.01) return
        init()
        if (failed) return
      }
      try {
        if (ctx.state === 'suspended') ctx.resume()
        const t = ctx.currentTime
        const c = closeness * closeness
        nodes.master.gain.setTargetAtTime(c * 0.12 * sfx(), t, 0.12)
        // Closer = higher, angrier pitch.
        nodes.bp.frequency.setTargetAtTime(700 + closeness * 1500, t, 0.1)
        nodes.whines[0].frequency.setTargetAtTime(700 + closeness * 380, t, 0.15)
        nodes.whines[1].frequency.setTargetAtTime(742 + closeness * 400, t, 0.15)
        nodes.sub.frequency.setTargetAtTime(38 + closeness * 22, t, 0.15)
      } catch {
        failed = true
      }
    },
  }
}
