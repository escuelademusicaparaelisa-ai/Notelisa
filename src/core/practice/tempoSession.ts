import { playableNotes, wholeNotesToSeconds, type ScoreStep, type Timeline } from '../score/timeline'
import { DEFAULT_MATCH_OPTIONS, pitchMatches, type MatchOptions } from './matching'
import { newMeasureStats, type MeasureStats } from './waitSession'

// Tempo mode: the score moves on by itself at a steady tempo and every note is
// judged on pitch and on timing. Times are in seconds from the first step.

export interface TimingWindows {
  /** Up to this far from the beat (seconds) a note counts as on time. */
  perfect: number
  /** Up to this far it still counts as the right note, but early or late. */
  ok: number
}

export const DEFAULT_WINDOWS: TimingWindows = { perfect: 0.15, ok: 0.3 }

export interface TempoSessionOptions extends MatchOptions {
  staves?: readonly number[]
  /** First and last measure to practise, 0-based and inclusive. */
  fromMeasure?: number
  toMeasure?: number
  /** Only the highest note of each chord (microphone). */
  onlyHighest?: boolean
  /** 1 = the tempo written in the score. */
  tempoFactor: number
  windows: TimingWindows
}

export type Timing = 'onTime' | 'early' | 'late'

export type TempoEvent =
  | { type: 'step'; step: number }
  | { type: 'hit'; step: number; midi: number; timing: Timing }
  | { type: 'wrong'; midi: number }
  | { type: 'missed'; step: number; midi: number }
  | { type: 'finished' }

interface Target {
  step: number
  measure: number
  midi: number
  time: number
  state: 'waiting' | 'hit' | 'missed'
}

export class TempoSession {
  readonly steps: ScoreStep[]
  /** Seconds of every step, from the first one. */
  readonly stepTimes: number[]
  /** Seconds from the first step to the end of the last note. */
  readonly length: number
  readonly stats = new Map<number, MeasureStats>()
  private readonly options: TempoSessionOptions
  private readonly targets: Target[] = []
  private nextStep = 0
  private done = false

  constructor(timeline: Timeline, options: Partial<TempoSessionOptions> = {}) {
    this.options = { ...DEFAULT_MATCH_OPTIONS, tempoFactor: 1, windows: DEFAULT_WINDOWS, ...options }
    const { fromMeasure = 0, toMeasure = Infinity, staves, tempoFactor, onlyHighest } = this.options
    this.steps = timeline.steps.filter(s =>
      s.measureIndex >= fromMeasure && s.measureIndex <= toMeasure && playableNotes(s, staves).length > 0)
    const origin = this.steps[0]?.time ?? 0
    const seconds = (wholeNotes: number) => wholeNotesToSeconds(wholeNotes, timeline.bpm, tempoFactor)
    this.stepTimes = this.steps.map(s => seconds(s.time - origin))
    this.steps.forEach((step, i) => {
      const notes = playableNotes(step, staves).map(n => n.midi)
      for (const midi of onlyHighest ? [Math.max(...notes)] : [...new Set(notes)]) {
        this.targets.push({ step: step.index, measure: step.measureIndex, midi, time: this.stepTimes[i], state: 'waiting' })
      }
    })
    const last = this.steps[this.steps.length - 1]
    this.length = last ? seconds(last.time - origin + Math.max(0, ...last.notes.map(n => n.duration))) : 0
    if (this.steps.length === 0) this.done = true
  }

  get finished(): boolean {
    return this.done
  }

  /** Index (in the full timeline) of the first step. */
  get firstStep(): number | null {
    return this.steps[0]?.index ?? null
  }

  /**
   * Moves time forward: reports steps the cursor reaches, notes whose time
   * window has passed without being played, and the end of the piece.
   */
  update(now: number): TempoEvent[] {
    if (this.done) return []
    const events: TempoEvent[] = []
    while (this.nextStep < this.steps.length && this.stepTimes[this.nextStep] <= now) {
      events.push({ type: 'step', step: this.steps[this.nextStep].index })
      this.nextStep++
    }
    for (const target of this.targets) {
      if (target.state !== 'waiting' || target.time + this.options.windows.ok >= now) continue
      target.state = 'missed'
      this.statsFor(target.measure).missed++
      events.push({ type: 'missed', step: target.step, midi: target.midi })
    }
    const lastTarget = this.targets[this.targets.length - 1]
    if (now >= Math.max(this.length, (lastTarget?.time ?? 0) + this.options.windows.ok)) {
      this.done = true
      events.push({ type: 'finished' })
    }
    return events
  }

  /** Judges a note played at a given time (seconds from the first step). */
  play(midi: number, at: number): TempoEvent[] {
    if (this.done) return []
    const { ok, perfect } = this.options.windows
    let best: Target | null = null
    for (const target of this.targets) {
      if (target.state !== 'waiting' || Math.abs(target.time - at) > ok || !pitchMatches(midi, target.midi, this.options)) continue
      if (!best || Math.abs(target.time - at) < Math.abs(best.time - at)) best = target
    }
    if (!best) {
      this.statsFor(this.nearestMeasure(at)).wrong++
      return [{ type: 'wrong', midi }]
    }
    best.state = 'hit'
    const offset = at - best.time
    const timing: Timing = Math.abs(offset) <= perfect ? 'onTime' : offset < 0 ? 'early' : 'late'
    const stats = this.statsFor(best.measure)
    stats.correct++
    if (timing !== 'onTime') stats.offTime++
    return [{ type: 'hit', step: best.step, midi: best.midi, timing }]
  }

  private nearestMeasure(at: number): number {
    let best = this.targets[0]
    for (const target of this.targets) {
      if (Math.abs(target.time - at) < Math.abs(best.time - at)) best = target
    }
    return best?.measure ?? 0
  }

  private statsFor(measure: number): MeasureStats {
    let stats = this.stats.get(measure)
    if (!stats) {
      stats = newMeasureStats()
      this.stats.set(measure, stats)
    }
    return stats
  }
}
