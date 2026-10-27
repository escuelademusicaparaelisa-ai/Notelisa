import type { InstrumentDefinition } from './types'

export const piano: InstrumentDefinition = {
  id: 'piano',
  name: 'Piano',
  icon: '🎹',
  range: { low: 21, high: 108 },
  staffLabels: ['Mano derecha', 'Mano izquierda'],
  polyphonic: true,
}
