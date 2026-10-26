import { describe, expect, it } from 'vitest'
import { buildTimeline, measureCount, playableNotes, stepsInRange, wholeNotesToSeconds, type Timeline } from './timeline'

const note = (midi: number, staff = 0, tiedContinuation = false) => ({
  midi, staff, voice: 0, duration: 0.25, tiedContinuation,
})

const timeline: Timeline = {
  bpm: 120,
  staffCount: 2,
  steps: [
    { index: 0, time: 0, measureIndex: 0, notes: [note(60), note(48, 1)] },
    { index: 1, time: 0.25, measureIndex: 0, notes: [note(62), note(48, 1, true)] },
    { index: 2, time: 1, measureIndex: 1, notes: [note(64)] },
    { index: 3, time: 2, measureIndex: 2, notes: [note(65)] },
  ],
}

describe('wholeNotesToSeconds', () => {
  it('converts a whole note at 60 bpm to 4 seconds', () => {
    expect(wholeNotesToSeconds(1, 60)).toBe(4)
  })
  it('applies the tempo factor', () => {
    expect(wholeNotesToSeconds(1, 120, 0.5)).toBe(4)
  })
})

describe('playableNotes', () => {
  it('skips tied continuations', () => {
    expect(playableNotes(timeline.steps[1]).map(n => n.midi)).toEqual([62])
  })
  it('filters by staff (hands separately)', () => {
    expect(playableNotes(timeline.steps[0], [1]).map(n => n.midi)).toEqual([48])
  })
})

describe('stepsInRange', () => {
  it('selects a measure range', () => {
    expect(stepsInRange(timeline, 1, 2).map(s => s.index)).toEqual([2, 3])
  })
})

describe('measureCount', () => {
  it('counts measures', () => {
    expect(measureCount(timeline)).toBe(3)
  })
})

describe('buildTimeline', () => {
  const measures = [
    { start: 0, duration: 1 },
    { start: 1, duration: 1 },
  ]
  const raw = (measureIndex: number, scoreTime: number) => ({ measureIndex, scoreTime, notes: [] })

  it('keeps written times for a straight score', () => {
    const t = buildTimeline([raw(0, 0), raw(0, 0.5), raw(1, 1), raw(1, 1.5)], measures, 100, 1)
    expect(t.steps.map(s => s.time)).toEqual([0, 0.5, 1, 1.5])
  })

  it('keeps time moving forward across a repeat', () => {
    // Measure 1 is repeated: the cursor jumps from 1.5 back to 1.
    const t = buildTimeline([raw(0, 0), raw(1, 1), raw(1, 1.5), raw(1, 1), raw(1, 1.5)], measures, 100, 1)
    expect(t.steps.map(s => s.time)).toEqual([0, 1, 1.5, 2, 2.5])
  })

  it('handles a short pickup measure', () => {
    const pickup = [
      { start: 0, duration: 0.25 },
      { start: 0.25, duration: 1 },
    ]
    const t = buildTimeline([raw(0, 0), raw(1, 0.25)], pickup, 100, 1)
    expect(t.steps.map(s => s.time)).toEqual([0, 0.25])
  })
})
