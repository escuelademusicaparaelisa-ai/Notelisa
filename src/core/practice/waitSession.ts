import { playableNotes, type ScoreStep, type Timeline } from '../score/timeline'
import { DEFAULT_MATCH_OPTIONS, StepMatcher, type MatchOptions } from './matching'

// Wait mode: the cursor stays on a step until the student plays all of its notes.

export interface WaitSessionOptions extends MatchOptions {
  /** Staves to practise (hands separately); all when omitted. */
  staves?: readonly number[]
  /** First and last measure to practise, 0-based and inclusive. */
  fromMeasure?: number
  toMeasure?: number
  /** Start again at the first step of the range after the last one. */
  loop: boolean
}

export type WaitEvent =
  | { type: 'correct'; step: number; midi: number }
  | { type: 'wrong'; step: number; midi: number }
  | { type: 'stepDone'; step: number; clean: boolean; notes: number[] }
  | { type: 'advance'; step: number }
  | { type: 'loop'; step: number }
  | { type: 'finished' }

export interface MeasureStats {
  correct: number
  wrong: number
}

export class WaitSession {
  private readonly steps: ScoreStep[]
  private readonly options: WaitSessionOptions
  private position = 0
  private matcher: StepMatcher | null = null
  private mistakesOnStep = 0
  private done = false
  readonly stats = new Map<number, MeasureStats>()

  constructor(timeline: Timeline, options: Partial<WaitSessionOptions> = {}) {
    this.options = { ...DEFAULT_MATCH_OPTIONS, loop: false, ...options }
    const { fromMeasure = 0, toMeasure = Infinity, staves } = this.options
    this.steps = timeline.steps.filter(s =>
      s.measureIndex >= fromMeasure && s.measureIndex <= toMeasure && playableNotes(s, staves).length > 0)
    this.enterStep(0)
  }

  /** Index (in the full timeline) of the step the student must play now, or null when finished. */
  get currentStep(): number | null {
    return this.done ? null : this.steps[this.position]?.index ?? null
  }

  get expectedNotes(): number[] {
    return this.matcher ? [...this.matcher.expected] : []
  }

  /** Notes of the current step still to be played (for hints). */
  get pendingNotes(): number[] {
    return this.matcher ? this.matcher.pendingNotes : []
  }

  get finished(): boolean {
    return this.done
  }

  /** Feeds a note-on from any input source and returns what happened. */
  play(midi: number): WaitEvent[] {
    if (this.done || !this.matcher) return []
    const step = this.steps[this.position]
    const result = this.matcher.play(midi)
    const stats = this.statsFor(step.measureIndex)
    if (result.kind === 'repeat') return []
    if (result.kind === 'wrong') {
      stats.wrong++
      this.mistakesOnStep++
      return [{ type: 'wrong', step: step.index, midi }]
    }
    stats.correct++
    const events: WaitEvent[] = [{ type: 'correct', step: step.index, midi: result.expected }]
    if (this.matcher.complete) {
      events.push({ type: 'stepDone', step: step.index, clean: this.mistakesOnStep === 0, notes: [...this.matcher.expected] })
      events.push(...this.advance())
    }
    return events
  }

  private advance(): WaitEvent[] {
    if (this.position + 1 < this.steps.length) {
      this.enterStep(this.position + 1)
      return [{ type: 'advance', step: this.steps[this.position].index }]
    }
    if (this.options.loop) {
      this.enterStep(0)
      return [{ type: 'loop', step: this.steps[0].index }]
    }
    this.done = true
    this.matcher = null
    return [{ type: 'finished' }]
  }

  private enterStep(position: number): void {
    this.position = position
    this.mistakesOnStep = 0
    const step = this.steps[position]
    if (!step) {
      this.done = true
      this.matcher = null
      return
    }
    this.matcher = new StepMatcher(playableNotes(step, this.options.staves).map(n => n.midi), this.options)
  }

  private statsFor(measure: number): MeasureStats {
    let stats = this.stats.get(measure)
    if (!stats) {
      stats = { correct: 0, wrong: 0 }
      this.stats.set(measure, stats)
    }
    return stats
  }
}
