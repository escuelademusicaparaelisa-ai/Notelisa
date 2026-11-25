import type { InstrumentDefinition } from './types'

/** Cornet in Do with a rotor to Re♭: natural notes only, from Sol4 to Fa6. */
export const cornet: InstrumentDefinition = {
  id: 'cornet',
  name: 'Corneta Do/Re♭',
  range: { low: 67, high: 89 },
  staffLabels: ['Corneta'],
  polyphonic: false,
}
