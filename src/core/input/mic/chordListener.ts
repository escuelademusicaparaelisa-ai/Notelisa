import { DEFAULT_A4_HZ, midiToFrequency } from '../../music/pitch'
import type { AudioFrame } from './analysis'

// Hearing several notes at once (both hands, chords) with the microphone.
//
// The note tracker follows one pitch at a time, which works for a melody but not
// when two hands sound together: the mix has no single pitch. Here we do not try
// to name every note we hear. We already know which notes the score asks for, so
// we only check, in the spectrum, whether each of those notes is sounding.

/** Samples used for the spectrum: about 170 ms, fine enough to tell low notes apart. */
export const SPECTRUM_SIZE = 8192

/** In-place radix-2 FFT. `re` and `im` have the same power-of-two length. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    const wRe = Math.cos(angle)
    const wIm = Math.sin(angle)
    for (let start = 0; start < n; start += len) {
      let cRe = 1
      let cIm = 0
      for (let k = 0; k < len / 2; k++) {
        const a = start + k
        const b = a + len / 2
        const tRe = re[b] * cRe - im[b] * cIm
        const tIm = re[b] * cIm + im[b] * cRe
        re[b] = re[a] - tRe
        im[b] = im[a] - tIm
        re[a] += tRe
        im[a] += tIm
        const next = cRe * wRe - cIm * wIm
        cIm = cRe * wIm + cIm * wRe
        cRe = next
      }
    }
  }
}

export interface Spectrum {
  /** Magnitude of each frequency bin (Hann window). */
  magnitudes: Float64Array
  /** Width of one bin in Hz. */
  binHz: number
}

// Work buffers reused between calls: the spectrum is computed many times a second.
let scratch: { re: Float64Array; im: Float64Array; window: Float64Array } | null = null

/** Magnitude spectrum of a block of samples (length must be a power of two). */
export function spectrumOf(samples: ArrayLike<number>, sampleRate: number): Spectrum {
  const n = samples.length
  if (scratch?.re.length !== n) {
    const window = new Float64Array(n)
    for (let i = 0; i < n; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))
    scratch = { re: new Float64Array(n), im: new Float64Array(n), window }
  }
  const { re, im, window } = scratch
  for (let i = 0; i < n; i++) re[i] = samples[i] * window[i]
  im.fill(0)
  fft(re, im)
  const magnitudes = new Float64Array(n / 2)
  for (let i = 0; i < n / 2; i++) magnitudes[i] = Math.hypot(re[i], im[i])
  return { magnitudes, binHz: sampleRate / n }
}

// A peak must stand this far above the spectrum around it (×4 ≈ 12 dB)...
const PEAK_OVER_FLOOR = 4
// ...and be no weaker than this fraction of the loudest peak (0.01 = −40 dB).
const MIN_PEAK_FRACTION = 0.01
// How far from the exact pitch a peak may sit (piano strings are slightly stretched).
const PEAK_CENTS = 40
// Below this note (G2, ~98 Hz) the fundamental is weak on a piano and too close to its
// neighbours to separate, so the note is recognised by its harmonics: two of the 2nd to 4th.
const LOWEST_FUNDAMENTAL_MIDI = 43

function binRange(spectrum: Spectrum, frequency: number, cents: number, minBins: number): [number, number] {
  const ratio = Math.pow(2, cents / 1200)
  const center = frequency / spectrum.binHz
  const from = Math.min(Math.floor((frequency / ratio) / spectrum.binHz), Math.round(center) - minBins)
  const to = Math.max(Math.ceil((frequency * ratio) / spectrum.binHz), Math.round(center) + minBins)
  return [Math.max(1, from), Math.min(spectrum.magnitudes.length - 1, to)]
}

/**
 * Height of the spectral peak at a frequency, or 0 when there is none: the loudest bin
 * nearby must be a local maximum whose (interpolated) frequency lies within PEAK_CENTS.
 * Without the frequency check, the side of a neighbouring semitone's peak would count.
 */
function peakAt(spectrum: Spectrum, frequency: number): number {
  const m = spectrum.magnitudes
  const [from, to] = binRange(spectrum, frequency, PEAK_CENTS, 1)
  let best = from
  for (let i = from; i <= to; i++) if (m[i] > m[best]) best = i
  if (best <= 0 || best >= m.length - 1 || m[best] < m[best - 1] || m[best] < m[best + 1]) return 0
  // Parabolic interpolation of the true peak position between bins.
  const [a, b, c] = [m[best - 1], m[best], m[best + 1]]
  const denominator = a - 2 * b + c
  const shift = denominator === 0 ? 0 : (0.5 * (a - c)) / denominator
  const peakHz = (best + shift) * spectrum.binHz
  if (Math.abs(1200 * Math.log2(peakHz / frequency)) > PEAK_CENTS) return 0
  return b
}

/** Typical level around a frequency (median over ±3 semitones): what a peak must rise above. */
function floorAround(spectrum: Spectrum, frequency: number): number {
  const [from, to] = binRange(spectrum, frequency, 300, 6)
  const values = Array.from(spectrum.magnitudes.subarray(from, to + 1)).sort((a, b) => a - b)
  return values[Math.floor(values.length / 2)] ?? 0
}

