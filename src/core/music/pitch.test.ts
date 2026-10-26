import { describe, expect, it } from 'vitest'
import { frequencyToMidi, midiToFrequency, midiToNoteName, midiToSolfege } from './pitch'

describe('pitch helpers', () => {
  it('names notes in solfège', () => {
    expect(midiToSolfege(60)).toBe('Do4')
    expect(midiToSolfege(70, false)).toBe('La♯')
  })
  it('names notes for Tone.js', () => {
    expect(midiToNoteName(69)).toBe('A4')
    expect(midiToNoteName(21)).toBe('A0')
  })
  it('converts between frequency and MIDI', () => {
    expect(midiToFrequency(69)).toBe(440)
    expect(frequencyToMidi(261.6256)).toBeCloseTo(60, 3)
    expect(frequencyToMidi(442, 442)).toBe(69)
  })
})
