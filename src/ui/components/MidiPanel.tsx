import { useEffect, useState } from 'react'
import { midiInput, MidiInput, type MidiStatus } from '../../core/input/midi'

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
      return <p className="notice warn">No se ha dado permiso para usar el teclado MIDI. Revisa los permisos del navegador.</p>
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
