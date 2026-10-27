import { useEffect, useRef, useState } from 'react'
import { ScorePlayer } from '../../core/audio/player'
import type { Timeline } from '../../core/score/timeline'
import { libraryUrl, loadLibrary, pieceSource, type Piece, type ReviewStatus } from '../../library/catalog'
import { ScoreView } from '../components/ScoreView'

interface Props {
  onBack(): void
}

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Descartada',
  failed: 'No reconocida',
}

const player = new ScorePlayer()

/**
 * Teacher-only screen: shows each score imported by optical recognition next to
 * the original page so mistakes can be spotted, then approves or replaces it.
 * Saving decisions needs the local development server (npm run dev).
 */
export function ReviewScreen({ onBack }: Props) {
  const [pieces, setPieces] = useState<Piece[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [playing, setPlaying] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Bumped after a corrected file replaces the score, to reload it.
  const [version, setVersion] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)

  const applyLibrary = (all: Piece[], keep?: string) => {
    const reviewed = all.filter(p => p.review)
    setPieces(reviewed)
    const next = reviewed.find(p => p.id === keep) ?? reviewed.find(p => p.review?.status === 'pending') ?? reviewed[0]
    setSelectedId(next?.id ?? null)
  }

  const reload = async (keep?: string) => applyLibrary(await loadLibrary(), keep)

  useEffect(() => {
    loadLibrary().then(all => applyLibrary(all))
    return () => player.stop()
  }, [])

  const piece = pieces?.find(p => p.id === selectedId) ?? null

  const select = (id: string) => {
    player.stop()
    setPlaying(false)
    setTimeline(null)
    setNotice(null)
    setSelectedId(id)
  }

  const post = async (path: string, init: RequestInit): Promise<boolean> => {
    setBusy(true)
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}__notelisa/${path}`, { method: 'POST', ...init })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.ok) throw new Error(data.error ?? 'save failed')
      return true
    } catch (error) {
      const message = error instanceof Error && error.message !== 'save failed' && !(error instanceof SyntaxError)
        ? error.message
        : 'Para guardar la revisión, abre Notelisa en tu ordenador con «npm run dev».'
      setNotice(message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const decide = async (status: ReviewStatus) => {
    if (!piece) return
    if (await post(`review/${piece.id}`, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })) {
      setNotice(status === 'approved' ? '✅ Aprobada: ya aparece en la biblioteca.' : 'Descartada.')
      await reload(piece.id)
    }
  }

  const replace = async (file: File | undefined) => {
    if (!piece || !file) return
    const ok = await post(`replace/${piece.id}`, {
      headers: { 'X-Filename': encodeURIComponent(file.name) },
      body: await file.arrayBuffer(),
    })
    if (ok) {
      setNotice('✅ Versión corregida guardada y aprobada.')
      setTimeline(null)
      setVersion(v => v + 1)
      await reload(piece.id)
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  const listen = async () => {
    if (!timeline) return
    if (playing) {
      player.stop()
      setPlaying(false)
      return
    }
    setPlaying(true)
    await player.play(timeline, { onEnd: () => setPlaying(false) })
  }

  return (
    <main className="review">
      <header className="practice-header">
        <button className="big-button ghost" onClick={() => { player.stop(); onBack() }}>← Biblioteca</button>
        <h1>Revisar importaciones</h1>
      </header>

      {pieces?.length === 0 && (
        <p className="score-message">No hay partituras importadas por reconocimiento. Usa «npm run importar» con un PDF o una foto.</p>
      )}

      {pieces && pieces.length > 0 && (
        <nav className="review-list" aria-label="Partituras importadas">
          {pieces.map(p => (
            <button key={p.id} className={`review-item ${p.id === selectedId ? 'active' : ''}`} onClick={() => select(p.id)}>
              <span className="review-item-title">{p.title}</span>
              <span className={`status status-${p.review?.status}`}>{STATUS_LABEL[p.review?.status ?? 'pending']}</span>
            </button>
          ))}
        </nav>
      )}

      {piece && (
        <>
          <div className="review-actions">
            <span className="review-source">De: {piece.review?.importedFrom ?? '—'}</span>
            <button className="chip" onClick={listen} disabled={!timeline}>{playing ? '⏹ Parar' : '🔊 Escuchar lo reconocido'}</button>
            <button className="chip approve" onClick={() => decide('approved')} disabled={busy || !piece.file}>✅ Aprobar</button>
            {piece.file && (
              <a className="chip" href={libraryUrl(piece.file)} download={`${piece.id}.mxl`}>⬇️ Descargar para MuseScore</a>
            )}
            <button className="chip" onClick={() => fileInput.current?.click()} disabled={busy}>🔁 Subir versión corregida</button>
            <input ref={fileInput} type="file" accept=".musicxml,.xml,.mxl,.mscz,.mscx" hidden onChange={e => replace(e.target.files?.[0])} />
            <button className="chip" onClick={() => decide('rejected')} disabled={busy}>🗑️ Descartar</button>
          </div>
          {notice && <p className="notice review-notice">{notice}</p>}

          <section className="review-compare">
            <figure className="review-pane">
              <figcaption>Original</figcaption>
              <div className="review-original">
                {piece.review?.originals?.map(src => (
                  <a key={src} href={libraryUrl(src)} target="_blank" rel="noreferrer" title="Abrir a tamaño completo">
                    <img src={libraryUrl(src)} alt={`Original de ${piece.title}`} />
                  </a>
                ))}
              </div>
            </figure>
            <figure className="review-pane">
              <figcaption>Reconocida</figcaption>
              {piece.file
                ? <ScoreView key={`${piece.id}-${version}`} source={`${pieceSource(piece)}?v=${version}`} onLoaded={setTimeline} />
                : <p className="score-message error">Audiveris no pudo reconocer esta página.</p>}
            </figure>
          </section>
        </>
      )}
    </main>
  )
}
