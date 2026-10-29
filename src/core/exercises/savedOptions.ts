// The last exercise choices, remembered on this device.

import { defaultMaxInterval, type ExerciseOptions } from './generator'

const OPTIONS_KEY = 'notelisa.exerciseOptions'

export const DEFAULT_EXERCISE: ExerciseOptions = {
  kind: 'reading', instrument: 'piano', clef: 'treble', key: 'C', time: '4/4', rhythm: 2, rests: false, range: 1, notes: [], maxInterval: 3, measures: 8, minor: 'harmonic',
}

export function savedExerciseOptions(): ExerciseOptions {
  try {
    const saved = localStorage.getItem(OPTIONS_KEY)
    if (!saved) return DEFAULT_EXERCISE
    const parsed = JSON.parse(saved) as Partial<ExerciseOptions>
    const options = { ...DEFAULT_EXERCISE, ...parsed }
    // Choices saved before the interval could be chosen keep the one their range used.
    return parsed.maxInterval ? options : { ...options, maxInterval: defaultMaxInterval(options.range) }
  } catch {
    return DEFAULT_EXERCISE
  }
}

export function saveExerciseOptions(options: ExerciseOptions): void {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options))
  } catch {
    // Private browsing: the choices are just not remembered.
  }
}
