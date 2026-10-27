import { useEffect, useState } from 'react'
import { midiInput, MidiInput, type MidiStatus } from '../../core/input/midi'

function isEmbedded(): boolean {
  try {
    return window.self !== window.top
  } catch {
    // Reading window.top from a cross-origin frame throws: we are embedded.
    return true
  }
}

/** Lets the student connect and choose a MIDI keyboard. */
export function MidiPanel() {
  const [status, setStatus] = useState<MidiStatus>(
    MidiInput.isSupported() ? { state: 'idle' } : { state: 'unsupported' })

  useEffect(() => midiInput.onStatus(setStatus), [])

  switch (status.state) {
    case 'unsupported':
      return (
        <p className="notice warn">
          Este navegador no permite conectar teclados MIDI (pasa en iPhone y iPad).
          Usa Chrome o Edge en un ordenador o tablet Android, o toca con el teclado de la pantalla.
        </p>
      )
    case 'idle':
      return <button className="chip" onClick={() => midiInput.start()}>🎹 Conectar teclado MIDI</button>
    case 'denied':
      return isEmbedded() ? (
        <p className="notice warn">
          Esta página está abierta dentro de otra (por ejemplo, un enlace de vista previa) y el navegador
          no deja usar el MIDI aquí. Abre Notelisa en su propia dirección.
        </p>
      ) : (
        <p className="notice warn">
          El navegador ha bloqueado el teclado MIDI. Pulsa el icono que hay a la izquierda de la
          dirección de la página, permite «Dispositivos MIDI» y recarga la página.
        </p>
      )
    case 'ready':
      if (status.devices.length === 0) {
        return <p className="notice">Enchufa tu teclado MIDI por USB; aparecerá aquí solo.</p>
      }
      return (
        <label className="midi-select">
          <span className={`dot ${status.connected ? 'on' : ''}`} aria-hidden />
          <select id="midi-device" value={status.selected ?? ''} onChange={e => midiInput.select(e.target.value || null)}>
            {status.devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      )
  }
}
