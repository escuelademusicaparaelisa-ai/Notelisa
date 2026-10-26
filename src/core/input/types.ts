// Common input layer: microphone, MIDI keyboard and the on-screen keyboard all
// publish NoteInputEvents on the note bus, so practice modes never need to know
// where a note came from.

export type InputSourceKind = 'midi' | 'microphone' | 'screen'

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

/** A device that publishes notes on the note bus while started. */
export interface InputSource {
  readonly kind: InputSourceKind
  start(): Promise<void>
  stop(): void
}
