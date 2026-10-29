import { useState } from 'react'
import { requestText, sendPhotoRequest, type PhotoRequest } from '../../library/photoRequest'
import { Choices } from '../components/Choices'
import { ArrowLeft, Copy, Flute, ImagePlus, Piano, Send, Stars, X } from '../icons'

interface Props {
  photos: File[]
  onBack(): void
}

type Sent = 'shared' | 'downloaded' | 'copied' | 'failed' | 'copy-failed' | null

const withPreview = (file: File) => ({ file, url: URL.createObjectURL(file) })

/**
 * Asks for a new piece from photos of a score: the teacher adds the details
 * (title, level, lyrics, fingering) and sends the photos to be transcribed.
 */
export function PhotoScreen({ photos: initial, onBack }: Props) {
  // Each photo with the address of its preview, made once when it is added (a few
  // photos per visit, so they are only released when removed or the page closes).
  const [photos, setPhotos] = useState(() => initial.map(withPreview))
  const [request, setRequest] = useState<PhotoRequest>({
    title: '', composer: '', level: 1, instrument: 'piano', keepLyrics: true, keepFingering: true, notes: '',
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<Sent>(null)
  const set = <K extends keyof PhotoRequest>(key: K) => (value: PhotoRequest[K]) => setRequest(r => ({ ...r, [key]: value }))

  const addPhotos = (files: FileList | null) => {
    if (files?.length) setPhotos(p => [...p, ...Array.from(files, withPreview)])
    setSent(null)
  }

  const send = async () => {
    setSending(true)
    setSent(null)
    try {
      const result = await sendPhotoRequest(request, photos.map(photo => photo.file))
      if (result !== 'cancelled') setSent(result)
    } catch {
      setSent('failed')
    } finally {
      setSending(false)
    }
  }

  // To paste the details next to the photo in a chat the share menu cannot open.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(requestText(request, photos.length))
      setSent('copied')
    } catch {
      setSent('copy-failed')
    }
  }

  return (
    <main className="library exercises photo-request">
      <header className="app-bar">
        <button className="big-button ghost" onClick={onBack}><ArrowLeft /> Biblioteca</button>
        <img className="app-logo" src={`${import.meta.env.BASE_URL}brand/logo-notelisa.png`} alt="Notelisa" />
      </header>
      <section className="library-hero">
        <h1>Pieza nueva desde foto</h1>
        <p>Completa los datos y envía la foto. Cuando esté pasada a limpio aparecerá en la biblioteca.</p>
      </section>
      <div className="exercise-options">
        <fieldset className="exercise-option">
          <legend>{photos.length === 1 ? 'Foto' : `Fotos (${photos.length})`}</legend>
          <div className="photo-previews">
            {photos.map(({ url }, i) => (
              <figure key={url} className="photo-preview">
                <img src={url} alt={`Página ${i + 1}`} />
                <button type="button" className="photo-remove" aria-label={`Quitar la página ${i + 1}`}
                  onClick={() => { URL.revokeObjectURL(url); setPhotos(p => p.filter((_, j) => j !== i)) }}><X /></button>
              </figure>
            ))}
            <label className="photo-add">
              <ImagePlus />
              {photos.length ? 'Añadir otra página' : 'Elegir foto'}
              <input type="file" accept="image/*" multiple hidden onChange={e => { addPhotos(e.target.files); e.target.value = '' }} />
            </label>
          </div>
        </fieldset>
        <fieldset className="exercise-option">
          <legend>Datos de la pieza</legend>
          <div className="photo-fields">
            <label>Título
              <input type="text" value={request.title} onChange={e => set('title')(e.target.value)} placeholder="Por ejemplo, Noche de paz" />
            </label>
            <label><span>Autor <span className="optional">(opcional)</span></span>
              <input type="text" value={request.composer} onChange={e => set('composer')(e.target.value)} />
            </label>
          </div>
        </fieldset>
        <Choices label="Nivel" value={request.level} onChange={set('level')}
          choices={[1, 2, 3, 4, 5].map(l => ({ value: l, label: '', icon: <Stars count={l} /> }))} />
        <Choices label="Instrumento" value={request.instrument} onChange={set('instrument')} choices={[
          { value: 'piano', label: 'Piano', icon: <Piano /> },
          { value: 'flute', label: 'Flauta', icon: <Flute /> },
        ]} />
        <Choices label="Letra" value={request.keepLyrics} onChange={set('keepLyrics')} choices={[
          { value: true, label: 'Mantener la letra' },
          { value: false, label: 'Quitar la letra' },
        ]} />
        <Choices label="Digitación" value={request.keepFingering} onChange={set('keepFingering')} choices={[
          { value: true, label: 'Mantener los números' },
          { value: false, label: 'Quitar los números' },
        ]} />
        <fieldset className="exercise-option">
          <legend>Notas <span className="optional">(opcional)</span></legend>
          <textarea className="photo-notes" rows={3} value={request.notes} onChange={e => set('notes')(e.target.value)}
            placeholder="Por ejemplo: solo la mano derecha, o empieza en la segunda línea" />
        </fieldset>
      </div>
      {sent === 'shared' && <p className="notice">Enviada. Cuando esté pasada a limpio aparecerá en la biblioteca.</p>}
      {sent === 'downloaded' && (
        <p className="notice">Se ha descargado la foto y los datos están copiados. Pégalos junto a la foto en el chat de Claude.</p>
      )}
      {sent === 'copied' && <p className="notice">Datos copiados. Pégalos junto a la foto en el proyecto Notelise.</p>}
      {sent === 'failed' && <p className="notice warn">No se ha podido preparar la foto. Prueba con otra imagen.</p>}
      {sent === 'copy-failed' && <p className="notice warn">No se han podido copiar los datos en este navegador.</p>}
      <div className="photo-actions">
        <button className="big-button primary create-exercise" onClick={() => void send()}
          disabled={sending || photos.length === 0 || !request.title.trim()}>
          <Send /> {sending ? 'Preparando…' : 'Enviar foto'}
        </button>
        <button className="big-button" onClick={() => void copy()} disabled={!request.title.trim()}>
          <Copy /> Copiar datos
        </button>
      </div>
      {!request.title.trim() && <p className="exercise-hint">Escribe el título para poder enviarla.</p>}
    </main>
  )
}
