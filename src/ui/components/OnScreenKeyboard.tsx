import { useEffect, useRef } from 'react'
import { noteBus } from '../../core/input/bus'
import { midiToSolfege } from '../../core/music/pitch'

interface Props {
  low?: number
  high?: number
  /** Keys to highlight as a hint (the notes to play now). */
  hints?: readonly number[]
  /** Keys currently held on any input. */
  pressed?: ReadonlySet<number>
}

const BLACK = new Set([1, 3, 6, 8, 10])
const isBlack = (midi: number) => BLACK.has(midi % 12)

function press(midi: number): void {
  noteBus.emit({ type: 'noteon', midi, time: performance.now(), strength: 0.8, source: 'screen' })
}

function release(midi: number): void {
  noteBus.emit({ type: 'noteoff', midi, time: performance.now(), strength: 0, source: 'screen' })
}

/** A playable piano keyboard drawn on screen; it publishes notes on the note bus. */
export function OnScreenKeyboard({ low = 48, high = 84, hints = [], pressed }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const whites: number[] = []
  for (let m = low; m <= high; m++) if (!isBlack(m)) whites.push(m)

  // Keep the hinted keys in view on narrow screens.
  const firstHint = hints.length ? Math.min(...hints) : null
  useEffect(() => {
    if (firstHint === null || !scrollRef.current) return
    const key = scrollRef.current.querySelector<HTMLElement>(`[data-midi="${firstHint}"]`)
    key?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [firstHint])

  const keyProps = (midi: number) => ({
    'data-midi': midi,
    'aria-label': midiToSolfege(midi),
    className: [
      isBlack(midi) ? 'key black' : 'key white',
      hints.includes(midi) ? 'hint' : '',
      pressed?.has(midi) ? 'down' : '',
    ].join(' '),
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      // Let a finger slide off the key to release it.
      const el = e.target as HTMLElement
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
      press(midi)
    },
    onPointerUp: () => release(midi),
    onPointerLeave: (e: React.PointerEvent) => { if (e.buttons) release(midi) },
  })

  return (
    <div className="keyboard-scroll" ref={scrollRef}>
      <div className="keyboard" style={{ width: whites.length * 40 }}>
        {whites.map((midi, i) => (
          <button key={midi} {...keyProps(midi)} style={{ left: i * 40 }}>
            {midi % 12 === 0 && <span className="key-label">Do{Math.floor(midi / 12) - 1}</span>}
          </button>
        ))}
        {whites.map((white, i) => {
          const black = white + 1
          if (black > high || !isBlack(black)) return null
          return <button key={black} {...keyProps(black)} style={{ left: i * 40 + 27 }} />
        })}
      </div>
    </div>
  )
}
