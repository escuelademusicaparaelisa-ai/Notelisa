import { describe, expect, it } from 'vitest'
import { midiToFrequency } from '../music/pitch'
import { clampBpm, TapTempo, tempoName } from './metronomeTempo'
import { readPitch, TunerFollower, verdict } from './tuner'

const frame = (frequency: number, rms = 0.1, clarity = 0.97) => ({ time: 0, rms, frequency, clarity })

describe('tuner', () => {
  it('names the nearest note and the cents off', () => {
    expect(readPitch(440)).toMatchObject({ name: 'La', octave: 4, cents: 0 })
    const sharp = readPitch(440 * Math.pow(2, 12 / 1200))
    expect(sharp).toMatchObject({ name: 'La', cents: 12 })
    expect(verdict(sharp.cents)).toBe('sharp')
    expect(readPitch(midiToFrequency(66) * Math.pow(2, -30 / 1200))).toMatchObject({ name: 'Fa♯', cents: -30 })
  })

  it('reads against the chosen A', () => {
    // 442 Hz is in tune when the flute plays at A = 442.
    expect(readPitch(442, 442).cents).toBe(0)
    expect(readPitch(442, 440).cents).toBe(8)
  })

  it('ignores quiet or unclear sound and smooths a slip of octave', () => {
    const follower = new TunerFollower(0.01)
    expect(follower.process(frame(440, 0.001), 440)).toBeNull()
    expect(follower.process(frame(440, 0.1, 0.5), 440)).toBeNull()
    follower.process(frame(440), 440)
    follower.process(frame(441), 440)
    follower.process(frame(440), 440)
    follower.process(frame(439), 440)
    // One frame an octave up starts afresh only if the note really changed.
    const reading = follower.process(frame(880), 440)
    expect(reading).toBeNull()
  })

  it('follows a steady note', () => {
    const follower = new TunerFollower(0.01)
    let reading = null
    for (const f of [523, 523.5, 524, 523, 522.5]) reading = follower.process(frame(f), 440)
    expect(reading).toMatchObject({ name: 'Do', octave: 5 })
    expect(Math.abs(reading!.cents)).toBeLessThan(5)
  })
})

describe('metronome tempo', () => {
  it('keeps the speed in range and names it', () => {
    expect(clampBpm(10)).toBe(30)
    expect(clampBpm(400)).toBe(240)
    expect(tempoName(60)).toBe('Lento')
    expect(tempoName(100)).toBe('Andante')
    expect(tempoName(130)).toBe('Allegro')
  })

  it('measures the speed of taps', () => {
    const taps = new TapTempo()
    expect(taps.tap(0)).toBeNull()
    expect(taps.tap(500)).toBe(120)
    expect(taps.tap(1000)).toBe(120)
    // A long pause starts counting again.
    expect(taps.tap(5000)).toBeNull()
    expect(taps.tap(6000)).toBe(60)
  })
})