/** Loudest bin between 50 Hz and 5 kHz. */
export function loudestPeak(spectrum: Spectrum): number {
  const from = Math.max(1, Math.floor(50 / spectrum.binHz))
  const to = Math.min(spectrum.magnitudes.length - 1, Math.ceil(5000 / spectrum.binHz))
  let peak = 0
  for (let i = from; i <= to; i++) peak = Math.max(peak, spectrum.magnitudes[i])
  return peak
}

function strongPeak(spectrum: Spectrum, frequency: number, loudest: number): boolean {
  if (frequency / spectrum.binHz >= spectrum.magnitudes.length - 2) return false
  const peak = peakAt(spectrum, frequency)
  return peak >= loudest * MIN_PEAK_FRACTION && peak >= floorAround(spectrum, frequency) * PEAK_OVER_FLOOR
}

/** Whether a note is sounding in the spectrum. */
export function noteSounds(spectrum: Spectrum, midi: number, a4Hz = DEFAULT_A4_HZ, loudest = loudestPeak(spectrum)): boolean {
  if (loudest <= 0) return false
  const f0 = midiToFrequency(midi, a4Hz)
  if (midi >= LOWEST_FUNDAMENTAL_MIDI) return strongPeak(spectrum, f0, loudest)
  return [2, 3, 4].filter(h => strongPeak(spectrum, h * f0, loudest)).length >= 2
}

export interface ChordListenerSettings {
  /** Minimum RMS level for a sound to count (from calibration). */
  threshold: number
  a4Hz: number
  /** Accept the right note in another octave. */
  ignoreOctave: boolean
  /** Consecutive analyses a note must be heard in before it counts. */
  framesToConfirm: number
  /** Attacks this soon (ms) after listening starts belong to the notes just played. */
  settleMs: number
  /** Volume must grow by this factor over its recent minimum to count as a new attack. */
  onsetRatio: number
  /** Same, measured on short blocks inside a frame. */
  shortOnsetRatio: number
}

export const DEFAULT_CHORD_SETTINGS: ChordListenerSettings = {
  threshold: 0.01,
  a4Hz: DEFAULT_A4_HZ,
  ignoreOctave: false,
  framesToConfirm: 2,
  settleMs: 120,
  onsetRatio: 1.6,
  shortOnsetRatio: 1.8,
}

/**
 * Waits until every note of a step has been heard. A note only counts after a key
 * was struck while waiting for this step, so notes still ringing from the step
 * before do not complete the next one by themselves. The hands do not have to
 * strike exactly together: each note is ticked off as soon as it is heard.
 * In chords of three or more notes one inner or bass note may go unheard (they
 * hide behind each other's harmonics); the top note, usually the melody, may not.
 */
export class ChordListener {
  settings: ChordListenerSettings
  private expected: number[] = []
  private heard = new Set<number>()
  private streak = new Map<number, number>()
  private struck = false
  private valley = Infinity
  private done = true
  private since = 0

  constructor(settings: Partial<ChordListenerSettings> = {}) {
    this.settings = { ...DEFAULT_CHORD_SETTINGS, ...settings }
  }

  /** Starts listening for a new set of notes; `time` is now, on the frames' clock. */
  listen(notes: readonly number[], time = -Infinity): void {
    this.expected = [...new Set(notes)].sort((a, b) => a - b)
    this.since = time
    this.heard.clear()
    this.streak.clear()
    this.struck = false
    this.valley = Infinity
    this.done = this.expected.length === 0
  }

  get pending(): number[] {
    return this.expected.filter(n => !this.heard.has(n))
  }

  /**
   * Feeds one analysis; returns true once, when the last expected note is heard.
   * Without a spectrum, only watches for keys being struck (cheaper, for in-between frames).
   */
  process(frame: AudioFrame, spectrum?: Spectrum): boolean {
    if (this.done) return false
    const s = this.settings
    if (frame.rms < s.threshold) {
      this.valley = Math.min(this.valley, frame.rms)
      this.streak.clear()
      return false
    }
    const levelRise = frame.rms > Math.max(this.valley, s.threshold * 0.5) * s.onsetRatio
    const shortRise = (frame.onset ?? 1) >= s.shortOnsetRatio
    if ((levelRise || shortRise) && frame.time - this.since >= s.settleMs) this.struck = true
    this.valley = levelRise ? frame.rms : Math.min(this.valley, frame.rms)
    if (!this.struck || !spectrum) return false

    const loudest = loudestPeak(spectrum)
    for (const midi of this.pending) {
      const sounds = this.sounds(spectrum, midi, loudest)
      const count = sounds ? (this.streak.get(midi) ?? 0) + 1 : 0
      this.streak.set(midi, count)
      if (count >= s.framesToConfirm) this.heard.add(midi)
    }
    if (!this.enoughHeard()) return false
    this.done = true
    return true
  }

  private enoughHeard(): boolean {
    const top = this.expected[this.expected.length - 1]
    const allowedMissing = this.expected.length >= 3 ? 1 : 0
    return this.heard.has(top) && this.pending.length <= allowedMissing
  }

  private sounds(spectrum: Spectrum, midi: number, loudest: number): boolean {
    const { a4Hz, ignoreOctave } = this.settings
    if (noteSounds(spectrum, midi, a4Hz, loudest)) return true
    if (!ignoreOctave) return false
    return [-24, -12, 12, 24].some(shift => noteSounds(spectrum, midi + shift, a4Hz, loudest))
  }
}
