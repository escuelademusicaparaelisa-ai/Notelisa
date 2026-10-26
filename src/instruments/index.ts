import { flute } from './flute'
import { piano } from './piano'
import type { InstrumentDefinition } from './types'

export const instruments: Record<string, InstrumentDefinition> = {
  [piano.id]: piano,
  [flute.id]: flute,
}

export function getInstrument(id: string | undefined): InstrumentDefinition {
  return (id && instruments[id]) || piano
}

export function staffLabel(instrument: InstrumentDefinition, staff: number): string {
  return instrument.staffLabels[staff] ?? `Pentagrama ${staff + 1}`
}

export type { InstrumentDefinition }
