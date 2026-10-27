import { describe, expect, it } from 'vitest'
import { beatsForSteps, beatsInMeasure } from './beats'
import type { ScoreStep, Timeline } from './timeline'

const step = (index: number, time: number, measureIndex: number, measureOffset: number, duration = 0.25): ScoreStep => ({
  index, time, measureIndex, measureOffset,
  notes: [{ midi: 60, staff: 0, voice: 0, duration, tiedContinuation: false }],
})

describe('beatsForSteps', () => {
  it('clicks every quarter and accents the first beat of each measure', () => {
    // 3/4: a dotted half note, then three quarters.
    const steps = [step(0, 0, 0, 0, 0.75), step(1, 0.75, 1, 0), step(2, 1, 1, 0.25), step(3, 1.25, 1, 0.5)]
    const timeline: Timeline = { steps, bpm: 100, staffCount: 1, measureDurations: [0.75, 0.75] }
    expect(beatsForSteps(timeline, steps)).toEqual([
      { time: 0, accent: true }, { time: 0.25, accent: false }, { time: 0.5, accent: false },
      { time: 0.75, accent: true }, { time: 1, accent: false }, { time: 1.25, accent: false },
    ])
    expect(beatsInMeasure(timeline, 0)).toBe(3)
  })

  it('counts a repeated measure twice', () => {
    const steps = [step(0, 0, 0, 0, 0.5), step(1, 0.5, 0, 0, 0.5)]
    const timeline: Timeline = { steps, bpm: 100, staffCount: 1, measureDurations: [0.5] }
    expect(beatsForSteps(timeline, steps).map(b => b.accent)).toEqual([true, false, true, false])
  })

  it('starts a range in the middle of a measure on the right beat', () => {
    const steps = [step(0, 0, 0, 0, 0.5), step(1, 0.5, 0, 0.5, 0.5)]
    const timeline: Timeline = { steps, bpm: 100, staffCount: 1, measureDurations: [1] }
    expect(beatsForSteps(timeline, steps.slice(1))).toEqual([{ time: 0, accent: false }, { time: 0.25, accent: false }])
  })
})
