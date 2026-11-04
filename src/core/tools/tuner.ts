import { DEFAULT_A4_HZ, frequencyToMidi, midiToSolfege } from '../music/pitch'
import type { AudioFrame } from '../input/mic/analysis'

// The tuner: turns microphone frames into "which note, and how many cents off".

/** Lowest and highest pitches the tuner reports (a low piano C to the top of the piccolo). */
const MIN_HZ = 60
const MAX_HZ = 4500
/** Frames to smooth over: steadier needle without feeling slow (about 60 ms). */
const SMOOTHING = 5
/** How close counts as in tune, in cents. */
export const IN_TUNE_CENTS = 5
export const MIN_A4_HZ = 430
export const MAX_A4_HZ = 450

export interface TunerReading {
  /** Nearest equal-tempered note (MIDI number). */
  midi: number
  /** Spanish name without octave ("Fa♯"). */
  name: string
  octave: number
  /** -50..+50: below or above the nearest note. */
  cents: number
  frequency: number
}

/** The nearest note to a frequency and how far from it it is. */
export function readPitch(frequency: number, a4Hz = DEFAULT_A4_HZ): TunerReading {
  const exact = frequencyToMidi(frequency, a4Hz)
  const midi = Math.round(exact)
  return {
    midi,
    name: midiToSolfege(midi, false),
    octave: Math.floor(midi / 12) - 1,
    cents: Math.round((exact - midi) * 100),
    frequency,
  }
}

export type TuneVerdict = 'in-tune' | 'flat' | 'sharp'

export function verdict(cents: number): TuneVerdict {
  if (Math.abs(cents) <= IN_TUNE_CENTS) return 'in-tune'
  return cents < 0 ? 'flat' : 'sharp'
}

export function clampA4(hz: number): number {
  return Math.min(MAX_A4_HZ, Math.max(MIN_A4_HZ, Math.round(hz)))
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * Follows the sound frame by frame. Only clear, loud enough pitches count; the
 * median of the last few smooths the needle and drops single octave slips (the
 * flute's breathy attack often reads an octave off for a frame).
 */
export class TunerFollower {
  private recent: number[] = []
  private silentFrames = 0

  threshold: number
  minClarity: number

  constructor(threshold = 0.01, minClarity = 0.9) {
    this.threshold = threshold
    this.minClarity = minClarity
  }

  /** The current reading, or null while nothing clear is sounding. */
  process(frame: AudioFrame, a4Hz: number): TunerReading | null {
    const clear = frame.rms >= this.threshold && frame.clarity >= this.minClarity
      && frame.frequency >= MIN_HZ && frame.frequency <= MAX_HZ
    if (!clear) {
      // A short gap (a breath, a tongued note) keeps the last few values; a longer one starts afresh.
      if (++this.silentFrames > 8) this.recent = []
      return null
    }
    this.silentFrames = 0
    // A jump of more than a semitone from what we were following is a new note.
    const last = this.recent[this.recent.length - 1]
    if (last && Math.abs(1200 * Math.log2(frame.frequency / last)) > 100) this.recent = []
    this.recent.push(frame.frequency)
    if (this.recent.length > SMOOTHING) this.recent.shift()
    if (this.recent.length < 2) return null
    return readPitch(median(this.recent), a4Hz)
  }

  reset(): void {
    this.recent = []
    this.silentFrames = 0
  }
}
