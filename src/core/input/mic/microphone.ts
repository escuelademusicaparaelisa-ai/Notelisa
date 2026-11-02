import * as Tone from 'tone'
import { noteBus, type NoteBus } from '../bus'
import type { InputSource } from '../types'
import { FrameAnalyzer, type AudioFrame } from './analysis'
import { DEFAULT_CALIBRATION, type MicCalibration } from './calibration'
import { ChordListener, SPECTRUM_SIZE, spectrumOf } from './chordListener'
import { NoteTracker } from './noteTracker'

export type MicStatus =
  | { state: 'unsupported' }
  | { state: 'off' }
  | { state: 'starting' }
  | { state: 'denied' }
  | { state: 'on'; calibrated: boolean }

type Listener<T> = (value: T) => void

const FRAME_SIZE = 2048
const POLL_MS = 12
const STORAGE_KEY = 'notelisa.micCalibration'

function loadCalibration(): MicCalibration | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_CALIBRATION, ...JSON.parse(raw) } : null
  } catch {
    return null
  }
}

function saveCalibration(calibration: MicCalibration): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calibration))
  } catch { /* storage unavailable */ }
}

/**
 * Microphone input: reads audio, detects one note at a time and publishes
 * note events on the note bus. When practice asks for several notes at once
 * (both hands, chords), it also checks that all of them are sounding. Also streams raw frames for the level meter
 * and the calibration wizard.
 */
export class MicrophoneInput implements InputSource {
  readonly kind = 'microphone' as const
  private readonly bus: NoteBus
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private timer: number | null = null
  private status: MicStatus
  private statusListeners = new Set<Listener<MicStatus>>()
  private frameListeners = new Set<Listener<AudioFrame>>()
  private savedCalibration = loadCalibration()
  readonly tracker: NoteTracker
  /** Listens for several notes at once (both hands, chords) when a practice step asks for them. */
  private readonly chordListener = new ChordListener()
  private onChordHeard: (() => void) | null = null
  /** Pauses note detection (e.g. during calibration) while frames keep flowing. */
  detecting = true

  constructor(bus: NoteBus = noteBus) {
    this.bus = bus
    this.status = MicrophoneInput.isSupported() ? { state: 'off' } : { state: 'unsupported' }
    this.tracker = new NoteTracker(this.calibration)
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  }

  get calibration(): MicCalibration {
    return this.savedCalibration ?? DEFAULT_CALIBRATION
  }

  get isOn(): boolean {
    return this.status.state === 'on'
  }

  applyCalibration(calibration: MicCalibration): void {
    this.savedCalibration = calibration
    saveCalibration(calibration)
    this.tracker.settings = { ...this.tracker.settings, threshold: calibration.threshold, a4Hz: calibration.a4Hz }
    if (this.status.state === 'on') this.setStatus({ state: 'on', calibrated: true })
  }

  /**
   * Starts listening for a whole set of notes sounding together (both hands, chords);
   * `onHeard` is called once when all of them have been heard. null stops listening.
   */
  listenForNotes(notes: readonly number[] | null, onHeard?: () => void, ignoreOctave = false): void {
    if (!notes || notes.length === 0 || !onHeard) {
      this.onChordHeard = null
      this.chordListener.stop()
      return
    }
    const { threshold, a4Hz } = this.calibration
    this.chordListener.settings = { ...this.chordListener.settings, threshold, a4Hz, ignoreOctave }
    this.chordListener.listen(notes, performance.now())
    this.onChordHeard = onHeard
  }

  onStatus(listener: Listener<MicStatus>): () => void {
    this.statusListeners.add(listener)
    listener(this.status)
    return () => this.statusListeners.delete(listener)
  }

  onFrame(listener: Listener<AudioFrame>): () => void {
    this.frameListeners.add(listener)
    return () => this.frameListeners.delete(listener)
  }

  async start(): Promise<void> {
    if (!MicrophoneInput.isSupported() || this.stream) return
    this.setStatus({ state: 'starting' })
    try {
      // Raw sound: browser voice processing would distort the piano.
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
    } catch {
      this.setStatus({ state: 'denied' })
      return
    }
    await Tone.start()
    const context = Tone.getContext().rawContext as AudioContext
    this.source = context.createMediaStreamSource(this.stream)
    this.analyser = context.createAnalyser()
    // The longer buffer feeds the spectrum used to hear chords; pitch and level use its newest part.
    this.analyser.fftSize = SPECTRUM_SIZE
    this.source.connect(this.analyser)

    const analyzer = new FrameAnalyzer(FRAME_SIZE, context.sampleRate)
    const buffer = new Float32Array(SPECTRUM_SIZE)
    const newest = buffer.subarray(SPECTRUM_SIZE - FRAME_SIZE)
    let tick = 0
    this.timer = window.setInterval(() => {
      if (!this.analyser) return
      this.analyser.getFloatTimeDomainData(buffer)
      const frame = analyzer.analyze(newest, performance.now())
      for (const listener of this.frameListeners) listener(frame)
      if (!this.detecting) return
      // Every other frame is enough for the spectrum (frames overlap a lot) and halves the work.
      // Without a step waiting, only keys being struck are followed (fast passages strike
      // the next key before the previous step has been recognised).
      const spectrum = this.onChordHeard && tick++ % 2 === 0 ? spectrumOf(buffer, context.sampleRate) : undefined
      if (this.chordListener.process(frame, spectrum) && this.onChordHeard) {
        const onHeard = this.onChordHeard
        this.onChordHeard = null
        onHeard()
      }
      // Report notes at the moment they were played, not when we heard them.
      const latency = this.calibration.latencyMs
      for (const event of this.tracker.process(frame)) this.bus.emit({ ...event, time: event.time - latency })
    }, POLL_MS)
    this.setStatus({ state: 'on', calibrated: !!this.savedCalibration })
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.listenForNotes(null)
    for (const event of this.tracker.reset()) this.bus.emit(event)
    this.source?.disconnect()
    this.stream?.getTracks().forEach(track => track.stop())
    this.stream = null
    this.source = null
    this.analyser = null
    this.setStatus(MicrophoneInput.isSupported() ? { state: 'off' } : { state: 'unsupported' })
  }

  private setStatus(status: MicStatus): void {
    this.status = status
    for (const listener of this.statusListeners) listener(status)
  }
}

export const microphoneInput = new MicrophoneInput()
