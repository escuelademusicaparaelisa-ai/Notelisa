import { useEffect, useState } from 'react'
import { getInstrument } from '../../instruments'
import { isPlayable, loadLibrary, pieceFromFile, type Piece } from '../../library/catalog'

interface Props {
  onOpen(piece: Piece): void
  onReview(): void
}

const CARD_COLORS = ['#ffd6a5', '#caffbf', '#9bf6ff', '#bdb2ff', '#ffc6ff', '#fdffb6', '#a0c4ff']

export function LibraryScreen({ onOpen, onReview }: Props) {
  const [pieces, setPieces] = useState<Piece[] | null>(null)
  const [fileError, setFileError] = useState(false)

  const openFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setFileError(false)
      onOpen(await pieceFromFile(file))
    } catch {
      setFileError(true)
    }
  }

  const [toReview, setToReview] = useState(0)

  useEffect(() => {
    loadLibrary().then(all => {
      setPieces(all.filter(isPlayable))
      setToReview(all.filter(p => p.review && p.review.status !== 'approved' && p.review.status !== 'rejected').length)
    })
  }, [])

  return (
    <main className="library">
      <header className="library-header">
        <h1>🎹 Notelisa</h1>
        <p>Elige una pieza para practicar</p>
        <label className="chip open-file">
          📂 Abrir partitura del dispositivo
          <input id="open-file" type="file" accept=".musicxml,.xml,.mxl" hidden
            onChange={e => openFile(e.target.files?.[0])} />
        </label>
        {toReview > 0 && (
          <button className="chip review-link" onClick={onReview}>📝 Revisar importaciones ({toReview})</button>
        )}
        {fileError && <p className="notice warn">No se ha podido leer ese archivo. Usa MusicXML (.musicxml, .xml o .mxl).</p>}
      </header>
      {pieces === null && <p className="score-message">Cargando biblioteca…</p>}
      {pieces?.length === 0 && <p className="score-message">Todavía no hay piezas en la biblioteca.</p>}
      <ul className="piece-grid">
        {pieces?.map((piece, i) => (
          <li key={piece.id}>
            <button
              className="piece-card"
              style={{ background: CARD_COLORS[i % CARD_COLORS.length] }}
              onClick={() => onOpen(piece)}
            >
              <span className="piece-title">{piece.title}</span>
              {piece.composer && <span className="piece-composer">{piece.composer}</span>}
              <span className="piece-meta">
                {getInstrument(piece.instrument).name}
                {piece.level ? ` · ${'★'.repeat(piece.level)}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
