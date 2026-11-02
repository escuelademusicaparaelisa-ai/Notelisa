import { describe, expect, it } from 'vitest'
import { midiToFrequency } from '../../music/pitch'
import { ChordListener, noteSounds, SPECTRUM_SIZE, spectrumOf } from './chordListener'

const RATE = 48000

/** A rough piano-like tone: many harmonics, the low ones with a weak fundamental. */
function tone(midi: number, amplitude = 0.1, offset = 0): Float64Array {
  const out = new Float64Array(SPECTRUM_SIZE)
  const f0 = midiToFrequency(midi)
  for (let h = 1; h <= 10; h++) {
    const f = f0 * h * Math.sqrt(1 + 0.0004 * h * h) // slight stretch, as on a real string
    if (f > RATE / 2) break
    const weight = (h === 1 && midi < 45 ? 0.3 : 1) / h
    for (let i = 0; i < out.length; i++) out[i] += amplitude * weight * Math.sin(2 * Math.PI * f * (i + offset) / RATE + h)
  }
  return out
}

function mix(...parts: Float64Array[]): Float64Array {
  const out = new Float64Array(SPECTRUM_SIZE)
  for (const p of parts) for (let i = 0; i < out.length; i++) out[i] += p[i]
  // A little room noise.
  let seed = 1
  for (let i = 0; i < out.length; i++) {
    seed = (seed * 16807) % 2147483647
    out[i] += 0.002 * (seed / 2147483647 - 0.5)
  }
  return out
}

const heard = (samples: Float64Array, midis: number[]) => {
  const spectrum = spectrumOf(samples, RATE)
  return midis.filter(m => noteSounds(spectrum, m))
}

describe('noteSounds', () => {
  it('hears every note of two hands playing together', () => {
    // Left hand C3 + G3, right hand E5.
    const samples = mix(tone(48), tone(55), tone(76))
    expect(heard(samples, [48, 55, 76])).toEqual([48, 55, 76])
  })

  it('does not hear notes that are not played', () => {
    const samples = mix(tone(48), tone(55), tone(76))
    // Neighbours of the played notes, and a note a fifth away.
    expect(heard(samples, [47, 49, 54, 56, 75, 77, 62])).toEqual([])
  })

  it('hears a low bass note by its harmonics', () => {
    const samples = mix(tone(36), tone(72))
    expect(heard(samples, [36, 72])).toEqual([36, 72])
    expect(heard(samples, [37, 35, 38])).toEqual([])
  })

  it('hears a soft melody over a loud left hand', () => {
    const samples = mix(tone(43, 0.3), tone(50, 0.3), tone(79, 0.05))
    expect(heard(samples, [43, 50, 79])).toEqual([43, 50, 79])
    // (F#5 would be heard: it is the 5th harmonic of D3, as on a real piano.)
    expect(heard(samples, [80, 82])).toEqual([])
  })
})

describe('ChordListener', () => {
  const frame = (time: number, rms: number, onset = 1) => ({ time, rms, frequency: 0, clarity: 0, onset })
  const chord = spectrumOf(mix(tone(48), tone(64), tone(72)), RATE)
  const melodyOnly = spectrumOf(mix(tone(72)), RATE)

  it('completes once every note has been heard after a key is struck', () => {
    const listener = new ChordListener()
    listener.listen([48, 64, 72])
    expect(listener.process(frame(0, 0.001), chord)).toBe(false)
    expect(listener.process(frame(10, 0.1), chord)).toBe(false) // struck, first frame
    expect(listener.process(frame(20, 0.1), chord)).toBe(true)
    expect(listener.process(frame(30, 0.1), chord)).toBe(false) // only once
  })

  it('waits for the other hand', () => {
    const listener = new ChordListener()
    listener.listen([48, 64, 72])
    listener.process(frame(0, 0.001), melodyOnly)
    expect(listener.process(frame(10, 0.1), melodyOnly)).toBe(false)
    expect(listener.process(frame(20, 0.1), melodyOnly)).toBe(false)
    expect(listener.pending).toEqual([48, 64])
    // The left hand comes in a moment later: a new attack.
    listener.process(frame(30, 0.05), melodyOnly)
    expect(listener.process(frame(40, 0.2), chord)).toBe(false)
    expect(listener.process(frame(50, 0.2), chord)).toBe(true)
  })

  it('ignores notes still ringing from before until a key is struck', () => {
    const listener = new ChordListener()
    listener.listen([48, 64, 72])
    // Loud but steady: the previous chord still sounding, nothing new struck.
    for (let t = 0; t < 100; t += 10) expect(listener.process(frame(t, 0.1 - t / 5000), chord)).toBe(false)
    // Now the chord is struck again.
    expect(listener.process(frame(100, 0.2), chord)).toBe(false)
    expect(listener.process(frame(110, 0.2), chord)).toBe(true)
  })

  it('accepts another octave when asked', () => {
    const listener = new ChordListener({ ignoreOctave: true })
    listener.listen([60, 76])
    listener.process(frame(0, 0.001), chord)
    listener.process(frame(10, 0.1), chord)
    expect(listener.process(frame(20, 0.1), chord)).toBe(true)
  })
})

describe('ChordListener in big chords', () => {
  const frame = (time: number, rms: number) => ({ time, rms, frequency: 0, clarity: 0, onset: 1 })

  it('lets one inner note of a chord go unheard, but not the melody', () => {
    const withoutInner = spectrumOf(mix(tone(48), tone(55), tone(77)), RATE)
    const listener = new ChordListener()
    listener.listen([48, 52, 55, 77])
    listener.process(frame(0, 0.001), withoutInner)
    listener.process(frame(10, 0.1), withoutInner)
    expect(listener.process(frame(20, 0.1), withoutInner)).toBe(true)

    const withoutMelody = spectrumOf(mix(tone(48), tone(52), tone(55)), RATE)
    const strict = new ChordListener()
    strict.listen([48, 52, 55, 77])
    strict.process(frame(0, 0.001), withoutMelody)
    strict.process(frame(10, 0.1), withoutMelody)
    expect(strict.process(frame(20, 0.1), withoutMelody)).toBe(false)
  })

  it('ignores the attack of the notes just played', () => {
    const chord = spectrumOf(mix(tone(48), tone(77)), RATE)
    const listener = new ChordListener()
    listener.listen([48, 76], 1000)
    listener.process(frame(1010, 0.05), chord)
    expect(listener.process(frame(1020, 0.1), chord)).toBe(false) // still rising: same attack
    expect(listener.process(frame(1030, 0.1), chord)).toBe(false)
    listener.process(frame(1200, 0.02), chord)
    listener.process(frame(1300, 0.1), chord)
    expect(listener.process(frame(1310, 0.1), chord)).toBe(true)
  })
})
