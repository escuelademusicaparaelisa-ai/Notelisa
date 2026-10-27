import { describe, expect, it } from 'vitest'
import type { ScoreNote, Timeline } from '../score/timeline'
import { TempoSession } from './tempoSession'

const note = (midi: number, staff = 0, duration = 0.25): ScoreNote => ({ midi, staff, voice: 0, duration, tiedContinuation: false })

// 60 quarter notes per minute: one step per second.
const timeline: Timeline = {
  bpm: 60,
  staffCount: 2,
  steps: [
    { index: 0, time: 0, measureIndex: 0, notes: [note(60), note(48, 1)] },
    { index: 1, time: 0.25, measureIndex: 0, notes: [note(62)] },
    { index: 2, time: 0.5, measureIndex: 1, notes: [note(64)] },
  ],
}

describe('TempoSession', () => {
  it('places steps in seconds following the tempo', () => {
    expect(new TempoSession(timeline).stepTimes).toEqual([0, 1, 2])
    expect(new TempoSession(timeline, { tempoFactor: 0.5 }).stepTimes).toEqual([0, 2, 4])
  })

  it('judges timing: on time, early and late', () => {
    const s = new TempoSession(timeline, { staves: [0] })
    expect(s.play(60, 0.05)).toEqual([{ type: 'hit', step: 0, midi: 60, timing: 'onTime' }])
    expect(s.play(62, 0.75)).toEqual([{ type: 'hit', step: 1, midi: 62, timing: 'early' }])
    expect(s.play(64, 2.25)).toEqual([{ type: 'hit', step: 2, midi: 64, timing: 'late' }])
    expect(s.stats.get(0)).toEqual({ correct: 2, wrong: 0, missed: 0, offTime: 1 })
  })

  it('counts a right note far from its beat as wrong', () => {
    const s = new TempoSession(timeline, { staves: [0] })
    expect(s.play(62, 0.3)).toEqual([{ type: 'wrong', midi: 62 }])
    expect(s.stats.get(0)?.wrong).toBe(1)
  })

  it('reports missed notes once their window has passed', () => {
    const s = new TempoSession(timeline)
    expect(s.update(0)).toEqual([{ type: 'step', step: 0 }])
    s.play(60, 0)
    const events = s.update(0.5)
    expect(events).toEqual([{ type: 'missed', step: 0, midi: 48 }])
    expect(s.update(0.6)).toEqual([])
  })

  it('needs every chord note, in any order', () => {
    const s = new TempoSession(timeline)
    expect(s.play(48, 0)[0]).toMatchObject({ type: 'hit', midi: 48 })
    expect(s.play(60, 0.02)[0]).toMatchObject({ type: 'hit', midi: 60 })
    expect(s.play(60, 0.05)).toEqual([{ type: 'wrong', midi: 60 }])
  })

  it('accepts any octave when asked', () => {
    const s = new TempoSession(timeline, { staves: [0], ignoreOctave: true })
    expect(s.play(72, 0)[0]).toMatchObject({ type: 'hit', midi: 60 })
  })

  it('only asks for the top note of chords with the microphone', () => {
    const s = new TempoSession(timeline, { onlyHighest: true })
    s.play(60, 0)
    expect(s.update(0.5).filter(e => e.type === 'missed')).toEqual([])
  })

  it('practises only the chosen measures and finishes after the last note', () => {
    const s = new TempoSession(timeline, { fromMeasure: 1, toMeasure: 1 })
    expect(s.firstStep).toBe(2)
    expect(s.stepTimes).toEqual([0])
    expect(s.update(0.5).map(e => e.type)).toEqual(['step', 'missed'])
    expect(s.update(1)).toEqual([{ type: 'finished' }])
    expect(s.finished).toBe(true)
  })
})
