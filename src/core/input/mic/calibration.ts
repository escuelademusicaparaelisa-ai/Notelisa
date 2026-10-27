import { DEFAULT_A4_HZ } from '../../music/pitch'
import type { AudioFrame } from './analysis'

// Pure helpers used by the calibration wizard. Each step records audio frames
// and one of these functions turns them into a setting.

export interface MicCalibration {
  /** Minimum RMS level for a sound to count as playing. */
  threshold: number
  a4Hz: number
  /** Delay between a key being struck and the app hearing it, in ms. */
  latencyMs: number
}

export const DEFAULT_CALIBRATION: MicCalibration = { threshold: 0.01, a4Hz: DEFAULT_A4_HZ, latencyMs: 0 }

const MIN_THRESHOLD = 0.004
const MAX_THRESHOLD = 0.1

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
}

export function median(values: number[]): number {
  return percentile(values, 0.5)
}

/** Step 1 (silence): the threshold sits safely above the room's background noise. */
export function thresholdFromNoise(silence: AudioFrame[]): number {
  const noise = percentile(silence.map(f => f.rms), 0.9)
  return Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, noise * 3))
}

export type LoudnessCheck = { ok: true; peak: number } | { ok: false; reason: 'silent' | 'tooQuiet'; peak: number }

/** Step 2 (a loud note): checks the piano is clearly louder than the threshold. */
export function checkLoudness(frames: AudioFrame[], threshold: number): LoudnessCheck {
  const peak = Math.max(0, ...frames.map(f => f.rms))
  if (peak < threshold) return { ok: false, reason: 'silent', peak }
  if (peak < threshold * 4) return { ok: false, reason: 'tooQuiet', peak }
  return { ok: true, peak }
}

export type TuningResult = { ok: true; a4Hz: number; cents: number } | { ok: false; reason: 'noPitch' | 'notAnA' }

/** Step 3 (play any A): derives the piano's tuning reference from the heard A. */
export function tuningFromA(frames: AudioFrame[], threshold: number): TuningResult {
  const heard = frames.filter(f => f.rms >= threshold && f.clarity >= 0.9 && f.frequency > 0).map(f => f.frequency)
  if (heard.length < 5) return { ok: false, reason: 'noPitch' }
  const frequency = median(heard)
  const octaves = Math.round(Math.log2(frequency / DEFAULT_A4_HZ))
  const a4Hz = frequency / Math.pow(2, octaves)
  const cents = 1200 * Math.log2(a4Hz / DEFAULT_A4_HZ)
  // More than a semitone away: the student played another note.
  if (Math.abs(cents) > 60) return { ok: false, reason: 'notAnA' }
  return { ok: true, a4Hz, cents }
}

/** Step 4 (clicks through the speakers): median delay between each click and when it was heard. */
export function latencyFromClicks(clickTimes: number[], frames: AudioFrame[], threshold: number): number | null {
  const delays: number[] = []
  for (const click of clickTimes) {
    const heard = frames.find(f => f.time >= click && f.rms >= threshold * 2)
    if (heard && heard.time - click < 500) delays.push(heard.time - click)
  }
  if (delays.length < Math.ceil(clickTimes.length / 2)) return null
  return Math.round(median(delays))
}
