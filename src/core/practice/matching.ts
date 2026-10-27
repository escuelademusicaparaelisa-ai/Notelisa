// Decides whether a played note counts as one of the notes the score expects.

export interface MatchOptions {
  /** Accept the right note in any octave (useful for small keyboards and microphones). */
  ignoreOctave: boolean
}

export const DEFAULT_MATCH_OPTIONS: MatchOptions = { ignoreOctave: false }

export function pitchMatches(played: number, expected: number, options: MatchOptions = DEFAULT_MATCH_OPTIONS): boolean {
  if (options.ignoreOctave) return ((played - expected) % 12 + 12) % 12 === 0
  return played === expected
}

export type MatchResult =
  | { kind: 'correct'; expected: number }
  | { kind: 'repeat'; expected: number }
  | { kind: 'wrong' }

/**
 * Tracks which expected notes of one step (a single note or a chord) have been
 * played. Notes of a chord may arrive in any order.
 */
export class StepMatcher {
  private readonly hit = new Set<number>()
  readonly expected: readonly number[]
  private readonly options: MatchOptions

  constructor(expected: readonly number[], options: MatchOptions = DEFAULT_MATCH_OPTIONS) {
    this.expected = expected
    this.options = options
  }

  play(midi: number): MatchResult {
    const pending = this.expected.find(e => !this.hit.has(e) && pitchMatches(midi, e, this.options))
    if (pending !== undefined) {
      this.hit.add(pending)
      return { kind: 'correct', expected: pending }
    }
    const already = this.expected.find(e => pitchMatches(midi, e, this.options))
    if (already !== undefined) return { kind: 'repeat', expected: already }
    return { kind: 'wrong' }
  }

  get complete(): boolean {
    return this.hit.size === new Set(this.expected).size
  }

  get hitNotes(): number[] {
    return [...this.hit]
  }

  /** Expected notes not played yet. */
  get pendingNotes(): number[] {
    return [...new Set(this.expected)].filter(e => !this.hit.has(e))
  }
}
