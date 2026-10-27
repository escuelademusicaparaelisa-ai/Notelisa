import type { ScoreStep, Timeline } from './timeline'

// Metronome beats: one click per quarter note, aligned to the start of each measure.

export interface Beat {
  /** Position from the first step of the range, in whole notes. */
  time: number
  /** First beat of a measure. */
  accent: boolean
}

const QUARTER = 0.25
const EPSILON = 1e-6

function measureLength(timeline: Timeline, measureIndex: number): number {
  const length = timeline.measureDurations?.[measureIndex]
  return length && length > 0 ? length : 1
}

/** Number of quarter-note beats in a measure (at least 2, so a count-in is never a single click). */
export function beatsInMeasure(timeline: Timeline, measureIndex: number): number {
  return Math.max(2, Math.round(measureLength(timeline, measureIndex) / QUARTER))
}

/**
 * Beats from the first to the last given step. Repeats play a measure again, so
 * each pass through a measure is handled separately: a new pass starts when the
 * measure changes or when the position inside the measure jumps back.
 */
export function beatsForSteps(timeline: Timeline, steps: readonly ScoreStep[]): Beat[] {
  if (steps.length === 0) return []
  const origin = steps[0].time
  const last = steps[steps.length - 1]
  const end = last.time + Math.max(0, ...last.notes.map(n => n.duration))
  const beats: Beat[] = []
  let previous: ScoreStep | null = null
  for (const step of steps) {
    const offset = step.measureOffset ?? 0
    const samePass = previous && previous.measureIndex === step.measureIndex && offset > (previous.measureOffset ?? 0)
    previous = step
    if (samePass) continue
    const start = step.time - offset
    const length = measureLength(timeline, step.measureIndex)
    for (let at = start; at < start + length - EPSILON; at += QUARTER) {
      if (at < origin - EPSILON || at >= end - EPSILON) continue
      beats.push({ time: at - origin, accent: Math.abs(at - start) < EPSILON })
    }
  }
  return beats
}
