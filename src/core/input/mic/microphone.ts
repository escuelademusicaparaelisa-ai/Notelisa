import * as Tone from 'tone'
import { noteBus, type NoteBus } from '../bus'
import type { InputSource } from '../types'
import { FrameAnalyzer, type AudioFrame } from './analysis'
import { DEFAULT_CALIBRATION, type MicCalibration } from './calibration'
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
 * note events on the note bus. Also streams raw frames for the level meter
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
    this.analyser.fftSize = FRAME_SIZE
    this.source.connect(this.analyser)

    const analyzer = new FrameAnalyzer(FRAME_SIZE, context.sampleRate)
    const buffer = new Float32Array(FRAME_SIZE)
    this.timer = window.setInterval(() => {
      if (!this.analyser) return
      this.analyser.getFloatTimeDomainData(buffer)
      const frame = analyzer.analyze(buffer, performance.now())
      for (const listener of this.frameListeners) listener(frame)
      if (!this.detecting) return
      // Report notes at the moment they were played, not when we heard them.
      const latency = this.calibration.latencyMs
      for (const event of this.tracker.process(frame)) this.bus.emit({ ...event, time: event.time - latency })
    }, POLL_MS)
    this.setStatus({ state: 'on', calibrated: !!this.savedCalibration })
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
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
