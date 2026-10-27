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
const MAX_THRESHOLD = 0.05

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
}

export function median(values: number[]): number {
  return percentile(values, 0.5)
}

/** Step 1 (silence): the background noise level of the room. */
export function noiseLevel(silence: AudioFrame[]): number {
  return percentile(silence.map(f => f.rms), 0.9)
}

/** A first threshold safely above the room's background noise. */
export function thresholdFromNoise(silence: AudioFrame[]): number {
  return clampThreshold(noiseLevel(silence) * 3)
}

function clampThreshold(value: number): number {
  return Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, value))
}

export type LoudnessCheck =
  | { ok: true; peak: number; threshold: number }
  | { ok: false; reason: 'silent' | 'tooQuiet'; peak: number }

/**
 * Step 2 (a loud note): checks the piano stands out from the noise and sets the
 * final threshold between the noise and the piano, so softer playing still counts.
 */
export function checkLoudness(frames: AudioFrame[], noise: number): LoudnessCheck {
  const peak = Math.max(0, ...frames.map(f => f.rms))
  const floor = Math.max(noise, MIN_THRESHOLD / 3)
  const pitched = frames.filter(f => f.rms > floor * 2 && f.clarity >= 0.9).length
  if (peak < floor * 2 || pitched < 3) return { ok: false, reason: 'silent', peak }
  if (peak < floor * 4) return { ok: false, reason: 'tooQuiet', peak }
  return { ok: true, peak, threshold: clampThreshold(Math.max(floor * 2, Math.min(floor * 3, peak / 4))) }
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

/**
 * Step 4 (clicks through the speakers): median delay between each click and when it
 * was heard. Each click is found by how much it stands out from the room noise, not
 * by the playing threshold: a device can play the clicks quieter than a piano.
 */
export function latencyFromClicks(clickTimes: number[], frames: AudioFrame[], threshold: number): number | null {
  if (frames.length === 0 || clickTimes.length === 0) return null
  const quiet = frames.filter(f => f.time < clickTimes[0])
  const baseline = Math.max(0.0005, median((quiet.length >= 3 ? quiet : frames).map(f => f.rms)))
  const delays: number[] = []
  clickTimes.forEach((click, i) => {
    // Look a little before the expected time (the clock estimate can be early) and
    // stop before the next click.
    const end = Math.min(click + 600, clickTimes[i + 1] ?? Infinity)
    const window = frames.filter(f => f.time >= click - 100 && f.time < end)
    if (window.length === 0) return
    const peak = Math.max(...window.map(f => f.rms))
    if (peak < baseline * 3 || peak < threshold * 0.25) return
    const heard = window.find(f => f.rms >= baseline + (peak - baseline) * 0.3)
    if (heard) delays.push(heard.time - click)
  })
  if (delays.length < Math.ceil(clickTimes.length / 2)) return null
  return Math.round(median(delays))
}
