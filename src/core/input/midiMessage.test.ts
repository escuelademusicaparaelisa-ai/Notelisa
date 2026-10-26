import { describe, expect, it } from 'vitest'
import { parseMidiMessage } from './midiMessage'

describe('parseMidiMessage', () => {
  it('reads a note on (any channel)', () => {
    expect(parseMidiMessage([0x93, 60, 127], 10)).toEqual({ type: 'noteon', midi: 60, time: 10, strength: 1, source: 'midi' })
  })
  it('treats note on with velocity 0 as note off', () => {
    expect(parseMidiMessage([0x90, 60, 0], 0)?.type).toBe('noteoff')
  })
  it('reads a note off', () => {
    expect(parseMidiMessage([0x80, 62, 40], 0)?.type).toBe('noteoff')
  })
  it('ignores other messages (pads, knobs, pedal)', () => {
    expect(parseMidiMessage([0xb0, 64, 127], 0)).toBeNull()
    expect(parseMidiMessage([0xf8], 0)).toBeNull()
  })
})
