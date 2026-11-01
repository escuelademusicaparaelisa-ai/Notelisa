import * as Tone from 'tone'
import { midiToNoteName } from '../music/pitch'
import type { BackingNote } from '../exercises/accompaniment'
import { playableNotes, wholeNotesToSeconds, type ScoreStep, type Timeline } from '../score/timeline'

// Samples shipped in public/samples/piano (one every minor third; Tone.js fills the gaps).
const PIANO_SAMPLES: Record<string, string> = {}
for (let octave = 1; octave <= 7; octave++) {
  for (const [tone, file] of [['C', 'C'], ['D#', 'Ds'], ['F#', 'Fs'], ['A', 'A']]) {
    PIANO_SAMPLES[`${tone}${octave}`] = `${file}${octave}.mp3`
  }
}
PIANO_SAMPLES.C8 = 'C8.mp3'

export interface PlayOptions {
  fromStep?: number
  toStep?: number
  tempoFactor?: number
  /** Staves to play; all when omitted. */
  staves?: readonly number[]
  /** AudioContext time at which the first step sounds; shortly from now when omitted. */
  startAt?: number
  /** Accompaniment heard along with the notes, timed from the start of the score. */
  backing?: readonly BackingNote[]
  onStep?: (index: number) => void
  onEnd?: () => void
}

/** Plays a timeline with a sampled piano and reports which step is sounding. */
export class ScorePlayer {
  private sampler: Tone.Sampler | null = null
  private loading: Promise<void> | null = null
  private scheduled: number[] = []

  /** Loads the samples. Must be triggered from a user gesture on iOS (audio unlock). */
  async load(): Promise<void> {
    await Tone.start()
    if (!this.loading) {
      this.loading = new Promise<void>((resolve, reject) => {
        this.sampler = new Tone.Sampler({
          urls: PIANO_SAMPLES,
          baseUrl: `${import.meta.env.BASE_URL}samples/piano/`,
          release: 1.2,
          onload: () => resolve(),
          onerror: reject,
        }).toDestination()
      })
    }
    return this.loading
  }

  /** Plays a single note, e.g. when the student taps a note to hear it. */
  async playNote(midi: number, seconds = 0.8): Promise<void> {
    await this.load()
    this.sampler?.triggerAttackRelease(midiToNoteName(midi), seconds)
  }

  /** Starts sounding a note played by the student (MIDI controllers make no sound themselves). */
  async noteOn(midi: number, strength = 0.8): Promise<void> {
    await this.load()
    this.sampler?.triggerAttack(midiToNoteName(midi), undefined, Math.max(0.2, strength))
  }

  noteOff(midi: number): void {
    this.sampler?.triggerRelease(midiToNoteName(midi))
  }

  async play(timeline: Timeline, options: PlayOptions = {}): Promise<void> {
    await this.load()
    this.stop()
    const { fromStep = 0, toStep = timeline.steps.length - 1, tempoFactor = 1, staves, startAt, backing, onStep, onEnd } = options
    const steps = timeline.steps.slice(fromStep, toStep + 1)
    if (steps.length === 0) return

    const transport = Tone.getTransport()
    const origin = steps[0].time
    const toSeconds = (wholeNotes: number) => wholeNotesToSeconds(wholeNotes, timeline.bpm, tempoFactor)
    const sampler = this.sampler!

    for (const step of steps) {
      const at = toSeconds(step.time - origin)
      this.scheduled.push(transport.schedule(time => {
        for (const note of playableNotes(step, staves)) {
          sampler.triggerAttackRelease(midiToNoteName(note.midi), toSeconds(note.duration), time)
        }
        Tone.getDraw().schedule(() => onStep?.(step.index), time)
      }, at))
    }

    const end = toSeconds(rangeEnd(steps) - origin)
    if (backing) this.scheduleBacking(backing, origin, rangeEnd(steps), toSeconds)
    this.scheduled.push(transport.schedule(time => {
      Tone.getDraw().schedule(() => {
        this.stop()
        onEnd?.()
      }, time)
    }, end))

    transport.start(startAt ?? '+0.1')
  }

  /**
   * Plays only the accompaniment over some steps, starting at an AudioContext time,
   * while the student plays the notes (tempo mode).
   */
  async accompany(timeline: Timeline, steps: readonly ScoreStep[], backing: readonly BackingNote[], tempoFactor: number, startAt: number): Promise<void> {
    await this.load()
    this.stop()
    if (steps.length === 0) return
    const origin = steps[0].time
    const end = rangeEnd(steps)
    const toSeconds = (wholeNotes: number) => wholeNotesToSeconds(wholeNotes, timeline.bpm, tempoFactor)
    this.scheduleBacking(backing, origin, end, toSeconds)
    this.scheduled.push(Tone.getTransport().schedule(time => {
      Tone.getDraw().schedule(() => this.stop(), time)
    }, toSeconds(end - origin) + 1.5))
    Tone.getTransport().start(startAt)
  }

  /** Schedules the accompaniment notes that start between `origin` and `end` (whole notes). */
  private scheduleBacking(backing: readonly BackingNote[], origin: number, end: number, toSeconds: (wholeNotes: number) => number): void {
    const transport = Tone.getTransport()
    const sampler = this.sampler!
    for (const note of backing) {
      if (note.time < origin - 1e-6 || note.time >= end - 1e-6) continue
      const duration = toSeconds(Math.min(note.duration, end - note.time))
      this.scheduled.push(transport.schedule(time => {
        sampler.triggerAttackRelease(midiToNoteName(note.midi), duration, time, note.velocity)
      }, toSeconds(note.time - origin)))
    }
  }

  stop(): void {
    const transport = Tone.getTransport()
    transport.stop()
    transport.position = 0
    for (const id of this.scheduled) transport.clear(id)
    this.scheduled = []
    this.sampler?.releaseAll()
  }
}

/** Where a range of steps stops sounding, in whole notes. */
function rangeEnd(steps: readonly ScoreStep[]): number {
  const last = steps[steps.length - 1]
  return last.time + Math.max(0, ...last.notes.map(n => n.duration))
}
