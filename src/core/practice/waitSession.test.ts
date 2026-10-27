import { describe, expect, it } from 'vitest'
import type { ScoreNote, Timeline } from '../score/timeline'
import { WaitSession } from './waitSession'

const n = (midi: number, staff = 0, tiedContinuation = false): ScoreNote =>
  ({ midi, staff, voice: 0, duration: 0.25, tiedContinuation })

// Measure 0: C+low C, D, rest   Measure 1: E (tied bass), F
const timeline: Timeline = {
  bpm: 100,
  staffCount: 2,
  steps: [
    { index: 0, time: 0, measureIndex: 0, notes: [n(60), n(48, 1)] },
    { index: 1, time: 0.25, measureIndex: 0, notes: [n(62)] },
    { index: 2, time: 0.5, measureIndex: 0, notes: [] },
    { index: 3, time: 1, measureIndex: 1, notes: [n(64), n(48, 1, true)] },
    { index: 4, time: 1.25, measureIndex: 1, notes: [n(65)] },
  ],
}

const types = (events: { type: string }[]) => events.map(e => e.type)

describe('WaitSession', () => {
  it('waits for every note of a chord before advancing', () => {
    const s = new WaitSession(timeline)
    expect(s.currentStep).toBe(0)
    expect(types(s.play(60))).toEqual(['correct'])
    expect(s.currentStep).toBe(0)
    expect(types(s.play(48))).toEqual(['correct', 'stepDone', 'advance'])
    expect(s.currentStep).toBe(1)
  })

  it('stays on the step after a wrong note', () => {
    const s = new WaitSession(timeline)
    s.play(60); s.play(48)
    expect(types(s.play(63))).toEqual(['wrong'])
    expect(s.currentStep).toBe(1)
    const events = s.play(62)
    expect(events).toContainEqual({ type: 'stepDone', step: 1, clean: false, notes: [62] })
  })

  it('skips rests and tied continuations', () => {
    const s = new WaitSession(timeline)
    s.play(60); s.play(48); s.play(62)
    expect(s.currentStep).toBe(3)
    expect(s.expectedNotes).toEqual([64])
  })

  it('practises one hand only', () => {
    const s = new WaitSession(timeline, { staves: [1] })
    expect(s.expectedNotes).toEqual([48])
    expect(types(s.play(48))).toEqual(['correct', 'stepDone', 'finished'])
    expect(s.finished).toBe(true)
  })

  it('loops over a measure range', () => {
    const s = new WaitSession(timeline, { fromMeasure: 1, toMeasure: 1, loop: true })
    expect(s.currentStep).toBe(3)
    s.play(64)
    expect(s.play(65)).toContainEqual({ type: 'loop', step: 3 })
    expect(s.currentStep).toBe(3)
  })

  it('keeps statistics per measure', () => {
    const s = new WaitSession(timeline)
    s.play(61); s.play(60); s.play(48)
    expect(s.stats.get(0)).toMatchObject({ correct: 2, wrong: 1 })
  })

  it('accepts other octaves when asked', () => {
    const s = new WaitSession(timeline, { ignoreOctave: true, staves: [0] })
    expect(types(s.play(72))).toEqual(['correct', 'stepDone', 'advance'])
  })

  it('asks only for the top note of a chord when listening by microphone', () => {
    const s = new WaitSession(timeline, { onlyHighest: true })
    expect(s.expectedNotes).toEqual([60])
    expect(types(s.play(60))).toEqual(['correct', 'stepDone', 'advance'])
  })
})
