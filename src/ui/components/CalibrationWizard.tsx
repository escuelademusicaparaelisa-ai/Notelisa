import { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import type { AudioFrame } from '../../core/input/mic/analysis'
import {
  checkLoudness, latencyFromClicks, thresholdFromNoise, tuningFromA, type MicCalibration,
} from '../../core/input/mic/calibration'
import { microphoneInput } from '../../core/input/mic/microphone'
import { DEFAULT_A4_HZ } from '../../core/music/pitch'
import { MicMeter } from './MicPanel'

interface Props {
  onClose(): void
}

type Step = 'intro' | 'silence' | 'loud' | 'tuning' | 'latency' | 'done'

const SILENCE_MS = 3000
const LISTEN_MS = 5000
const CLICKS = 5

/** Records frames from the microphone for a while. */
function record(ms: number, stopWhen?: (frames: AudioFrame[]) => boolean): Promise<AudioFrame[]> {
  return new Promise(resolve => {
    const frames: AudioFrame[] = []
    const finish = () => {
      unsubscribe()
      window.clearTimeout(timeout)
      resolve(frames)
    }
    const unsubscribe = microphoneInput.onFrame(frame => {
      frames.push(frame)
      if (stopWhen?.(frames)) finish()
    })
    const timeout = window.setTimeout(finish, ms)
  })
}

/** Plays short clicks through the speakers; returns when each one left the speakers (performance.now clock). */
function playClicks(count: number, gapSeconds: number): number[] {
  const context = Tone.getContext().rawContext as AudioContext
  const outputDelay = ((context.baseLatency || 0) + (context.outputLatency || 0)) * 1000
  const times: number[] = []
  const start = context.currentTime + 0.3
  for (let i = 0; i < count; i++) {
    const at = start + i * gapSeconds
    const osc = context.createOscillator()
    const gain = context.createGain()
    osc.type = 'square'
    osc.frequency.value = 1000
    gain.gain.setValueAtTime(0.6, at)
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.04)
    osc.connect(gain).connect(context.destination)
    osc.start(at)
    osc.stop(at + 0.05)
    times.push(performance.now() + (at - context.currentTime) * 1000 + outputDelay)
  }
  return times
}

/** Step-by-step microphone calibration: noise, loudness, tuning and delay. */
export function CalibrationWizard({ onClose }: Props) {
  const [step, setStep] = useState<Step>('intro')
  const [message, setMessage] = useState<string | null>(null)
  const result = useRef<MicCalibration>({ ...microphoneInput.calibration })
  const [saved, setSaved] = useState<MicCalibration | null>(null)

  // Notes must not reach the practice screen while calibrating.
  useEffect(() => {
    microphoneInput.detecting = false
    return () => { microphoneInput.detecting = true }
  }, [])

  const runSilence = async () => {
    setStep('silence')
    setMessage(null)
    const frames = await record(SILENCE_MS)
    result.current.threshold = thresholdFromNoise(frames)
    setStep('loud')
  }

  const runLoud = async () => {
    setMessage('Escuchando…')
    const threshold = result.current.threshold
    const frames = await record(LISTEN_MS, fs => fs.some(f => f.rms >= threshold * 8))
    const check = checkLoudness(frames, threshold)
    if (check.ok) {
      setMessage(null)
      setStep('tuning')
    } else {
      setMessage(check.reason === 'silent'
        ? 'No te he oído. Acerca el móvil o la tablet al piano y prueba otra vez.'
        : 'Se oye muy flojo comparado con el ruido de la sala. Acerca el dispositivo al piano o busca un sitio más silencioso.')
    }
  }

  const runTuning = async () => {
    setMessage('Escuchando…')
    const threshold = result.current.threshold
    const frames = await record(LISTEN_MS, fs => fs.filter(f => f.rms >= threshold && f.clarity >= 0.9).length > 25)
    const tuning = tuningFromA(frames, threshold)
    if (tuning.ok) {
      result.current.a4Hz = Math.round(tuning.a4Hz * 10) / 10
      setMessage(null)
      setStep('latency')
    } else {
      setMessage(tuning.reason === 'notAnA'
        ? 'Eso no parecía un La. Toca la tecla La (la blanca entre Sol y Si) y déjala sonar.'
        : 'No he oído una nota clara. Toca el La un poco más fuerte y déjalo sonar.')
    }
  }

  const skipTuning = () => {
    result.current.a4Hz = DEFAULT_A4_HZ
    setMessage(null)
    setStep('latency')
  }

  const runLatency = async () => {
    setMessage('Escuchando los clics…')
    const clicks = playClicks(CLICKS, 0.5)
    const frames = await record(CLICKS * 500 + 800)
    const latency = latencyFromClicks(clicks, frames, result.current.threshold)
    if (latency === null) {
      setMessage('No he oído los clics. Sube el volumen del dispositivo y prueba otra vez, o sáltate este paso.')
      return
    }
    result.current.latencyMs = Math.max(0, latency)
    finish()
  }

  const finish = () => {
    microphoneInput.applyCalibration(result.current)
    setSaved({ ...result.current })
    setMessage(null)
    setStep('done')
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="calibration-title">
      <div className="modal">
        <h2 id="calibration-title">🎤 Calibrar el micrófono</h2>
        <MicMeter />
        {step === 'intro' && (
          <>
            <p>Vamos a preparar el micrófono para tu piano. Son cuatro pasos cortos.</p>
            <p>Coloca el móvil o la tablet en el atril, cerca del piano.</p>
            <button className="big-button primary" onClick={runSilence}>Empezar</button>
          </>
        )}
        {step === 'silence' && (
          <p className="calibration-step">🤫 <b>Paso 1:</b> silencio, por favor… estoy escuchando el ruido de la sala.</p>
        )}
        {step === 'loud' && (
          <>
            <p className="calibration-step">🎹 <b>Paso 2:</b> toca una nota <b>fuerte</b> en el centro del piano.</p>
            <button className="big-button primary" onClick={runLoud} disabled={message === 'Escuchando…'}>Escuchar</button>
          </>
        )}
        {step === 'tuning' && (
          <>
            <p className="calibration-step">🎵 <b>Paso 3:</b> toca un <b>La</b> (el del centro) y déjalo sonar. Así sé si tu piano está afinado.</p>
            <div className="modal-actions">
              <button className="big-button primary" onClick={runTuning} disabled={message === 'Escuchando…'}>Escuchar</button>
              <button className="chip" onClick={skipTuning}>Saltar (La 440)</button>
            </div>
          </>
        )}
        {step === 'latency' && (
          <>
            <p className="calibration-step">⏱️ <b>Paso 4:</b> sube el volumen. Sonarán {CLICKS} clics para medir el retraso del micrófono.</p>
            <div className="modal-actions">
              <button className="big-button primary" onClick={runLatency} disabled={message === 'Escuchando los clics…'}>Medir</button>
              <button className="chip" onClick={finish}>Saltar</button>
            </div>
          </>
        )}
        {step === 'done' && saved && (
          <>
            <p>✅ ¡Listo! Afinación: La = {saved.a4Hz} Hz · retraso: {saved.latencyMs} ms.</p>
            <button className="big-button primary" onClick={onClose}>Practicar</button>
          </>
        )}
        {message && <p className="notice">{message}</p>}
        {step !== 'done' && <button className="chip modal-close" onClick={onClose}>Cancelar</button>}
      </div>
    </div>
  )
}
