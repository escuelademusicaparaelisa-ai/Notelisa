import { useEffect, useState } from 'react'
import type { SelectableNote } from '../../core/exercises/generator'
import { midiToSolfege } from '../../core/music/pitch'
import { ChevronLeft, ChevronRight } from '../icons'

interface Props {
  notes: SelectableNote[]
  /** Staff positions of the chosen notes. */
  chosen: number[]
  onToggle(position: number): void
}

const BLACK = new Set([1, 3, 6, 8, 10])
const isBlack = (midi: number) => BLACK.has(midi % 12)
/** White keys in view: two octaves on wide screens, one on phones. */
const WIDE = 15
const NARROW = 8

function useNarrow(): boolean {
  const query = '(max-width: 560px)'
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(query).matches ?? false)
  useEffect(() => {
    const media = window.matchMedia?.(query)
    if (!media) return
    const update = () => setNarrow(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return narrow
}

/**
 * A piano keyboard to choose the notes of an exercise. Only the notes of the key can be tapped;
 * the arrows move it an octave lower or higher.
 */
export function NotePicker({ notes, chosen, onToggle }: Props) {
  const narrow = useNarrow()
  const byMidi = new Map(notes.map(n => [n.midi, n]))
  const midis = notes.map(n => n.midi)
  const lowest = Math.min(...midis)
  const highest = Math.max(...midis)
  // Every white key from the lowest note to the highest, with a white key either side of a black one.
  const whites: number[] = []
  for (let m = isBlack(lowest) ? lowest - 1 : lowest; m <= highest + (isBlack(highest) ? 1 : 0); m++) if (!isBlack(m)) whites.push(m)
  const count = Math.min(narrow ? NARROW : WIDE, whites.length)
  const maxStart = whites.length - count

  // Start a little below the lowest chosen note (or the first default one), at a Do when it fits.
  const [start, setStart] = useState(() => {
    const chosenMidis = notes.filter(n => chosen.includes(n.position)).map(n => n.midi)
    const anchor = chosenMidis.length ? Math.min(...chosenMidis) : notes[Math.floor(notes.length / 2)].midi
    let i = whites.findIndex(w => w >= anchor - (isBlack(anchor) ? 1 : 0))
    while (i > 0 && whites[i] % 12 !== 0 && whites[i] > anchor - 12) i--
    return i
  })
  const first = Math.max(0, Math.min(start, maxStart))
  const visible = whites.slice(first, first + count)
  const shift = (by: number) => setStart(Math.max(0, Math.min(first + by, maxStart)))

  const hidden = notes.filter(n => chosen.includes(n.position) && (n.midi < visible[0] || n.midi > visible[visible.length - 1])).length
  const width = 100 / count

  const keyButton = (midi: number, left: number, black: boolean) => {
    const note = byMidi.get(midi)
    const active = !!note && chosen.includes(note.position)
    return (
      <button key={midi} type="button" disabled={!note}
        className={`pick-key ${black ? 'black' : 'white'} ${active ? 'active' : ''}`}
        style={{ left: `${left}%`, width: `${black ? width * 0.62 : width}%` }}
        aria-pressed={note ? active : undefined}
        aria-label={note ? note.name : `${midiToSolfege(midi)} (no es de la tonalidad)`}
        onClick={() => note && onToggle(note.position)}>
        {active ? <span className="pick-label">{note.name}</span>
          : !black && midi % 12 === 0 && <span className="pick-label faint">Do{Math.floor(midi / 12) - 1}</span>}
      </button>
    )
  }

  return (
    <div className="note-picker">
      <div className="note-picker-nav">
        <button type="button" className="chip" onClick={() => shift(-7)} disabled={first === 0}>
          <ChevronLeft /> <span className="wide-only">Más grave</span><span className="narrow-only">Grave</span>
        </button>
        <span className="note-picker-range">{midiToSolfege(visible[0])} – {midiToSolfege(visible[visible.length - 1])}</span>
        <button type="button" className="chip" onClick={() => shift(7)} disabled={first === maxStart}>
          <span className="wide-only">Más agudo</span><span className="narrow-only">Agudo</span> <ChevronRight />
        </button>
      </div>
      <div className="pick-keyboard">
        {visible.map((midi, i) => keyButton(midi, i * width, false))}
        {visible.map((white, i) => {
          const black = white + 1
          if (!isBlack(black) || i === visible.length - 1) return null
          return keyButton(black, (i + 1) * width - width * 0.31, true)
        })}
      </div>
      {hidden > 0 && <p className="exercise-hint">
        {hidden === 1 ? 'Hay 1 nota elegida fuera de la vista.' : `Hay ${hidden} notas elegidas fuera de la vista.`} Usa las flechas para verlas.
      </p>}
    </div>
  )
}
