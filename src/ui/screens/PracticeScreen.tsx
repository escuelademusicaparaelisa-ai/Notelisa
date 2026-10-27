import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Tone from 'tone'
import { metronome, type Click } from '../../core/audio/metronome'
import { ScorePlayer } from '../../core/audio/player'
import { noteBus } from '../../core/input/bus'
import { midiToSolfege } from '../../core/music/pitch'
import { summarize, type PracticeSummary } from '../../core/practice/summary'
import { TempoSession, type TempoEvent, type Timing } from '../../core/practice/tempoSession'
import { WaitSession, type WaitEvent } from '../../core/practice/waitSession'
import { beatsForSteps, beatsInMeasure } from '../../core/score/beats'
import { measureCount, playableNotes, wholeNotesToSeconds, type ScoreStep, type Timeline } from '../../core/score/timeline'
import { getInstrument, staffLabel } from '../../instruments'
import { pieceSource, type Piece } from '../../library/catalog'
import { microphoneInput } from '../../core/input/mic/microphone'
import { CalibrationWizard } from '../components/CalibrationWizard'
import { MicMeter, MicPanel } from '../components/MicPanel'
import { MidiPanel } from '../components/MidiPanel'
import { OnScreenKeyboard } from '../components/OnScreenKeyboard'
import { ScoreView, type ScoreViewHandle } from '../components/ScoreView'
import { SummaryCard } from '../components/SummaryCard'

interface Props {
  piece: Piece
  onBack(): void
}

type Mode = 'listen' | 'wait' | 'tempo'

type Feedback =
  | { kind: 'idle' }
  | { kind: 'wrong'; played: number; at: number }
  | { kind: 'good' }
  | { kind: 'timing'; timing: Timing; at: number }
  | { kind: 'finished' }

/** A running tempo-mode exercise. */
interface TempoRun {
  session: TempoSession
  /** performance.now() time at which the first step sounds. */
  origin: number
  beatSeconds: number
  countIn: number
}

const COLORS = { correct: '#1f9d55', retried: '#e08a00', wrong: '#e2574c' }

// Notes played this long before the first beat are ignored (the student is getting ready).
const IGNORE_BEFORE_START_SECONDS = 0.4

const player = new ScorePlayer()

function audioContext(): AudioContext {
  return Tone.getContext().rawContext as AudioContext
}

/** Converts an AudioContext time into the moment it is heard, on the performance.now() clock. */
function heardAt(contextTime: number): number {
  const context = audioContext()
  const outputDelay = (context.baseLatency || 0) + (context.outputLatency || 0)
  return performance.now() + (contextTime - context.currentTime + outputDelay) * 1000
}

