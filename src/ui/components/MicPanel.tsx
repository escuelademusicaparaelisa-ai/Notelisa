import { useEffect, useState } from 'react'
import { microphoneInput, MicrophoneInput, type MicStatus } from '../../core/input/mic/microphone'
import { frequencyToMidi, midiToSolfege } from '../../core/music/pitch'
import { isEmbedded } from './embedded'
import { Mic, TriangleAlert } from '../icons'

interface Props {
  onCalibrate(): void
}

/** Turns the microphone on/off and shows what it hears. */
export function MicPanel({ onCalibrate }: Props) {
  const [status, setStatus] = useState<MicStatus>(
    MicrophoneInput.isSupported() ? { state: 'off' } : { state: 'unsupported' })

  useEffect(() => microphoneInput.onStatus(setStatus), [])

  const start = async () => {
    await microphoneInput.start()
    if (microphoneInput.isOn && !localStorageHasCalibration()) onCalibrate()
  }

  switch (status.state) {
    case 'unsupported':
      return <p className="notice warn">Este navegador no permite usar el micrófono.</p>
    case 'denied':
      return (
        <p className="notice warn">
          {isEmbedded()
            ? 'Esta página está abierta dentro de otra y el navegador no deja usar el micrófono aquí. Abre Notelisa en su propia dirección.'
            : 'El navegador ha bloqueado el micrófono. Pulsa el icono a la izquierda de la dirección de la página, permite el micrófono y recarga.'}
        </p>
      )
    case 'off':
    case 'starting':
      return (
        <button className="chip" onClick={start} disabled={status.state === 'starting'}>
          <Mic /> {status.state === 'starting' ? 'Abriendo micrófono…' : 'Usar micrófono'}
        </button>
      )
    case 'on':
      return (
        <div className="mic-on">
          <MicMeter />
          <button className="chip" onClick={onCalibrate}>{status.calibrated ? 'Calibrar de nuevo' : <><TriangleAlert /> Calibrar</>}</button>
          <button className="chip" onClick={() => microphoneInput.stop()}>Apagar</button>
        </div>
      )
  }
}

function localStorageHasCalibration(): boolean {
  try {
    return !!localStorage.getItem('notelisa.micCalibration')
  } catch {
    return false
  }
}

/** Live level bar and the note the microphone hears. */
export function MicMeter() {
  const [level, setLevel] = useState(0)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => microphoneInput.onFrame(frame => {
    const { threshold, a4Hz } = microphoneInput.calibration
    // Logarithmic scale so quiet and loud sounds both show up.
    setLevel(Math.max(0, Math.min(1, 1 + Math.log10(Math.max(frame.rms, 1e-4)) / 3)))
    const audible = frame.rms >= threshold && frame.clarity >= 0.85 && frame.frequency > 0
    setNote(audible ? midiToSolfege(Math.round(frequencyToMidi(frame.frequency, a4Hz))) : null)
  }), [])

  const thresholdLevel = Math.max(0, 1 + Math.log10(microphoneInput.calibration.threshold) / 3)
  return (
    <div className="mic-meter" aria-label="Nivel del micrófono">
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${level * 100}%` }} />
        <div className="meter-mark" style={{ left: `${thresholdLevel * 100}%` }} />
      </div>
      <span className="meter-note">{note ?? '…'}</span>
    </div>
  )
}
