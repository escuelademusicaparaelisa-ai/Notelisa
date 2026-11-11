import { describe, expect, it } from 'vitest'
import { keyboardRange } from './keyboardRange'

describe('keyboardRange', () => {
  it('keeps Do3–Do6 when the piece fits', () => {
    expect(keyboardRange([60, 64, 67])).toEqual({ low: 48, high: 84 })
    expect(keyboardRange([])).toEqual({ low: 48, high: 84 })
  })

  it('adds an octave below for low notes', () => {
    expect(keyboardRange([43, 60])).toEqual({ low: 36, high: 84 })
  })

  it('adds an octave above for high notes', () => {
    expect(keyboardRange([60, 86])).toEqual({ low: 48, high: 96 })
    expect(keyboardRange([96])).toEqual({ low: 48, high: 96 })
  })

  it('stays within the 88 keys of a piano', () => {
    expect(keyboardRange([21, 108])).toEqual({ low: 21, high: 108 })
  })
})
