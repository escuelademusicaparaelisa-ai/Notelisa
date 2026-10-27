// Describes an instrument so the rest of the app stays instrument-agnostic.
// Adding guitar, voice or wind later means adding a new definition, not new screens.

export interface InstrumentDefinition {
  id: string
  /** Name shown in the UI (Spanish). */
  name: string
  /** Emoji shown on buttons. */
  icon: string
  /** Playable range as MIDI numbers. */
  range: { low: number; high: number }
  /** Names for each staff, e.g. piano: right hand / left hand. */
  staffLabels: string[]
  /** Whether the instrument can play several notes at once. */
  polyphonic: boolean
}
