import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScorePlayer } from '../../core/audio/player'
import { noteBus } from '../../core/input/bus'
import { midiToSolfege } from '../../core/music/pitch'
import { WaitSession, type WaitEvent } from '../../core/practice/waitSession'
import { measureCount, playableNotes, type Timeline } from '../../core/score/timeline'
import { getInstrument, staffLabel } from '../../instruments'
import { pieceSource, type Piece } from '../../library/catalog'
import { microphoneInput } from '../../core/input/mic/microphone'
import { CalibrationWizard } from '../components/CalibrationWizard'
import { MicMeter, MicPanel } from '../components/MicPanel'
import { MidiPanel } from '../components/MidiPanel'
import { OnScreenKeyboard } from '../components/OnScreenKeyboard'
import { ScoreView, type ScoreViewHandle } from '../components/ScoreView'

interface Props {
  piece: Piece
  onBack(): void
}

type Mode = 'listen' | 'wait'

type Feedback =
  | { kind: 'idle' }
  | { kind: 'wrong'; played: number; at: number }
  | { kind: 'good' }
  | { kind: 'finished'; correct: number; wrong: number }

const COLORS = { correct: '#1f9d55', retried: '#e08a00', wrong: '#e2574c' }

const player = new ScorePlayer()

export function PracticeScreen({ piece, onBack }: Props) {
  const scoreRef = useRef<ScoreViewHandle>(null)
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [step, setStep] = useState(0)
  const [mode, setMode] = useState<Mode>('wait')
  const [playing, setPlaying] = useState(false)
  const [audioLoading, setAudioLoading] = useState(false)
  const [tempo, setTempo] = useState(100)
  const [zoom, setZoom] = useState(1)
  // null = all staves (both hands).
  const [staff, setStaff] = useState<number | null>(null)
  const [fromMeasure, setFromMeasure] = useState(1)
  const [toMeasure, setToMeasure] = useState(1)
  const [loop, setLoop] = useState(false)
  const [ignoreOctave, setIgnoreOctave] = useState(false)
  const [showKeyboard, setShowKeyboard] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [session, setSession] = useState<WaitSession | null>(null)
  const [expected, setExpected] = useState<number[]>([])
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' })
  const [held, setHeld] = useState<Set<number>>(new Set())
  const [micOn, setMicOn] = useState(microphoneInput.isOn)
  const [calibrating, setCalibrating] = useState(false)
  const instrument = getInstrument(piece.instrument)
  const staves = useMemo(() => (staff === null ? undefined : [staff]), [staff])
  const measures = timeline ? measureCount(timeline) : 1

  const goTo = useCallback((target: number) => {
    if (!timeline) return
    const clamped = Math.max(0, Math.min(target, timeline.steps.length - 1))
    scoreRef.current?.goTo(clamped)
    setStep(clamped)
  }, [timeline])

  const stopListening = useCallback(() => {
    player.stop()
    setPlaying(false)
  }, [])

  const stopPractice = useCallback(() => {
    setSession(null)
    setExpected([])
  }, [])

  useEffect(() => () => { player.stop() }, [])

  useEffect(() => microphoneInput.onStatus(status => {
    setMicOn(status.state === 'on')
    // The input changed: a running exercise would mix rules, so stop it.
    setSession(null)
    setExpected([])
  }), [])

  const onLoaded = (t: Timeline) => {
    setTimeline(t)
    setStep(0)
    setFromMeasure(1)
    setToMeasure(measureCount(t))
  }

  // Wait mode ---------------------------------------------------------------

  const startPractice = () => {
    if (!timeline) return
    stopListening()
    scoreRef.current?.clearColors()
    const s = new WaitSession(timeline, {
      staves,
      fromMeasure: fromMeasure - 1,
      toMeasure: toMeasure - 1,
      loop,
      ignoreOctave,
      onlyHighest: micOn,
    })
    setFeedback({ kind: 'idle' })
    if (s.currentStep === null) {
      setSession(null)
      return
    }
    goTo(s.currentStep)
    setExpected(s.pendingNotes)
    setSession(s)
    void player.load()
  }

  const handleWaitEvents = useCallback((s: WaitSession, events: WaitEvent[]) => {
    for (const event of events) {
      switch (event.type) {
        case 'correct':
          scoreRef.current?.colorCurrent([event.midi], COLORS.correct)
          setFeedback({ kind: 'good' })
          break
        case 'wrong':
          scoreRef.current?.colorCurrent(s.pendingNotes, COLORS.wrong)
          setFeedback({ kind: 'wrong', played: event.midi, at: performance.now() })
          break
        case 'stepDone':
          if (!event.clean) scoreRef.current?.colorCurrent(event.notes, COLORS.retried)
          break
        case 'loop':
          scoreRef.current?.clearColors()
          goTo(event.step)
          break
        case 'advance':
          goTo(event.step)
          break
        case 'finished': {
          let correct = 0
          let wrong = 0
          for (const m of s.stats.values()) {
            correct += m.correct
            wrong += m.wrong
          }
          setFeedback({ kind: 'finished', correct, wrong })
          setSession(null)
          break
        }
      }
    }
    setExpected(s.finished ? [] : s.pendingNotes)
  }, [goTo])

  // Every input (MIDI, on-screen keyboard) arrives here.
  useEffect(() => noteBus.subscribe(event => {
    if (event.type === 'noteon') {
      // An acoustic instrument heard by the microphone already makes its own sound.
      if (event.source !== 'microphone') void player.noteOn(event.midi, event.strength)
      setHeld(prev => new Set(prev).add(event.midi))
      if (session && !session.finished) handleWaitEvents(session, session.play(event.midi))
    } else {
      player.noteOff(event.midi)
      setHeld(prev => {
        const next = new Set(prev)
        next.delete(event.midi)
        return next
      })
    }
  }), [session, handleWaitEvents])

  // Listen mode -------------------------------------------------------------

  const listen = async () => {
    if (!timeline) return
    if (playing) return stopListening()
    stopPractice()
    setAudioLoading(true)
    try {
      setPlaying(true)
      const firstOfRange = timeline.steps.find(s => s.measureIndex >= fromMeasure - 1)?.index ?? 0
      const lastOfRange = [...timeline.steps].reverse().find(s => s.measureIndex <= toMeasure - 1)?.index
      const from = step >= (lastOfRange ?? timeline.steps.length - 1) || step < firstOfRange ? firstOfRange : step
      await player.play(timeline, {
        fromStep: from,
        toStep: lastOfRange,
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
    if (playing) stopListening()
    goTo(step + delta)
  }

  useEffect(() => {
    if (mode !== 'listen') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') move(1)
      if (event.key === 'ArrowLeft') move(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Settings changes restart whatever is running so the new values apply.
  const changeSetting = <T,>(setter: (value: T) => void) => (value: T) => {
    stopListening()
    stopPractice()
    setFeedback({ kind: 'idle' })
    setter(value)
  }

  const switchMode = (next: Mode) => {
    stopListening()
    stopPractice()
    scoreRef.current?.clearColors()
    setFeedback({ kind: 'idle' })
    setMode(next)
  }

  const changeZoom = (delta: number) => {
    const next = Math.round(Math.max(0.6, Math.min(2, zoom + delta)) * 10) / 10
    setZoom(next)
    scoreRef.current?.setZoom(next)
  }

  const current = timeline?.steps[step]
  const currentNotes = current ? playableNotes(current, staves) : []
  const staffOptions = timeline ? Array.from({ length: timeline.staffCount }, (_, i) => i) : []
  const names = (midis: readonly number[]) => midis.map(m => midiToSolfege(m, !ignoreOctave)).join(' + ')

  return (
    <main className="practice">
      <header className="practice-header">
        <button className="big-button ghost" onClick={() => { stopListening(); onBack() }} aria-label="Volver a la biblioteca">
          ← Biblioteca
        </button>
        <h1>{piece.title}</h1>
        <div className="segmented" role="tablist" aria-label="Modo">
          <button role="tab" aria-selected={mode === 'wait'} className={mode === 'wait' ? 'active' : ''} onClick={() => switchMode('wait')}>
            🎹 Practicar
          </button>
          <button role="tab" aria-selected={mode === 'listen'} className={mode === 'listen' ? 'active' : ''} onClick={() => switchMode('listen')}>
            🔊 Escuchar
          </button>
        </div>
        <div className="zoom">
          <button className="round-button" onClick={() => changeZoom(-0.2)} aria-label="Partitura más pequeña">−</button>
          <button className="round-button" onClick={() => changeZoom(0.2)} aria-label="Partitura más grande">+</button>
        </div>
      </header>

      <ScoreView ref={scoreRef} source={pieceSource(piece)} onLoaded={onLoaded} />

      {showSettings && (
        <section className="settings-panel" aria-label="Ajustes">
          <div className="setting">
            <span className="setting-label">Teclado MIDI</span>
            <MidiPanel />
          </div>
          <div className="setting">
            <span className="setting-label">Micrófono</span>
            <MicPanel onCalibrate={() => { stopPractice(); setCalibrating(true) }} />
          </div>
          {staffOptions.length > 1 && (
            <div className="setting">
              <span className="setting-label">Qué tocar</span>
              <div className="hands" role="group">
                <button className={`chip ${staff === null ? 'active' : ''}`} onClick={() => changeSetting(setStaff)(null)}>Todo</button>
                {staffOptions.map(i => (
                  <button key={i} className={`chip ${staff === i ? 'active' : ''}`} onClick={() => changeSetting(setStaff)(i)}>
                    {staffLabel(instrument, i)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="setting">
            <span className="setting-label">Compases</span>
            <label className="measure-input">
              del
              <input id="from-measure" type="number" min={1} max={toMeasure} value={fromMeasure}
                onChange={e => changeSetting(setFromMeasure)(Math.max(1, Math.min(Number(e.target.value) || 1, toMeasure)))} />
            </label>
            <label className="measure-input">
              al
              <input id="to-measure" type="number" min={fromMeasure} max={measures} value={toMeasure}
                onChange={e => changeSetting(setToMeasure)(Math.max(fromMeasure, Math.min(Number(e.target.value) || 1, measures)))} />
            </label>
            <label className="toggle">
              <input id="loop" type="checkbox" checked={loop} onChange={e => changeSetting(setLoop)(e.target.checked)} />
              Repetir en bucle
            </label>
          </div>
          <div className="setting">
            <span className="setting-label">Ayudas</span>
            <label className="toggle">
              <input id="ignore-octave" type="checkbox" checked={ignoreOctave} onChange={e => changeSetting(setIgnoreOctave)(e.target.checked)} />
              Vale cualquier octava
            </label>
            <label className="toggle">
              <input id="show-keyboard" type="checkbox" checked={showKeyboard} onChange={e => setShowKeyboard(e.target.checked)} />
              Teclado en pantalla
            </label>
          </div>
          {mode === 'listen' && (
            <div className="setting">
              <label className="tempo">
                <span className="setting-label">Velocidad {tempo}%</span>
                <input id="tempo" type="range" min={40} max={120} step={5} value={tempo}
                  onChange={e => changeSetting(setTempo)(Number(e.target.value))} />
              </label>
            </div>
          )}
        </section>
      )}

      <footer className="controls">
        <div className="now-playing" aria-live="polite">
          {mode === 'wait' ? (
            <WaitFeedback session={session} feedback={feedback} expected={expected} names={names} />
          ) : current && (
            <>
              <span>Compás {current.measureIndex + 1}</span>
              <button className="note-chip" onClick={() => currentNotes.forEach(n => void player.playNote(n.midi))} disabled={currentNotes.length === 0}>
                {currentNotes.length > 0 ? `🔈 ${names(currentNotes.map(n => n.midi))}` : 'Silencio'}
              </button>
            </>
          )}
        </div>

        <div className="transport">
          {mode === 'wait' ? (
            <button className={`big-button primary ${session ? 'stop' : ''}`} onClick={session ? stopPractice : startPractice} disabled={!timeline}>
              {session ? '⏹ Parar' : feedback.kind === 'finished' ? '↻ Otra vez' : '▶ Empezar'}
            </button>
          ) : (
            <>
              <button className="big-button" onClick={() => move(-Infinity)} disabled={!timeline} aria-label="Ir al principio">⏮</button>
              <button className="big-button" onClick={() => move(-1)} disabled={!timeline} aria-label="Nota anterior">◀</button>
              <button className={`big-button primary ${playing ? 'stop' : ''}`} onClick={listen} disabled={!timeline || audioLoading}>
                {audioLoading ? 'Cargando…' : playing ? '⏹ Parar' : '🔊 Escuchar'}
              </button>
              <button className="big-button" onClick={() => move(1)} disabled={!timeline} aria-label="Nota siguiente">▶</button>
            </>
          )}
        </div>

        <div className="footer-actions">
          {micOn && mode === 'wait' && <MicMeter />}
          <button className={`chip ${showSettings ? 'active' : ''}`} onClick={() => setShowSettings(v => !v)} aria-expanded={showSettings}>
            ⚙️ Ajustes
          </button>
        </div>
      </footer>

      {showKeyboard && mode === 'wait' && (
        <OnScreenKeyboard hints={expected} pressed={held} />
      )}

      {calibrating && <CalibrationWizard onClose={() => setCalibrating(false)} />}
    </main>
  )
}

interface WaitFeedbackProps {
  session: WaitSession | null
  feedback: Feedback
  expected: number[]
  names(midis: readonly number[]): string
}

function WaitFeedback({ session, feedback, expected, names }: WaitFeedbackProps) {
  if (feedback.kind === 'finished') {
    const total = feedback.correct + feedback.wrong
    const percent = total ? Math.round((feedback.correct / total) * 100) : 100
    return (
      <span className="feedback finished">
        🎉 ¡Terminado! {percent}% de aciertos ({feedback.wrong} {feedback.wrong === 1 ? 'fallo' : 'fallos'})
      </span>
    )
  }
  if (!session) return <span className="feedback">Pulsa <b>Empezar</b> y toca las notas de la partitura.</span>
  if (feedback.kind === 'wrong') {
    return (
      <span className="feedback wrong" key={feedback.at}>
        Has tocado {names([feedback.played])}. Busca <b>{names(expected)}</b>
      </span>
    )
  }
  return <span className="feedback">Toca: <b>{names(expected)}</b></span>
}
