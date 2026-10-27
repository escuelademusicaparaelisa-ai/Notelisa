import { useEffect, useState } from 'react'
import { getInstrument } from '../../instruments'
import { isPlayable, loadLibrary, pieceFromFile, type Piece } from '../../library/catalog'
import { loadSchoolLibrary, lockSchoolLibrary, openSchoolPiece, unlockSchoolLibrary, type SchoolLibrary } from '../../library/school'

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
  const [school, setSchool] = useState<SchoolLibrary>({ state: 'none' })
  const [opening, setOpening] = useState<string | null>(null)
  const [openError, setOpenError] = useState(false)

  const load = () => Promise.all([loadLibrary(), loadSchoolLibrary()]).then(([all, schoolLibrary]) => {
    const playable = all.filter(isPlayable)
    // On the teacher's computer the same pieces exist unencrypted too.
    const schoolPieces = schoolLibrary.state === 'open' ? schoolLibrary.pieces.filter(p => !playable.some(l => l.id === p.id)) : []
    setPieces([...playable, ...schoolPieces])
    setSchool(schoolLibrary)
    setToReview(all.filter(p => p.review && p.review.status !== 'approved' && p.review.status !== 'rejected').length)
  })

  useEffect(() => {
    void load()
  }, [])

  const open = async (piece: Piece) => {
    if (!piece.encrypted) return onOpen(piece)
    setOpening(piece.id)
    setOpenError(false)
    try {
      onOpen(await openSchoolPiece(piece))
    } catch {
      setOpenError(true)
    } finally {
      setOpening(null)
    }
  }

  const lock = () => {
    lockSchoolLibrary()
    void load()
  }

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
        {school.state === 'open' && (
          <button className="chip" onClick={lock} title="Para usar otra clave en este dispositivo">🔒 Cerrar biblioteca de la escuela</button>
        )}
        {fileError && <p className="notice warn">No se ha podido leer ese archivo. Usa MusicXML (.musicxml, .xml o .mxl).</p>}
        {openError && <p className="notice warn">No se ha podido abrir la pieza. Comprueba la conexión a internet.</p>}
      </header>
      {school.state === 'locked' && <SchoolUnlock onUnlocked={() => void load()} />}
      {pieces === null && <p className="score-message">Cargando biblioteca…</p>}
      {pieces?.length === 0 && <p className="score-message">Todavía no hay piezas en la biblioteca.</p>}
      <ul className="piece-grid">
        {pieces?.map((piece, i) => (
          <li key={piece.id}>
            <button
              className="piece-card"
              style={{ background: CARD_COLORS[i % CARD_COLORS.length] }}
              onClick={() => void open(piece)}
              disabled={opening !== null}
            >
              <span className="piece-title">{piece.title}</span>
              {piece.composer && <span className="piece-composer">{piece.composer}</span>}
              <span className="piece-meta">
                {opening === piece.id ? 'Abriendo… · ' : ''}
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

/** Asks for the school password the first time the library is used on a device. */
function SchoolUnlock({ onUnlocked }: { onUnlocked(): void }) {
  const [password, setPassword] = useState('')
  const [checking, setChecking] = useState(false)
  const [wrong, setWrong] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!password.trim()) return
    setChecking(true)
    setWrong(false)
    const ok = await unlockSchoolLibrary(password)
    setChecking(false)
    if (ok) onUnlocked()
    else setWrong(true)
  }

  return (
    <form className="school-unlock" onSubmit={submit}>
      <h2>🔑 Biblioteca de la escuela</h2>
      <p>Escribe la clave que te ha dado tu profe para ver todas las canciones. Solo hay que hacerlo una vez.</p>
      <div className="school-unlock-row">
        <input id="school-password" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false}
          placeholder="Clave" value={password} onChange={e => setPassword(e.target.value)} aria-label="Clave de la escuela" />
        <button className="big-button primary" type="submit" disabled={checking || !password.trim()}>
          {checking ? 'Comprobando…' : 'Abrir'}
        </button>
      </div>
      {wrong && <p className="notice warn">Esa clave no es correcta. Revisa que esté bien escrita.</p>}
    </form>
  )
}
