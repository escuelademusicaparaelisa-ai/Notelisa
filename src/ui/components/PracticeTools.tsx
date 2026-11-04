import { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import { metronome } from '../../core/audio/metronome'
import { microphoneInput, MicrophoneInput, type MicStatus } from '../../core/input/mic/microphone'
import { clampBpm, MAX_BPM, MIN_BPM, TapTempo, tempoName } from '../../core/tools/metronomeTempo'
import { clampA4, IN_TUNE_CENTS, MAX_A4_HZ, MIN_A4_HZ, TunerFollower, verdict, type TunerReading } from '../../core/tools/tuner'
import { isEmbedded } from './embedded'
import { Metronome, Mic, Minus, Play, Plus, Square, X, Gauge } from '../icons'

const BPM_KEY = 'notelisa.metronomeBpm'
const BEATS_KEY = 'notelisa.metronomeBeats'
const A4_KEY = 'notelisa.tunerA4'

function loadNumber(key: string, fallback: number): number {
  try {
    const value = Number(localStorage.getItem(key))
    return Number.isFinite(value) && value > 0 ? value : fallback
  } catch {
    return fallback
  }
}

function saveNumber(key: string, value: number): void {
  try { localStorage.setItem(key, String(value)) } catch { /* storage unavailable */ }
}

type Tool = 'metronome' | 'tuner'

/** The metronome and the tuner, opened from two buttons; both can be open at once. */
export function PracticeTools() {
  const [open, setOpen] = useState<Tool[]>([])
  const toggle = (tool: Tool) => setOpen(o => (o.includes(tool) ? o.filter(t => t !== tool) : [...o, tool]))
  const isOpen = (tool: Tool) => open.includes(tool)

  return (
    <section className="practice-tools" aria-label="Metrónomo y afinador">
      <div className="tool-buttons">
        <button type="button" className={`tool-button ${isOpen('metronome') ? 'active' : ''}`} aria-expanded={isOpen('metronome')}
          onClick={() => toggle('metronome')}>
          <span className="icon"><Metronome /></span>
          <span><strong>Metrónomo</strong><small>Marca el pulso a tu velocidad</small></span>
        </button>
        <button type="button" className={`tool-button ${isOpen('tuner') ? 'active' : ''}`} aria-expanded={isOpen('tuner')}
          onClick={() => toggle('tuner')}>
          <span className="icon"><Gauge /></span>
          <span><strong>Afinador</strong><small>Escucha tu nota con el micrófono</small></span>
        </button>
      </div>
      {open.length > 0 && (
        <div className="tool-panels">
          {isOpen('metronome') && <MetronomeTool onClose={() => toggle('metronome')} />}
          {isOpen('tuner') && <TunerTool onClose={() => toggle('tuner')} />}
        </div>
      )}
    </section>
  )
}

function ToolHeader({ title, icon, onClose }: { title: string; icon: React.ReactNode; onClose(): void }) {
  return (
    <div className="tool-header">
      <h2>{icon}{title}</h2>
      <button type="button" className="tool-close" aria-label={`Cerrar ${title.toLowerCase()}`} onClick={onClose}><X /></button>
    </div>
  )
}

const BEAT_CHOICES = [
  { value: 1, label: 'Sin acento' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 6, label: '6' },
]

export function MetronomeTool({ onClose }: { onClose(): void }) {
  const [bpm, setBpmState] = useState(() => clampBpm(loadNumber(BPM_KEY, 80)))
  const [beats, setBeats] = useState(() => {
    const saved = loadNumber(BEATS_KEY, 4)
    return BEAT_CHOICES.some(c => c.value === saved) ? saved : 4
  })
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState<{ index: number; at: number } | null>(null)
  const bpmRef = useRef(bpm)
  const tapper = useRef(new TapTempo())

  const setBpm = (value: number) => {
    const next = clampBpm(value)
    bpmRef.current = next
    setBpmState(next)
    saveNumber(BPM_KEY, next)
  }

  // Each click follows the previous one at the current speed, so changing the
  // speed while it plays takes effect on the next beat without a jump.
  const start = async (beats: number) => {
    await Tone.start()
    const context = Tone.getContext().rawContext as AudioContext
    let at = context.currentTime + 0.1
    let clicked = 0
    let index = -1
    metronome.start(i => {
      if (i > 0) at += 60 / bpmRef.current
      clicked = i
      return { at, accent: beats > 1 && clicked % beats === 0 }
    })
    const unsubscribe = metronome.onBeat(beat => {
      if (!beat) {
        unsubscribe()
        setCurrent(null)
        return
      }
      index = (index + 1) % beats
      setCurrent({ index, at: performance.now() })
    })
    setPlaying(true)
  }

  const stop = () => {
    metronome.stop()
    setPlaying(false)
  }

  // A new number of beats restarts the count from the first beat.
  const chooseBeats = (value: number) => {
    setBeats(value)
    saveNumber(BEATS_KEY, value)
    if (playing) void start(value)
  }

  useEffect(() => () => metronome.stop(), [])

  const tap = () => {
    const tapped = tapper.current.tap(performance.now())
    if (tapped) setBpm(tapped)
  }

  return (
    <div className="tool-card metronome-tool">
      <ToolHeader title="Metrónomo" icon={<Metronome />} onClose={onClose} />
      <div className="beat-dots" aria-hidden="true">
        {Array.from({ length: beats }, (_, i) => (
          <span key={i === current?.index ? `${i}-${current.at}` : i}
            className={`beat-dot ${i === current?.index ? 'on' : ''} ${beats > 1 && i === 0 ? 'first' : ''}`} />
        ))}
      </div>
      <div className="bpm-row">
        <button type="button" className="round-button" aria-label="Más lento" onClick={() => setBpm(bpm - 1)} disabled={bpm <= MIN_BPM}><Minus /></button>
        <div className="bpm-display">
          <span className="bpm-value">{bpm}</span>
          <span className="bpm-unit">pulsos por minuto · {tempoName(bpm)}</span>
        </div>
        <button type="button" className="round-button" aria-label="Más rápido" onClick={() => setBpm(bpm + 1)} disabled={bpm >= MAX_BPM}><Plus /></button>
      </div>
      <input className="bpm-slider" type="range" min={MIN_BPM} max={MAX_BPM} value={bpm} aria-label="Velocidad"
        onChange={e => setBpm(Number(e.target.value))} />
      <fieldset className="tool-option">
        <legend>Pulsos por compás</legend>
        <div className="exercise-choices">
          {BEAT_CHOICES.map(choice => (
            <button key={choice.value} type="button" className={`chip ${choice.value === beats ? 'active' : ''}`}
              aria-pressed={choice.value === beats} onClick={() => chooseBeats(choice.value)}>
              {choice.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="tool-actions">
        <button type="button" className={`big-button primary ${playing ? 'stop' : ''}`} onClick={playing ? stop : () => start(beats)}>
          {playing ? <><Square /> Parar</> : <><Play /> Empezar</>}
        </button>
        <button type="button" className="big-button ghost" onClick={tap}>Marcar golpes</button>
      </div>
      <p className="exercise-hint">Con «Marcar golpes» toca el botón al ritmo que quieras y el metrónomo copiará la velocidad.</p>
    </div>
  )
}

export function TunerTool({ onClose }: { onClose(): void }) {
  const [status, setStatus] = useState<MicStatus>(
    MicrophoneInput.isSupported() ? { state: 'off' } : { state: 'unsupported' })
  const [a4, setA4State] = useState(() => clampA4(loadNumber(A4_KEY, 440)))
  const [reading, setReading] = useState<TunerReading | null>(null)
  const [listening, setListening] = useState(false)
  const a4Ref = useRef(a4)
  const startedHere = useRef(false)

  const setA4 = (value: number) => {
    const next = clampA4(value)
    a4Ref.current = next
    setA4State(next)
    saveNumber(A4_KEY, next)
  }

  useEffect(() => microphoneInput.onStatus(setStatus), [])

  // While the tuner listens, the microphone only feeds the tuner, not the practice notes.
  useEffect(() => {
    if (status.state !== 'on' || !listening) return
    const detecting = microphoneInput.detecting
    microphoneInput.detecting = false
    const follower = new TunerFollower(microphoneInput.calibration.threshold)
    let lastHeard = 0
    const unsubscribe = microphoneInput.onFrame(frame => {
      const next = follower.process(frame, a4Ref.current)
      if (next) {
        lastHeard = frame.time
        setReading(next)
      } else if (frame.time - lastHeard > 1200) {
        // Keep the last note on screen for a moment after the sound stops.
        setReading(null)
      }
    })
    return () => {
      unsubscribe()
      microphoneInput.detecting = detecting
    }
  }, [status.state, listening])

  useEffect(() => () => {
    if (startedHere.current) microphoneInput.stop()
  }, [])

  const start = async () => {
    setListening(true)
    if (microphoneInput.isOn) return
    startedHere.current = true
    await microphoneInput.start()
  }

  const stop = () => {
    setListening(false)
    setReading(null)
    if (startedHere.current) {
      startedHere.current = false
      microphoneInput.stop()
    }
  }

  const on = status.state === 'on' && listening
  const tune = reading ? verdict(reading.cents) : null
  const message = !reading ? 'Toca una nota larga…'
    : tune === 'in-tune' ? '¡Afinado!'
    : tune === 'flat' ? 'Un poco bajo' : 'Un poco alto'

  return (
    <div className="tool-card tuner-tool">
      <ToolHeader title="Afinador" icon={<Gauge />} onClose={onClose} />
      {status.state === 'unsupported' && <p className="notice warn">Este navegador no permite usar el micrófono.</p>}
      {status.state === 'denied' && (
        <p className="notice warn">
          {isEmbedded()
            ? 'Esta página está abierta dentro de otra y el navegador no deja usar el micrófono aquí. Abre Notelisa en su propia dirección.'
            : 'El navegador ha bloqueado el micrófono. Pulsa el icono a la izquierda de la dirección de la página, permite el micrófono y recarga.'}
        </p>
      )}
      <div className={`tuner-display ${on ? '' : 'idle'} ${tune ?? ''}`}>
        <div className="tuner-note" aria-live="polite">
          {reading ? <>{reading.name}<sub>{reading.octave}</sub></> : '–'}
        </div>
        <TunerGauge cents={reading?.cents ?? null} />
        <div className="tuner-message">
          {on ? message : 'Pulsa «Escuchar» y toca una nota'}
          {reading && <span className="tuner-detail">{reading.cents > 0 ? '+' : ''}{reading.cents} cents · {reading.frequency.toFixed(1)} Hz</span>}
        </div>
      </div>
      <div className="tool-actions">
        {on
          ? <button type="button" className="big-button primary stop" onClick={stop}><Square /> Parar</button>
          : <button type="button" className="big-button primary" onClick={start}
            disabled={status.state === 'unsupported' || status.state === 'starting'}>
            <Mic /> {status.state === 'starting' ? 'Abriendo…' : 'Escuchar'}
          </button>}
        <div className="a4-setting">
          <span className="setting-label">La =</span>
          <button type="button" className="round-button small" aria-label="Bajar el La" onClick={() => setA4(a4 - 1)} disabled={a4 <= MIN_A4_HZ}><Minus /></button>
          <span className="a4-value">{a4} Hz</span>
          <button type="button" className="round-button small" aria-label="Subir el La" onClick={() => setA4(a4 + 1)} disabled={a4 >= MAX_A4_HZ}><Plus /></button>
        </div>
      </div>
      <p className="exercise-hint">
        En la flauta: si sale <b>bajo</b>, mete un poco la cabeza de la flauta; si sale <b>alto</b>, sácala un poco.
        Muchas orquestas afinan con La = 442 Hz.
      </p>
    </div>
  )
}

/** A scale from -50 to +50 cents with a needle; the green zone is in tune. */
function TunerGauge({ cents }: { cents: number | null }) {
  const position = cents === null ? 50 : 50 + Math.max(-50, Math.min(50, cents))
  const zone = IN_TUNE_CENTS
  return (
    <div className="tuner-gauge" role="meter" aria-label="Desafinación en cents" aria-valuemin={-50} aria-valuemax={50}
      aria-valuenow={cents ?? 0}>
      <div className="gauge-zone" style={{ left: `${50 - zone}%`, width: `${zone * 2}%` }} />
      {[-50, -25, 0, 25, 50].map(mark => (
        <span key={mark} className={`gauge-tick ${mark === 0 ? 'center' : ''}`} style={{ left: `${50 + mark}%` }} />
      ))}
      {cents !== null && <span className="gauge-needle" style={{ left: `${position}%` }} />}
      <span className="gauge-label left">♭</span>
      <span className="gauge-label right">♯</span>
    </div>
  )
}
