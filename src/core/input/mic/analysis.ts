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
}

export function rmsOf(samples: ArrayLike<number>): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
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
    if (rms < 1e-4) return { time, rms, frequency: 0, clarity: 0 }
    const [frequency, clarity] = this.detector.findPitch(samples, this.sampleRate)
    return { time, rms, frequency: Number.isFinite(frequency) ? frequency : 0, clarity }
  }
}
