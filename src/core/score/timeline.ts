// Instrument-agnostic representation of a score as a sequence of "steps".
// A step is a moment in the score where at least one note starts; it is what the
// cursor points at and what practice modes compare the student's input against.

export interface ScoreNote {
  midi: number
  /** Staff index within the score (0 = top). For piano: 0 = right hand, 1 = left hand. */
  staff: number
  voice: number
  /** Duration in whole notes (1 = whole, 0.25 = quarter). */
  duration: number
  /** True when the note continues a tie: it keeps sounding and must not be played again. */
  tiedContinuation: boolean
}

export interface ScoreStep {
  index: number
  /** Position from the start of the score, in whole notes. */
  time: number
  measureIndex: number
  /** Distance from the start of its measure, in whole notes (0 when unknown). */
  measureOffset?: number
  notes: ScoreNote[]
}

export interface Timeline {
  steps: ScoreStep[]
  /** Length of each measure in whole notes, by measure index (used for metronome beats). */
  measureDurations?: number[]
  /** Tempo written in the score, in quarter notes per minute. */
  bpm: number
  staffCount: number
}

/** Converts a position in whole notes into seconds at a given tempo. */
export function wholeNotesToSeconds(wholeNotes: number, bpm: number, tempoFactor = 1): number {
  const quarterSeconds = 60 / (bpm * tempoFactor)
  return wholeNotes * 4 * quarterSeconds
}

/** Notes the student must actually strike at a step, restricted to the chosen staves. */
export function playableNotes(step: ScoreStep, staves?: readonly number[]): ScoreNote[] {
  return step.notes.filter(n => !n.tiedContinuation && (!staves || staves.includes(n.staff)))
}

/** Steps between two measures (inclusive, 0-based), used for loops and hand selection. */
export function stepsInRange(timeline: Timeline, fromMeasure = 0, toMeasure = Infinity): ScoreStep[] {
  return timeline.steps.filter(s => s.measureIndex >= fromMeasure && s.measureIndex <= toMeasure)
}

export function measureCount(timeline: Timeline): number {
  return timeline.steps.reduce((max, s) => Math.max(max, s.measureIndex + 1), 0)
}

/** A cursor position as read from the score renderer, before playback timing is resolved. */
export interface RawStep {
  measureIndex: number
  /** Position inside the written score, in whole notes (jumps back on repeats). */
  scoreTime: number
  notes: ScoreNote[]
}

export interface MeasureInfo {
  /** Start of the measure inside the written score, in whole notes. */
  start: number
  /** Real length of the measure, in whole notes (pickup measures are shorter). */
  duration: number
}

/**
 * Resolves the playback time of each cursor position. Written-score time jumps back
 * on repeats, so when the cursor leaves its measure we add the rest of the old
 * measure and the offset inside the new one instead of trusting the raw timestamp.
 */
export function buildTimeline(raw: RawStep[], measures: MeasureInfo[], bpm: number, staffCount: number): Timeline {
  const steps: ScoreStep[] = []
  let time = 0
  raw.forEach((step, i) => {
    if (i > 0) {
      const prev = raw[i - 1]
      if (step.measureIndex === prev.measureIndex && step.scoreTime > prev.scoreTime) {
        time += step.scoreTime - prev.scoreTime
      } else {
        const prevMeasure = measures[prev.measureIndex]
        const curMeasure = measures[step.measureIndex]
        const restOfPrev = prevMeasure ? prevMeasure.start + prevMeasure.duration - prev.scoreTime : 0
        const intoCurrent = curMeasure ? step.scoreTime - curMeasure.start : 0
        time += Math.max(0, restOfPrev) + Math.max(0, intoCurrent)
      }
    }
    const measure = measures[step.measureIndex]
    const measureOffset = measure ? Math.max(0, step.scoreTime - measure.start) : 0
    steps.push({ index: i, time, measureIndex: step.measureIndex, measureOffset, notes: step.notes })
  })
  return { steps, bpm, staffCount, measureDurations: measures.map(m => m.duration) }
}
