import type { MeasureStats } from './waitSession'

// End-of-exercise summary shown to the student.

export interface PracticeSummary {
  /** Percentage of right notes over everything that happened (0-100). */
  accuracy: number
  /** Percentage of right notes that were on time (tempo mode only). */
  rhythm: number | null
  /** 1 to 3 stars. */
  stars: number
  correct: number
  wrong: number
  missed: number
  /** Up to three measures (0-based) with the most problems, worst first. */
  problemMeasures: number[]
}

export function summarize(stats: ReadonlyMap<number, MeasureStats>, timed: boolean): PracticeSummary {
  let correct = 0
  let wrong = 0
  let missed = 0
  let offTime = 0
  const problems: { measure: number; score: number }[] = []
  for (const [measure, s] of stats) {
    correct += s.correct
    wrong += s.wrong
    missed += s.missed
    offTime += s.offTime
    // A note played early or late counts as half a mistake.
    const score = s.wrong + s.missed + s.offTime / 2
    if (score > 0) problems.push({ measure, score })
  }
  const total = correct + wrong + missed
  const accuracy = total ? Math.round((correct / total) * 100) : 100
  const rhythm = timed ? (correct ? Math.round(((correct - offTime) / correct) * 100) : 0) : null
  const overall = rhythm === null ? accuracy : (accuracy + rhythm) / 2
  const stars = overall >= 90 ? 3 : overall >= 70 ? 2 : 1
  problems.sort((a, b) => b.score - a.score || a.measure - b.measure)
  return { accuracy, rhythm, stars, correct, wrong, missed, problemMeasures: problems.slice(0, 3).map(p => p.measure) }
}
