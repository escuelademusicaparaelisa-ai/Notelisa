import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScorePlayer } from '../../core/audio/player'
import { midiToSolfege } from '../../core/music/pitch'
import { playableNotes, type Timeline } from '../../core/score/timeline'
import { getInstrument, staffLabel } from '../../instruments'
import { pieceUrl, type Piece } from '../../library/catalog'
import { ScoreView, type ScoreViewHandle } from '../components/ScoreView'

interface Props {
  piece: Piece
  onBack(): void
}

const player = new ScorePlayer()

export function PracticeScreen({ piece, onBack }: Props) {
  const scoreRef = useRef<ScoreViewHandle>(null)
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [audioLoading, setAudioLoading] = useState(false)
  const [tempo, setTempo] = useState(100)
  const [zoom, setZoom] = useState(1)
  // null = all staves (both hands).
  const [staff, setStaff] = useState<number | null>(null)
  const instrument = getInstrument(piece.instrument)
  const staves = useMemo(() => (staff === null ? undefined : [staff]), [staff])

  const goTo = useCallback((target: number) => {
    if (!timeline) return
    const clamped = Math.max(0, Math.min(target, timeline.steps.length - 1))
    scoreRef.current?.goTo(clamped)
    setStep(clamped)
  }, [timeline])

  const stop = useCallback(() => {
    player.stop()
    setPlaying(false)
  }, [])

  useEffect(() => stop, [stop])

  const listen = async () => {
    if (!timeline) return
    if (playing) return stop()
    setAudioLoading(true)
    try {
      setPlaying(true)
      const from = step >= timeline.steps.length - 1 ? 0 : step
      await player.play(timeline, {
        fromStep: from,
        tempoFactor: tempo / 100,
        staves,
        onStep: goTo,
        onEnd: () => setPlaying(false),
      })
    } catch (error) {
      console.error(error)
      setPlaying(false)
    } finally {
      setAudioLoading(false)
    }
  }

  const move = (delta: number) => {
    if (playing) stop()
    goTo(step + delta)
  }

  const hearCurrent = () => {
    if (!timeline) return
    for (const note of playableNotes(timeline.steps[step], staves)) void player.playNote(note.midi)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') move(1)
      if (event.key === 'ArrowLeft') move(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const changeZoom = (delta: number) => {
    const next = Math.round(Math.max(0.6, Math.min(2, zoom + delta)) * 10) / 10
    setZoom(next)
    scoreRef.current?.setZoom(next)
  }

  const current = timeline?.steps[step]
  const currentNotes = current ? playableNotes(current, staves) : []
  const staffOptions = timeline ? Array.from({ length: timeline.staffCount }, (_, i) => i) : []

  return (
    <main className="practice">
      <header className="practice-header">
        <button className="big-button ghost" onClick={() => { stop(); onBack() }} aria-label="Volver a la biblioteca">
          ← Biblioteca
        </button>
        <h1>{piece.title}</h1>
        <div className="zoom">
          <button className="round-button" onClick={() => changeZoom(-0.2)} aria-label="Partitura más pequeña">−</button>
          <button className="round-button" onClick={() => changeZoom(0.2)} aria-label="Partitura más grande">+</button>
        </div>
      </header>

      <ScoreView ref={scoreRef} url={pieceUrl(piece)} onLoaded={t => { setTimeline(t); setStep(0) }} />

      <footer className="controls">
        <div className="now-playing" aria-live="polite">
          {current && (
            <>
              <span>Compás {current.measureIndex + 1}</span>
              <button className="note-chip" onClick={hearCurrent} disabled={currentNotes.length === 0}>
                {currentNotes.length > 0 ? `🔈 ${currentNotes.map(n => midiToSolfege(n.midi)).join(' · ')}` : 'Silencio'}
              </button>
            </>
          )}
        </div>

        <div className="transport">
          <button className="big-button" onClick={() => move(-Infinity)} disabled={!timeline} aria-label="Ir al principio">⏮</button>
          <button className="big-button" onClick={() => move(-1)} disabled={!timeline} aria-label="Nota anterior">◀</button>
          <button className={`big-button primary ${playing ? 'stop' : ''}`} onClick={listen} disabled={!timeline || audioLoading}>
            {audioLoading ? 'Cargando…' : playing ? '⏹ Parar' : '🔊 Escuchar'}
          </button>
          <button className="big-button" onClick={() => move(1)} disabled={!timeline} aria-label="Nota siguiente">▶</button>
        </div>

        <div className="settings">
          <label className="tempo">
            <span>Velocidad {tempo}%</span>
            <input
              type="range" min={40} max={120} step={5} value={tempo}
              onChange={e => { stop(); setTempo(Number(e.target.value)) }}
            />
          </label>
          {staffOptions.length > 1 && (
            <div className="hands" role="group" aria-label="Qué pentagrama practicar">
              <button className={`chip ${staff === null ? 'active' : ''}`} onClick={() => { stop(); setStaff(null) }}>
                Todo
              </button>
              {staffOptions.map(i => (
                <button key={i} className={`chip ${staff === i ? 'active' : ''}`} onClick={() => { stop(); setStaff(i) }}>
                  {staffLabel(instrument, i)}
                </button>
              ))}
            </div>
          )}
        </div>
      </footer>
    </main>
  )
}
