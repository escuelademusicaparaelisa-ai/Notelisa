import type { NoteInputEvent } from './types'

/** Converts a raw MIDI message into a note event; other messages return null. */
export function parseMidiMessage(data: ArrayLike<number>, time: number): NoteInputEvent | null {
  if (data.length < 3) return null
  const command = data[0] & 0xf0
  const midi = data[1]
  const velocity = data[2]
  if (command === 0x90 && velocity > 0) {
    return { type: 'noteon', midi, time, strength: velocity / 127, source: 'midi' }
  }
  // Many keyboards send "note on, velocity 0" instead of "note off".
  if (command === 0x80 || (command === 0x90 && velocity === 0)) {
    return { type: 'noteoff', midi, time, strength: 0, source: 'midi' }
  }
  return null
}
