import type { InstrumentDefinition } from './types'

export const flute: InstrumentDefinition = {
  id: 'flute',
  name: 'Flauta',
  range: { low: 60, high: 96 },
  staffLabels: ['Flauta 1', 'Flauta 2'],
  polyphonic: false,
}
