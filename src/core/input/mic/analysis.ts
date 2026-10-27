import { PitchDetector } from 'pitchy'

export interface AudioFrame {
  /** Milliseconds (performance.now() clock). */
  time: number
  /** Root-mean-square level, 0..1. */
  rms: number
  /** Detected fundamental in Hz, or 0 when there is no clear pitch. */
  frequency: number
  /** Pitch detector confidence, 0..1 (McLeod "clarity"). */
  clarity: number
  /**
   * Sharpest jump in level inside the newest part of the frame, measured on short
   * blocks (about 5 ms) so that a quick re-strike is not smoothed away. 1 = no jump.
   */
  onset?: number
}

export function rmsOf(samples: ArrayLike<number>, from = 0, to = samples.length): number {
  let sum = 0
  for (let i = from; i < to; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / Math.max(1, to - from))
}

const ONSET_BLOCK = 256
const ONSET_LOOKBACK = 2

/**
 * Largest level ratio between a recent short block and the loudest of the two blocks
 * before it. Using the loudest keeps the waveform's own ripple (low notes) from
 * looking like an attack; a re-strike after the damper's short silence stands out.
 */
export function onsetStrength(samples: ArrayLike<number>): number {
  const blocks: number[] = []
  for (let start = 0; start + ONSET_BLOCK <= samples.length; start += ONSET_BLOCK) {
    blocks.push(rmsOf(samples, start, start + ONSET_BLOCK))
  }
  let strongest = 1
  // Only the newest half of the frame: older blocks were already checked by earlier frames.
  for (let i = Math.max(ONSET_LOOKBACK, Math.floor(blocks.length / 2)); i < blocks.length; i++) {
    const before = Math.max(...blocks.slice(i - ONSET_LOOKBACK, i))
    strongest = Math.max(strongest, blocks[i] / Math.max(before, 1e-4))
  }
  return strongest
}

/** Measures level and pitch of one block of samples (McLeod pitch method via pitchy). */
export class FrameAnalyzer {
  private readonly detector: PitchDetector<Float32Array>
  private readonly sampleRate: number

  constructor(frameSize: number, sampleRate: number) {
    this.detector = PitchDetector.forFloat32Array(frameSize)
    // Volume gating is done by the tracker with the calibrated threshold.
    this.detector.minVolumeAbsolute = 0
    this.sampleRate = sampleRate
  }

  analyze(samples: Float32Array, time: number): AudioFrame {
    const rms = rmsOf(samples)
    if (rms < 1e-4) return { time, rms, frequency: 0, clarity: 0, onset: 1 }
    const [frequency, clarity] = this.detector.findPitch(samples, this.sampleRate)
    return { time, rms, frequency: Number.isFinite(frequency) ? frequency : 0, clarity, onset: onsetStrength(samples) }
  }
}
