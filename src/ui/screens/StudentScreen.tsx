import { useEffect, useState, type ReactNode } from 'react'
import type { Profile } from '../../account/account'
import { loadAssignments, type Assignment } from '../../account/assignments'
import { formatDuration, loadPractice, progressByPiece, secondsSince, startOfWeek, type PracticeLog } from '../../account/progress'
import { getInstrument } from '../../instruments'
import { loadAllPieces } from '../../library/allPieces'
import type { Piece } from '../../library/catalog'
import { openSchoolPiece, type SchoolLibrary } from '../../library/school'
import { ArrowRight, CircleCheck, InstrumentIcon, Lock, Stars, Target, Timer } from '../icons'
import { SchoolUnlock } from './LibraryScreen'

// Card covers cycle through the colours of the logo, as in the library.
const COVERS = ['lila', 'azul', 'amarillo', 'naranja']

/** The student's own page: the pieces their teacher gave them, their progress and the exercises. */
export function StudentScreen({ me, onOpen, onExercises, accountBar }: {
  me: Profile
  onOpen(piece: Piece): void
  onExercises(): void
  accountBar: ReactNode
}) {
  const [pieces, setPieces] = useState<Piece[]>([])
  const [school, setSchool] = useState<SchoolLibrary>({ state: 'none' })
  const [assignments, setAssignments] = useState<Assignment[] | null>(null)
  const [logs, setLogs] = useState<PracticeLog[]>([])
  const [failed, setFailed] = useState(false)
  const [opening, setOpening] = useState<string | null>(null)

  const loadPieces = () => loadAllPieces().then(({ pieces, school }) => {
    setPieces(pieces)
    setSchool(school)
  })

  useEffect(() => {
    void loadPieces()
    loadAssignments([me.id]).then(setAssignments, () => setFailed(true))
    const loadLogs = () => loadPractice([me.id]).then(setLogs, () => {})
    void loadLogs()
    // The practice just finished is saved while this page opens: look again in a moment.
    const again = setTimeout(loadLogs, 1500)
    return () => clearTimeout(again)
  }, [me.id])

  const open = async (piece: Piece) => {
    setOpening(piece.id)
    try {
      onOpen(piece.encrypted ? await openSchoolPiece(piece) : piece)
    } catch {
      setFailed(true)
    } finally {
      setOpening(null)
    }
  }

  const byId = new Map(pieces.map(p => [p.id, p]))
  const progress = progressByPiece(logs.filter(l => l.kind === 'piece'))
  const week = secondsSince(logs, startOfWeek())
  const exercises = logs.filter(l => l.kind === 'exercise')

  const grid = (list: Assignment[]) => (
    <ul className="piece-grid">
      {list.map((a, i) => {
        const piece = byId.get(a.piece_id)
        const p = progress.get(a.piece_id)
        return (
          <li key={a.id}>
            <button className="piece-card" disabled={!piece || opening !== null} onClick={() => piece && void open(piece)}>
              <span className={`piece-cover cover-${COVERS[i % COVERS.length]}`} aria-hidden="true">
                <span className="piece-icon">{piece ? <InstrumentIcon id={getInstrument(piece.instrument).id} strokeWidth={1.6} /> : <Lock />}</span>
                {piece?.level ? <span className="piece-level"><Stars count={piece.level} /></span> : null}
              </span>
              <span className="piece-body">
                <span className="piece-title">{piece?.title ?? a.piece_title}</span>
                {a.source && <span className="piece-composer">{a.source}</span>}
                <span className="piece-progress">
                  {p ? <>
                    <span><Timer /> {formatDuration(p.seconds)}</span>
                    {p.best !== null && <span><CircleCheck /> {p.best}%</span>}
                  </> : <span>Sin empezar</span>}
                </span>
                <span className="piece-meta">
                  {opening === a.piece_id ? 'Abriendo…' : piece ? getInstrument(piece.instrument).name : 'Necesita la clave de la escuela'}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )

  const homework = assignments?.filter(a => a.homework) ?? []
  const forFun = assignments?.filter(a => !a.homework) ?? []
  const needsKey = school.state === 'locked' && !!assignments?.some(a => !byId.has(a.piece_id))

  return (
    <main className="library student">
      <header className="app-bar">
        <img className="app-logo" src={`${import.meta.env.BASE_URL}brand/logo-notelisa.png`} alt="Notelisa" />
        <div className="app-bar-actions">{accountBar}</div>
      </header>
      <section className="library-hero">
        <h1>¡Hola, {me.nombre}!</h1>
        <p className="student-week"><Timer /> Esta semana has estudiado <strong>{formatDuration(week)}</strong></p>
      </section>
      <button className="exercises-link" onClick={onExercises}>
        <span className="icon" aria-hidden="true"><Target /></span>
        <span className="exercises-text">
          <strong>Ejercicios y escalas</strong>
          {exercises.length ? `Llevas ${formatDuration(exercises.reduce((s, l) => s + l.seconds, 0))} de ejercicios` : 'Crea un ejercicio nuevo de lectura, una escala o un arpegio'}
        </span>
        <span className="exercises-go" aria-hidden="true"><ArrowRight /></span>
      </button>
      {needsKey && <SchoolUnlock onUnlocked={() => void loadPieces()} />}
      {failed && <p className="notice warn student-notice">No se ha podido cargar o abrir. Revisa la conexión y vuelve a probar.</p>}
      {assignments === null ? (!failed && <p className="score-message">Cargando tus canciones…</p>)
        : assignments.length === 0 ? <p className="score-message">Tu profe todavía no te ha asignado canciones. Mientras tanto, prueba los ejercicios y escalas.</p>
        : <>
          {homework.length > 0 && <><h2 className="section-title">Deberes</h2>{grid(homework)}</>}
          {forFun.length > 0 && <><h2 className="section-title">Por gusto</h2>{grid(forFun)}</>}
        </>}
    </main>
  )
}
