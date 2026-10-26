import { useEffect, useState } from 'react'
import { getInstrument } from '../../instruments'
import { loadLibrary, type Piece } from '../../library/catalog'

interface Props {
  onOpen(piece: Piece): void
}

const CARD_COLORS = ['#ffd6a5', '#caffbf', '#9bf6ff', '#bdb2ff', '#ffc6ff', '#fdffb6', '#a0c4ff']

export function LibraryScreen({ onOpen }: Props) {
  const [pieces, setPieces] = useState<Piece[] | null>(null)

  useEffect(() => {
    loadLibrary().then(setPieces)
  }, [])

  return (
    <main className="library">
      <header className="library-header">
        <h1>🎹 Notelisa</h1>
        <p>Elige una pieza para practicar</p>
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
