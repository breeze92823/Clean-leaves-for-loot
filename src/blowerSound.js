// Procedural leaf-blower audio: filtered noise (airflow) + a low saw (motor).
// Built lazily on first use (needs a user gesture) and never throws.
import { sfx } from './settings.js'

export function createBlowerSound() {
  let ctx = null
  let nodes = null
  let failed = false

  function init() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) throw new Error('no WebAudio')
      ctx = new AC()
      const len = ctx.sampleRate * 2
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
      const noise = ctx.createBufferSource()
      noise.buffer = buf
      noise.loop = true
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 0.6
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 3200
      const air = ctx.createGain()
      air.gain.value = 0
      noise.connect(bp).connect(lp).connect(air).connect(ctx.destination)

      const motor = ctx.createOscillator()
      motor.type = 'sawtooth'
      const mlp = ctx.createBiquadFilter()
      mlp.type = 'lowpass'
      mlp.frequency.value = 260
      const hum = ctx.createGain()
      hum.gain.value = 0
      motor.connect(mlp).connect(hum).connect(ctx.destination)

      noise.start()
      motor.start()
      nodes = { bp, air, motor, hum }
    } catch {
      failed = true
    }
  }

  // power: 0..1 (the blower's wind-up ramp).
  return {
    set(power) {
      if (failed) return
      if (!ctx) {
        if (power < 0.01) return
        init()
        if (failed) return
      }
      try {
        if (ctx.state === 'suspended') ctx.resume()
        const t = ctx.currentTime
        nodes.air.gain.setTargetAtTime(power * 0.22 * sfx(), t, 0.05)
        nodes.bp.frequency.setTargetAtTime(350 + power * 950, t, 0.08)
        nodes.hum.gain.setTargetAtTime(power * 0.05 * sfx(), t, 0.05)
        nodes.motor.frequency.setTargetAtTime(60 + power * 75, t, 0.1)
      } catch {
        failed = true
      }
    },
  }
}
