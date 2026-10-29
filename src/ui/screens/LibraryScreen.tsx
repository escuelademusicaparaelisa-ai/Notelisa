import { useEffect, useState } from 'react'
import { getInstrument, instruments } from '../../instruments'
import { isPlayable, loadLibrary, pieceFromFile, type Piece } from '../../library/catalog'
import { matchesQuery } from '../../library/search'
import { loadSchoolLibrary, lockSchoolLibrary, openSchoolPiece, unlockSchoolLibrary, type SchoolLibrary } from '../../library/school'
import { ArrowRight, Camera, FileMusic, FolderOpen, InstrumentIcon, KeyRound, Lock, Search, Stars, Target } from '../icons'

interface Props {
  onOpen(piece: Piece): void
  onReview(): void
  onExercises(): void
  onPhotos(photos: File[]): void
}

// Card covers cycle through the colours of the logo.
const COVERS = ['lila', 'azul', 'amarillo', 'naranja']

const FILTER_KEY = 'notelisa.instrumentFilter'

function savedFilter(): string | null {
  try {
    return localStorage.getItem(FILTER_KEY)
  } catch {
    return null
  }
}

function saveFilter(value: string | null): void {
  try {
    if (value) localStorage.setItem(FILTER_KEY, value)
    else localStorage.removeItem(FILTER_KEY)
  } catch {
    // Private browsing: the choice is just not remembered.
  }
}

export function LibraryScreen({ onOpen, onReview, onExercises, onPhotos }: Props) {
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
  // Instrument shown in the library; null = all.
  const [filter, setFilter] = useState<string | null>(savedFilter)
  const [query, setQuery] = useState('')
  // Difficulty shown; null = all.
  const [level, setLevel] = useState<number | null>(null)

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

  const chooseFilter = (value: string | null) => {
    setFilter(value)
    saveFilter(value)
  }

  // Only instruments that have pieces get a button.
  const available = Object.values(instruments).filter(inst => pieces?.some(p => getInstrument(p.instrument).id === inst.id))
  const activeFilter = available.some(inst => inst.id === filter) ? filter : null
  const levels = [...new Set(pieces?.map(p => p.level).filter((l): l is number => !!l))].sort((a, b) => a - b)
  const activeLevel = level !== null && levels.includes(level) ? level : null
  const shown = pieces?.filter(p => (!activeFilter || getInstrument(p.instrument).id === activeFilter)
    && (activeLevel === null || p.level === activeLevel)
    && matchesQuery(p, query))

  return (
    <main className="library">
      <header className="app-bar">
        <img className="app-logo" src={`${import.meta.env.BASE_URL}brand/logo-notelisa.png`} alt="Notelisa" />
        <div className="app-bar-actions">
          <label className="chip open-file">
            <FolderOpen /> Abrir partitura
            <input id="open-file" type="file" accept=".musicxml,.xml,.mxl" hidden
              onChange={e => openFile(e.target.files?.[0])} />
          </label>
          <label className="chip open-file">
            <Camera /> Foto partitura
            {/* On phones this offers the camera or the gallery. */}
            <input id="open-photo" type="file" accept="image/*" multiple hidden
              onChange={e => { if (e.target.files?.length) onPhotos(Array.from(e.target.files)) }} />
          </label>
          {toReview > 0 && (
            <button className="chip review-link" onClick={onReview}><FileMusic /> Revisar importaciones ({toReview})</button>
          )}
          {school.state === 'open' && (
            <button className="chip" onClick={lock} title="Para usar otra clave en este dispositivo"><Lock /> Cerrar biblioteca</button>
          )}
        </div>
      </header>
      <section className="library-hero">
        <h1>¿Qué quieres practicar hoy?</h1>
        <p>Elige una pieza de la biblioteca o crea un ejercicio nuevo.</p>
        {fileError && <p className="notice warn">No se ha podido leer ese archivo. Usa MusicXML (.musicxml, .xml o .mxl).</p>}
        {openError && <p className="notice warn">No se ha podido abrir la pieza. Comprueba la conexión a internet.</p>}
      </section>
      <button className="exercises-link" onClick={onExercises}>
        <span className="icon" aria-hidden="true"><Target /></span>
        <span className="exercises-text"><strong>Ejercicios y escalas</strong>Crea un ejercicio nuevo de lectura, una escala o un arpegio</span>
        <span className="exercises-go" aria-hidden="true"><ArrowRight /></span>
      </button>
      {school.state === 'locked' && <SchoolUnlock onUnlocked={() => void load()} />}
      {pieces === null && <p className="score-message">Cargando biblioteca…</p>}
      {pieces?.length === 0 && <p className="score-message">Todavía no hay piezas en la biblioteca.</p>}
      {!!pieces?.length && <h2 className="section-title">Biblioteca</h2>}
      {!!pieces?.length && (
        <label className="library-search">
          <Search />
          <input type="search" placeholder="Buscar por título o autor"
            value={query} onChange={e => setQuery(e.target.value)} aria-label="Buscar pieza" />
        </label>
      )}
      {levels.length > 1 && (
        <div className="instrument-filter" role="group" aria-label="Dificultad">
          <button className={`chip ${activeLevel === null ? 'active' : ''}`} onClick={() => setLevel(null)} aria-pressed={activeLevel === null}>
            Todos los niveles
          </button>
          {levels.map(l => (
            <button key={l} className={`chip ${activeLevel === l ? 'active' : ''}`}
              onClick={() => setLevel(l)} aria-pressed={activeLevel === l} aria-label={`Nivel ${l}`}>
              <Stars count={l} label={false} />
            </button>
          ))}
        </div>
      )}
      {available.length > 1 && (
        <div className="instrument-filter" role="group" aria-label="Instrumento">
          <button className={`chip ${activeFilter === null ? 'active' : ''}`} onClick={() => chooseFilter(null)} aria-pressed={activeFilter === null}>
            Todas
          </button>
          {available.map(inst => (
            <button key={inst.id} className={`chip ${activeFilter === inst.id ? 'active' : ''}`}
              onClick={() => chooseFilter(inst.id)} aria-pressed={activeFilter === inst.id}>
              <InstrumentIcon id={inst.id} /> {inst.name}
            </button>
          ))}
        </div>
      )}
      {!!pieces?.length && shown?.length === 0 && <p className="score-message">No hay piezas que coincidan con la búsqueda.</p>}
      <ul className="piece-grid">
        {shown?.map((piece, i) => (
          <li key={piece.id}>
            <button className="piece-card" onClick={() => void open(piece)} disabled={opening !== null}>
              <span className={`piece-cover cover-${COVERS[i % COVERS.length]}`} aria-hidden="true">
                <span className="piece-icon"><InstrumentIcon id={getInstrument(piece.instrument).id} strokeWidth={1.6} /></span>
                {piece.level ? <span className="piece-level"><Stars count={piece.level} /></span> : null}
              </span>
              <span className="piece-body">
                <span className="piece-title">{piece.title}</span>
                {(piece.composer || piece.arranger) && (
                  <span className="piece-composer">
                    {[piece.composer, piece.arranger && `arr. ${piece.arranger}`].filter(Boolean).join(' · ')}
                  </span>
                )}
                <span className="piece-meta">
                  {opening === piece.id ? 'Abriendo… · ' : ''}
                  {getInstrument(piece.instrument).name}
                  {piece.level ? ` · nivel ${piece.level}` : ''}
                </span>
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
      <h2><KeyRound /> Biblioteca de la escuela</h2>
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
