import { DEFAULT_A4_HZ, frequencyToMidi } from '../../music/pitch'
import type { NoteInputEvent } from '../types'
import type { AudioFrame } from './analysis'

// Turns a stream of analysed audio frames into note-on / note-off events.
// Monophonic: one note sounds at a time. Rules:
//  - a pitch must be stable for a few frames before it counts (filters attack noise);
//  - a note that keeps ringing (piano sustain) never fires again by itself;
//  - striking the same key again is detected by a jump in volume (a new attack),
//    looked for both in the overall level and in short blocks for fast repeats;
//  - octave jumps of the detector while a note decays are ignored.

export interface TrackerSettings {
  /** Minimum RMS level for a sound to count (from calibration). */
  threshold: number
  /** Tuning reference (from calibration). */
  a4Hz: number
  /** Minimum pitch clarity, 0..1. */
  minClarity: number
  /** Consecutive frames with the same pitch needed to accept a note. */
  stableFrames: number
  /** Volume must grow by this factor over its recent minimum to count as a new attack. */
  onsetRatio: number
  /** Same, measured on short blocks inside a frame (catches fast repeated notes). */
  shortOnsetRatio: number
  /** Minimum time between two attacks, in ms (one attack spans several overlapping frames, ~45 ms). */
  minAttackGapMs: number
  /** Frames below threshold before a note is considered released. */
  releaseFrames: number
  lowestMidi: number
  highestMidi: number
}

export const DEFAULT_TRACKER_SETTINGS: TrackerSettings = {
  threshold: 0.01,
  a4Hz: DEFAULT_A4_HZ,
  minClarity: 0.85,
  stableFrames: 3,
  onsetRatio: 1.6,
  shortOnsetRatio: 1.8,
  minAttackGapMs: 100,
  releaseFrames: 4,
  lowestMidi: 21,
  highestMidi: 108,
}

export class NoteTracker {
  settings: TrackerSettings
  private current: number | null = null
  private candidate: number | null = null
  private candidateCount = 0
  private quietFrames = 0
  /** Lowest level seen since the last attack; a new attack must rise well above it. */
  private valley = Infinity
  /** Set by a fresh attack: the next stable pitch fires even if it equals the current note. */
  private attackPending = true
  private attackStrength = 0
  private lastAttackTime = -Infinity

  constructor(settings: Partial<TrackerSettings> = {}) {
    this.settings = { ...DEFAULT_TRACKER_SETTINGS, ...settings }
  }

  reset(): NoteInputEvent[] {
    const events = this.current !== null ? [this.noteOff(this.current, 0)] : []
    this.current = null
    this.candidate = null
    this.candidateCount = 0
    this.valley = Infinity
    this.attackPending = true
    return events
  }

  process(frame: AudioFrame): NoteInputEvent[] {
    const s = this.settings
    const events: NoteInputEvent[] = []

    if (frame.rms < s.threshold) {
      this.quietFrames++
      this.valley = Math.min(this.valley, frame.rms)
      this.candidate = null
      this.candidateCount = 0
      if (this.current !== null && this.quietFrames >= s.releaseFrames) {
        events.push(this.noteOff(this.current, frame.time))
        this.current = null
      }
      if (this.quietFrames >= s.releaseFrames) this.attackPending = true
      return events
    }
    this.quietFrames = 0

    // A clear rise in volume means a key was struck (again).
    const levelRise = frame.rms > Math.max(this.valley, s.threshold * 0.5) * s.onsetRatio
    const shortRise = (frame.onset ?? 1) >= s.shortOnsetRatio
    // One attack keeps raising the level of the next few overlapping frames: count it once.
    const sinceLastAttack = frame.time - this.lastAttackTime
    if ((levelRise || shortRise) && sinceLastAttack < s.minAttackGapMs) {
      // Still the same attack: follow the rising level.
      this.valley = frame.rms
    } else if (levelRise || shortRise) {
      this.lastAttackTime = frame.time
      this.attackPending = true
      this.attackStrength = frame.rms
      this.candidate = null
      this.candidateCount = 0
      this.valley = frame.rms
    } else {
      this.valley = Math.min(this.valley, frame.rms)
    }

    const midi = this.pitchOf(frame)
    if (midi === null) return events

    // While a note rings, octave errors of the detector are the same note.
    if (this.current !== null && !this.attackPending && Math.abs(midi - this.current) === 12) return events

    if (midi === this.candidate) this.candidateCount++
    else {
      this.candidate = midi
      this.candidateCount = 1
    }
    if (this.candidateCount < s.stableFrames) return events

    if (midi !== this.current || this.attackPending) {
      if (this.current !== null) events.push(this.noteOff(this.current, frame.time))
      this.current = midi
      this.attackPending = false
      const strength = Math.min(1, Math.max(this.attackStrength, frame.rms) / (s.threshold * 10))
      events.push({ type: 'noteon', midi, time: frame.time, strength, source: 'microphone' })
    }
    return events
  }

  private pitchOf(frame: AudioFrame): number | null {
    const s = this.settings
    if (frame.frequency <= 0 || frame.clarity < s.minClarity) return null
    const midi = Math.round(frequencyToMidi(frame.frequency, s.a4Hz))
    if (midi < s.lowestMidi || midi > s.highestMidi) return null
    return midi
  }

  private noteOff(midi: number, time: number): NoteInputEvent {
    return { type: 'noteoff', midi, time, strength: 0, source: 'microphone' }
  }
}
