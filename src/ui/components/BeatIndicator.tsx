import { useEffect, useState } from 'react'
import { metronome, type Beat } from '../../core/audio/metronome'

/** Flashes with every metronome click and shows the beat number (1 = first of the measure). */
export function BeatIndicator() {
  const [beat, setBeat] = useState<(Beat & { at: number }) | null>(null)

  useEffect(() => metronome.onBeat(b => setBeat(b && { ...b, at: performance.now() })), [])

  if (!beat) return null
  return (
    <span key={beat.at} className={`beat ${beat.accent ? 'accent' : ''}`} aria-hidden="true">
      {beat.number}
    </span>
  )
}
