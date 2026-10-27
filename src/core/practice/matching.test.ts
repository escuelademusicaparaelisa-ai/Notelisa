import { describe, expect, it } from 'vitest'
import { pitchMatches, StepMatcher } from './matching'

describe('pitchMatches', () => {
  it('requires the exact note by default', () => {
    expect(pitchMatches(60, 60)).toBe(true)
    expect(pitchMatches(72, 60)).toBe(false)
    expect(pitchMatches(61, 60)).toBe(false)
  })
  it('accepts any octave when asked', () => {
    const options = { ignoreOctave: true }
    expect(pitchMatches(72, 60, options)).toBe(true)
    expect(pitchMatches(36, 60, options)).toBe(true)
    expect(pitchMatches(61, 60, options)).toBe(false)
  })
})

describe('StepMatcher', () => {
  it('completes a single note', () => {
    const m = new StepMatcher([64])
    expect(m.play(64)).toEqual({ kind: 'correct', expected: 64 })
    expect(m.complete).toBe(true)
  })

  it('reports a wrong note and keeps waiting', () => {
    const m = new StepMatcher([64])
    expect(m.play(65)).toEqual({ kind: 'wrong' })
    expect(m.complete).toBe(false)
  })

  it('accepts chord notes in any order', () => {
    const m = new StepMatcher([60, 64, 67])
    m.play(67)
    m.play(60)
    expect(m.complete).toBe(false)
    expect(m.pendingNotes).toEqual([64])
    m.play(64)
    expect(m.complete).toBe(true)
  })

  it('does not count a repeated chord note as wrong', () => {
    const m = new StepMatcher([60, 64])
    m.play(60)
    expect(m.play(60)).toEqual({ kind: 'repeat', expected: 60 })
    expect(m.complete).toBe(false)
  })

  it('handles the same pitch written twice (two voices)', () => {
    const m = new StepMatcher([60, 60])
    m.play(60)
    expect(m.complete).toBe(true)
  })

  it('matches each chord note once when ignoring octaves', () => {
    const m = new StepMatcher([48, 60], { ignoreOctave: true })
    expect(m.play(72)).toEqual({ kind: 'correct', expected: 48 })
    expect(m.complete).toBe(false)
  })
})