/** One measure of count-in clicks ending right before `startAt`, plus metronome beats for the steps. */
function clicksFor(timeline: Timeline, steps: ScoreStep[], startAt: number, tempoFactor: number, withBeats: boolean): Click[] {
  const beatSeconds = wholeNotesToSeconds(0.25, timeline.bpm, tempoFactor)
  const countIn = beatsInMeasure(timeline, steps[0].measureIndex)
  const clicks: Click[] = []
  for (let k = 0; k < countIn; k++) clicks.push({ at: startAt - (countIn - k) * beatSeconds, accent: k === 0 })
  if (withBeats) {
    for (const beat of beatsForSteps(timeline, steps)) {
      clicks.push({ at: startAt + wholeNotesToSeconds(beat.time, timeline.bpm, tempoFactor), accent: beat.accent })
    }
  }
  return clicks
}

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
  const [metronomeOn, setMetronomeOn] = useState(false)
  const [session, setSession] = useState<WaitSession | null>(null)
  const [tempoRun, setTempoRun] = useState<TempoRun | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [summary, setSummary] = useState<PracticeSummary | null>(null)
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
    metronome.stop()
    setPlaying(false)
  }, [])

  const stopPractice = useCallback(() => {
    metronome.stop()
    setSession(null)
    setTempoRun(null)
    setCountdown(null)
    setExpected([])
  }, [])

  useEffect(() => () => {
    player.stop()
    metronome.stop()
  }, [])

  useEffect(() => microphoneInput.onStatus(status => {
    setMicOn(status.state === 'on')
    // The input changed: a running exercise would mix rules, so stop it.
    stopPractice()
  }), [stopPractice])

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
    setSummary(null)
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
    if (metronomeOn) {
      void Tone.start()
      const first = timeline.steps[s.currentStep].measureIndex
      metronome.startSteady(audioContext().currentTime + 0.1, wholeNotesToSeconds(0.25, timeline.bpm, tempo / 100), beatsInMeasure(timeline, first))
    }
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
        case 'finished':
          metronome.stop()
          setFeedback({ kind: 'finished' })
          setSummary(summarize(s.stats, false))
          setSession(null)
          break
      }
    }
    setExpected(s.finished ? [] : s.pendingNotes)
  }, [goTo])

  // Tempo mode --------------------------------------------------------------

  const startTempo = async () => {
    if (!timeline) return
    stopListening()
    stopPractice()
    setSummary(null)
    setFeedback({ kind: 'idle' })
    scoreRef.current?.clearColors()
    const tempoFactor = tempo / 100
    const s = new TempoSession(timeline, {
      staves,
      fromMeasure: fromMeasure - 1,
      toMeasure: toMeasure - 1,
      ignoreOctave,
      onlyHighest: micOn,
      tempoFactor,
    })
    if (s.firstStep === null) return
    goTo(s.firstStep)
    const firstNotes = playableNotes(s.steps[0], staves).map(n => n.midi)
    setExpected(micOn ? [Math.max(...firstNotes)] : firstNotes)
    await player.load()
    const beatSeconds = wholeNotesToSeconds(0.25, timeline.bpm, tempoFactor)
    const countIn = beatsInMeasure(timeline, s.steps[0].measureIndex)
    const startAt = audioContext().currentTime + 0.3 + countIn * beatSeconds
    const clicks = clicksFor(timeline, s.steps, startAt, tempoFactor, metronomeOn)
    metronome.start(i => clicks[i] ?? null)
    setCountdown(countIn)
    setTempoRun({ session: s, origin: heardAt(startAt), beatSeconds, countIn })
  }

  const handleTempoEvents = useCallback((s: TempoSession, events: TempoEvent[]) => {
    for (const event of events) {
      switch (event.type) {
        case 'step': {
          goTo(event.step)
          const notes = playableNotes(timeline!.steps[event.step], staves).map(n => n.midi)
          setExpected(micOn ? [Math.max(...notes)] : notes)
          break
        }
        case 'hit':
          scoreRef.current?.colorStep(event.step, [event.midi], event.timing === 'onTime' ? COLORS.correct : COLORS.retried)
          setFeedback({ kind: 'timing', timing: event.timing, at: performance.now() })
          break
        case 'wrong':
          setFeedback({ kind: 'wrong', played: event.midi, at: performance.now() })
          break
        case 'missed':
          scoreRef.current?.colorStep(event.step, [event.midi], COLORS.wrong)
          break
        case 'finished':
          metronome.stop()
          setTempoRun(null)
          setExpected([])
          setFeedback({ kind: 'finished' })
          setSummary(summarize(s.stats, true))
          break
      }
    }
  }, [goTo, timeline, staves, micOn])

  // The clock of tempo mode: moves the cursor and spots notes that were not played.
  useEffect(() => {
    if (!tempoRun) return
    const timer = window.setInterval(() => {
      const now = (performance.now() - tempoRun.origin) / 1000
      if (now < 0) {
        setCountdown(Math.min(tempoRun.countIn, Math.ceil(-now / tempoRun.beatSeconds)))
        return
      }
      setCountdown(null)
      handleTempoEvents(tempoRun.session, tempoRun.session.update(now))
    }, 25)
    return () => window.clearInterval(timer)
  }, [tempoRun, handleTempoEvents])

  // Every input (MIDI, on-screen keyboard) arrives here.
  useEffect(() => noteBus.subscribe(event => {
    if (event.type === 'noteon') {
      // An acoustic instrument heard by the microphone already makes its own sound.
      if (event.source !== 'microphone') void player.noteOn(event.midi, event.strength)
      setHeld(prev => new Set(prev).add(event.midi))
      if (session && !session.finished) handleWaitEvents(session, session.play(event.midi))
      if (tempoRun && !tempoRun.session.finished) {
        const at = (event.time - tempoRun.origin) / 1000
        if (at >= -IGNORE_BEFORE_START_SECONDS) handleTempoEvents(tempoRun.session, tempoRun.session.play(event.midi, at))
      }
    } else {
      player.noteOff(event.midi)
      setHeld(prev => {
        const next = new Set(prev)
        next.delete(event.midi)
        return next
      })
    }
  }), [session, handleWaitEvents, tempoRun, handleTempoEvents])

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
      const tempoFactor = tempo / 100
      let startAt: number | undefined
      if (metronomeOn) {
        await player.load()
        const steps = timeline.steps.slice(from, (lastOfRange ?? timeline.steps.length - 1) + 1)
        const countIn = beatsInMeasure(timeline, steps[0].measureIndex)
        startAt = audioContext().currentTime + 0.3 + countIn * wholeNotesToSeconds(0.25, timeline.bpm, tempoFactor)
        const clicks = clicksFor(timeline, steps, startAt, tempoFactor, true)
        metronome.start(i => clicks[i] ?? null)
      }
      await player.play(timeline, {
        fromStep: from,
        toStep: lastOfRange,
        tempoFactor,
        staves,
        startAt,
        onStep: goTo,
        onEnd: () => {
          metronome.stop()
          setPlaying(false)
        },
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

  /** From the summary: loop one difficult measure, step by step. */
  const practiceMeasure = (measure: number) => {
    setSummary(null)
    switchMode('wait')
    setFromMeasure(measure + 1)
    setToMeasure(measure + 1)
    setLoop(true)
  }

  const again = () => {
    setSummary(null)
    if (mode === 'tempo') void startTempo()
    else startPractice()
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
            🎹 Paso a paso
          </button>
          <button role="tab" aria-selected={mode === 'tempo'} className={mode === 'tempo' ? 'active' : ''} onClick={() => switchMode('tempo')}>
            🎵 Con tempo
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
          <div className="setting">
            <label className="tempo">
              <span className="setting-label">Velocidad {tempo}%{timeline ? ` (${Math.round(timeline.bpm * tempo / 100)} negras por minuto)` : ''}</span>
              <input id="tempo" type="range" min={40} max={120} step={5} value={tempo}
                onChange={e => changeSetting(setTempo)(Number(e.target.value))} />
            </label>
            <label className="toggle">
              <input id="metronome" type="checkbox" checked={metronomeOn} onChange={e => changeSetting(setMetronomeOn)(e.target.checked)} />
              Metrónomo
            </label>
          </div>
        </section>
      )}

      <footer className="controls">
        <div className="now-playing" aria-live="polite">
          {mode === 'wait' ? (
            <WaitFeedback session={session} feedback={feedback} expected={expected} names={names} />
          ) : mode === 'tempo' ? (
            <TempoFeedback running={!!tempoRun} countdown={countdown} feedback={feedback} expected={expected} names={names} />
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
          ) : mode === 'tempo' ? (
            <button className={`big-button primary ${tempoRun ? 'stop' : ''}`} onClick={tempoRun ? stopPractice : () => void startTempo()} disabled={!timeline}>
              {tempoRun ? '⏹ Parar' : feedback.kind === 'finished' ? '↻ Otra vez' : '▶ Empezar'}
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
          {micOn && mode !== 'listen' && <MicMeter />}
          <button className={`chip ${showSettings ? 'active' : ''}`} onClick={() => setShowSettings(v => !v)} aria-expanded={showSettings}>
            ⚙️ Ajustes
          </button>
        </div>
      </footer>

      {showKeyboard && mode !== 'listen' && (
        <OnScreenKeyboard hints={expected} pressed={held} />
      )}

      {calibrating && <CalibrationWizard onClose={() => setCalibrating(false)} />}
      {summary && (
        <SummaryCard summary={summary} onPracticeMeasure={practiceMeasure} onAgain={again} onClose={() => setSummary(null)} />
      )}
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
  if (feedback.kind === 'finished') return <span className="feedback finished">🎉 ¡Terminado!</span>
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

interface TempoFeedbackProps {
  running: boolean
  countdown: number | null
  feedback: Feedback
  expected: number[]
  names(midis: readonly number[]): string
}

const TIMING_TEXT: Record<Timing, string> = { onTime: '¡A tiempo! 👏', early: 'Un poco pronto', late: 'Un poco tarde' }

function TempoFeedback({ running, countdown, feedback, expected, names }: TempoFeedbackProps) {
  if (feedback.kind === 'finished') return <span className="feedback finished">🎉 ¡Terminado!</span>
  if (!running) return <span className="feedback">Pulsa <b>Empezar</b>: tras la cuenta atrás, la partitura avanza sola.</span>
  if (countdown !== null) return <span className="countdown" aria-label="Cuenta atrás">{countdown}…</span>
  if (feedback.kind === 'timing') {
    return <span className={`feedback ${feedback.timing === 'onTime' ? 'ontime' : 'offtime'}`} key={feedback.at}>{TIMING_TEXT[feedback.timing]}</span>
  }
  if (feedback.kind === 'wrong') {
    return <span className="feedback wrong" key={feedback.at}>Has tocado {names([feedback.played])}</span>
  }
  return <span className="feedback">{expected.length > 0 ? <>Toca: <b>{names(expected)}</b></> : '…'}</span>
}
