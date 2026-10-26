// Pitch helpers shared by every instrument and input source.
// All pitches inside the app are MIDI note numbers (C4 = 60, A4 = 69).

const SOLFEGE = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si']
const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const DEFAULT_A4_HZ = 440

/** Octave number in scientific notation (C4 = middle C). */
export function midiOctave(midi: number): number {
  return Math.floor(midi / 12) - 1
}

/** Spanish solfège name, e.g. 60 -> "Do4". */
export function midiToSolfege(midi: number, withOctave = true): string {
  const name = SOLFEGE[((midi % 12) + 12) % 12]
  return withOctave ? `${name}${midiOctave(midi)}` : name
}

/** Scientific pitch name, e.g. 60 -> "C4" (used by Tone.js). */
export function midiToNoteName(midi: number): string {
  return `${LETTERS[((midi % 12) + 12) % 12]}${midiOctave(midi)}`
}

export function midiToFrequency(midi: number, a4Hz = DEFAULT_A4_HZ): number {
  return a4Hz * Math.pow(2, (midi - 69) / 12)
}

/** Fractional MIDI number for a frequency (69.5 = a quarter tone above A4). */
export function frequencyToMidi(frequency: number, a4Hz = DEFAULT_A4_HZ): number {
  return 69 + 12 * Math.log2(frequency / a4Hz)
}
