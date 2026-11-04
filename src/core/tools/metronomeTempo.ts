// Tempo helpers for the stand-alone metronome.

export const MIN_BPM = 30
export const MAX_BPM = 240

export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)))
}

/** The Italian tempo marking that musicians use for a speed. */
export function tempoName(bpm: number): string {
  if (bpm < 50) return 'Largo'
  if (bpm < 66) return 'Lento'
  if (bpm < 76) return 'Adagio'
  if (bpm < 108) return 'Andante'
  if (bpm < 120) return 'Moderato'
  if (bpm < 168) return 'Allegro'
  return 'Presto'
}

/** Taps further apart than this start a new count. */
const TAP_RESET_MS = 2000
const TAPS_KEPT = 6

/** "Tap tempo": the speed of the last few taps, or null until there are two. */
export class TapTempo {
  private taps: number[] = []

  tap(now: number): number | null {
    const last = this.taps[this.taps.length - 1]
    if (last !== undefined && now - last > TAP_RESET_MS) this.taps = []
    this.taps.push(now)
    if (this.taps.length > TAPS_KEPT) this.taps.shift()
    if (this.taps.length < 2) return null
    const average = (this.taps[this.taps.length - 1] - this.taps[0]) / (this.taps.length - 1)
    return clampBpm(60000 / average)
  }
}
