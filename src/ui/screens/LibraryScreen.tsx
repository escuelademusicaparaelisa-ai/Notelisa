import { useEffect, useState, type ReactNode } from 'react'
import { getInstrument, instruments } from '../../instruments'
import { loadAllPieces } from '../../library/allPieces'
import { pieceFromFile, type Piece } from '../../library/catalog'
import { deviceNotebooks, newNotebookId, removeNotebook, togglePiece, upsertNotebook, type Notebook, type NotebookStore } from '../../library/notebooks'
import { matchesQuery } from '../../library/search'
import { lockSchoolLibrary, openSchoolPiece, unlockSchoolLibrary, type SchoolLibrary } from '../../library/school'
import { ArrowLeft, ArrowRight, BookOpen, Camera, Check, FileMusic, FolderOpen, InstrumentIcon, KeyRound, Lock, Pencil, Plus, Search, Stars, Target, Trash2 } from '../icons'

interface Props {
  onOpen(piece: Piece): void
  onReview(): void
  onExercises(): void
  onPhotos(photos: File[]): void
  /** The notebook being looked at; null = the whole library. */
  notebookId: string | null
  onNotebook(id: string | null): void
  /** Who is signed in and their buttons, when the app has accounts. */
  accountBar?: ReactNode
  /** Where notebooks are kept; this device when not given. */
  notebookStore?: NotebookStore
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

export function LibraryScreen({ onOpen, onReview, onExercises, onPhotos, notebookId, onNotebook, accountBar, notebookStore = deviceNotebooks }: Props) {
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
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [notebookError, setNotebookError] = useState(false)
  // The notebook being created or edited, with its pieces ticked in the library.
  const [draft, setDraft] = useState<Notebook | null>(null)
  const [onlyChosen, setOnlyChosen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = () => loadAllPieces().then(({ pieces: playable, all, school: schoolLibrary }) => {
    setPieces(playable)
    setSchool(schoolLibrary)
    setToReview(all.filter(p => p.review && p.review.status !== 'approved' && p.review.status !== 'rejected').length)
  })

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    notebookStore.load().then(setNotebooks, () => setNotebookError(true))
  }, [notebookStore])

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

  /** Shows the change straight away and saves it; on failure, tells and goes back. */
  const changeNotebooks = (next: Notebook[], run: () => Promise<void>) => {
    const before = notebooks
    setNotebooks(next)
    setNotebookError(false)
    run().catch(() => {
      setNotebooks(before)
      setNotebookError(true)
    })
  }

  const edit = (notebook: Notebook) => {
    setDraft(notebook)
    setOnlyChosen(false)
    setConfirmDelete(false)
    window.scrollTo(0, 0)
  }

  const closeEditor = () => {
    setDraft(null)
    window.scrollTo(0, 0)
  }

  const saveDraft = () => {
    if (!draft || !draft.name.trim()) return
    changeNotebooks(upsertNotebook(notebooks, draft), () => notebookStore.save(draft))
    onNotebook(draft.id)
    closeEditor()
  }

  const deleteDraft = () => {
    if (!draft) return
    const id = draft.id
    changeNotebooks(removeNotebook(notebooks, id), () => notebookStore.remove(id))
    onNotebook(null)
    closeEditor()
  }

  const byId = new Map(pieces?.map(p => [p.id, p]))
  // Pieces of a notebook that this device can show (school pieces need the password).
  const notebookPieces = (notebook: Notebook) => notebook.pieceIds.map(id => byId.get(id)).filter((p): p is Piece => !!p)
  const editing = draft !== null
  const isNew = editing && !notebooks.some(n => n.id === draft.id)
  const notebook = editing ? null : notebooks.find(n => n.id === notebookId) ?? null
  const inView = editing && onlyChosen ? notebookPieces(draft) : notebook ? notebookPieces(notebook) : pieces

  // Only instruments that have pieces get a button.
  const available = Object.values(instruments).filter(inst => pieces?.some(p => getInstrument(p.instrument).id === inst.id))
  const activeFilter = available.some(inst => inst.id === filter) ? filter : null
  const levels = [...new Set(pieces?.map(p => p.level).filter((l): l is number => !!l))].sort((a, b) => a - b)
  const activeLevel = level !== null && levels.includes(level) ? level : null
  const shown = inView?.filter(p => (!activeFilter || getInstrument(p.instrument).id === activeFilter)
    && (activeLevel === null || p.level === activeLevel)
    && matchesQuery(p, query))

