// Common input layer: microphone and MIDI keyboard both emit NoteInputEvents,
// so practice modes never need to know where a note came from.
// Implementations arrive in phase 2 (MIDI) and phase 3 (microphone).

export type InputSourceKind = 'midi' | 'microphone'

export interface NoteInputEvent {
  type: 'noteon' | 'noteoff'
  midi: number
  /** performance.now() timestamp in milliseconds, already latency-compensated. */
  time: number
  /** 0..1: key velocity for MIDI, detection confidence for the microphone. */
  strength: number
  source: InputSourceKind
}

export type NoteInputListener = (event: NoteInputEvent) => void

export interface InputSource {
  readonly kind: InputSourceKind
  start(): Promise<void>
  stop(): void
  subscribe(listener: NoteInputListener): () => void
}