  return (
    <main className="library">
      <header className="app-bar">
        <img className="app-logo" src={`${import.meta.env.BASE_URL}brand/logo-notelisa.png`} alt="Notelisa" />
        {!editing && <div className="app-bar-actions">
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
          {accountBar}
        </div>}
      </header>
      {editing && (
        <section className="notebook-editor">
          <h1>{isNew ? 'Nuevo cuaderno' : 'Editar cuaderno'}</h1>
          <label className="notebook-name">
            Nombre del cuaderno
            <input id="notebook-name" type="text" placeholder="Por ejemplo: Nivel 1, Navidad…" value={draft.name} maxLength={60}
              onChange={e => setDraft({ ...draft, name: e.target.value })} autoFocus={isNew} />
          </label>
          <p>Toca las canciones que quieras en este cuaderno. Si tocas otra vez, se quitan. Una canción puede estar en varios cuadernos.</p>
          {!isNew && (confirmDelete ? (
            <div className="notebook-delete">
              <span>¿Borrar «{draft.name.trim() || 'este cuaderno'}»? Las canciones siguen en la biblioteca.</span>
              <button className="chip danger" onClick={deleteDraft}><Trash2 /> Sí, borrar</button>
              <button className="chip" onClick={() => setConfirmDelete(false)}>No</button>
            </div>
          ) : (
            <button className="chip" onClick={() => setConfirmDelete(true)}><Trash2 /> Borrar cuaderno</button>
          ))}
        </section>
      )}
      {!editing && <>
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
      {!!pieces?.length && (
        <>
          <h2 className="section-title">Cuadernos</h2>
          {notebookError && <p className="notice warn notebook-error">No se han podido cargar o guardar los cuadernos. Revisa la conexión y vuelve a probar.</p>}
          <ul className="notebook-list">
            {notebooks.map(n => {
              const count = notebookPieces(n).length
              return (
                <li key={n.id}>
                  <button className={`notebook-card ${notebook?.id === n.id ? 'active' : ''}`} aria-pressed={notebook?.id === n.id}
                    onClick={() => onNotebook(notebook?.id === n.id ? null : n.id)}>
                    <span className="notebook-icon" aria-hidden="true"><BookOpen /></span>
                    <span className="notebook-text">
                      <strong>{n.name}</strong>
                      {count === 1 ? '1 canción' : `${count} canciones`}
                      {n.school && <span className="notebook-school">De la escuela</span>}
                    </span>
                  </button>
                </li>
              )
            })}
            <li>
              <button className="notebook-card new" onClick={() => edit({ id: newNotebookId(), name: '', pieceIds: [] })}>
                <span className="notebook-icon" aria-hidden="true"><Plus /></span>
                <span className="notebook-text"><strong>Crear cuaderno</strong>Elige canciones de la biblioteca</span>
              </button>
            </li>
          </ul>
        </>
      )}
      </>}
      {!!pieces?.length && !editing && (notebook ? (
        <div className="section-head">
          <h2 className="section-title"><BookOpen /> {notebook.name}</h2>
          {!notebook.readOnly && <button className="chip" onClick={() => edit(notebook)}><Pencil /> Editar cuaderno</button>}
          <button className="chip" onClick={() => onNotebook(null)}><ArrowLeft /> Toda la biblioteca</button>
        </div>
      ) : <h2 className="section-title">Biblioteca</h2>)}
      {!!pieces?.length && (
        <label className="library-search">
          <Search />
          <input type="search" placeholder="Buscar por título o autor"
            value={query} onChange={e => setQuery(e.target.value)} aria-label="Buscar pieza" />
        </label>
      )}
      {editing && (
        <div className="instrument-filter" role="group" aria-label="Qué canciones ver">
          <button className={`chip ${!onlyChosen ? 'active' : ''}`} onClick={() => setOnlyChosen(false)} aria-pressed={!onlyChosen}>
            Toda la biblioteca
          </button>
          <button className={`chip ${onlyChosen ? 'active' : ''}`} onClick={() => setOnlyChosen(true)} aria-pressed={onlyChosen}>
            <Check /> Elegidas ({notebookPieces(draft).length})
          </button>
        </div>
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
      {!!pieces?.length && shown?.length === 0 && (
        <p className="score-message">
          {editing && onlyChosen && !notebookPieces(draft).length ? 'Todavía no has elegido ninguna canción.'
            : notebook && !notebook.pieceIds.length ? 'Este cuaderno está vacío. Pulsa «Editar cuaderno» para añadir canciones.'
            : 'No hay piezas que coincidan con la búsqueda.'}
        </p>
      )}
      <ul className="piece-grid">
        {shown?.map((piece, i) => {
          const chosen = editing && draft.pieceIds.includes(piece.id)
          return (
          <li key={piece.id}>
            <button className={`piece-card ${chosen ? 'chosen' : ''}`} disabled={opening !== null} aria-pressed={editing ? chosen : undefined}
              onClick={() => editing ? setDraft({ ...draft, pieceIds: togglePiece(draft.pieceIds, piece.id) }) : void open(piece)}>
              <span className={`piece-cover cover-${COVERS[i % COVERS.length]}`} aria-hidden="true">
                <span className="piece-icon"><InstrumentIcon id={getInstrument(piece.instrument).id} strokeWidth={1.6} /></span>
                {piece.level ? <span className="piece-level"><Stars count={piece.level} /></span> : null}
                {editing && <span className="piece-check" aria-hidden="true">{chosen && <Check strokeWidth={3} />}</span>}
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
          )
        })}
      </ul>
      {editing && (
        <div className="notebook-bar">
          <span className="notebook-count">
            <strong>{notebookPieces(draft).length}</strong> {notebookPieces(draft).length === 1 ? 'canción elegida' : 'canciones elegidas'}
          </span>
          <button className="big-button ghost" onClick={closeEditor}>Cancelar</button>
          <button className="big-button primary" onClick={saveDraft} disabled={!draft.name.trim()}
            title={draft.name.trim() ? undefined : 'Escribe un nombre para el cuaderno'}><Check /> Guardar</button>
        </div>
      )}
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
