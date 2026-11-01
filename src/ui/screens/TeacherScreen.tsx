import { useEffect, useState, type ReactNode } from 'react'
import { fullName, type Profile } from '../../account/account'
import {
  assign, EMPTY_SELECTION, loadAssignments, myStudents, selectedPieces, setHomework, unassign, type Assignment, type Selection,
} from '../../account/assignments'
import { matchesPerson } from '../../account/admin'
import { formatDuration, loadPractice, progressByPiece, secondsSince, startOfWeek, type PracticeLog } from '../../account/progress'
import { PieceProgressDialog, PractisedList, ProgressFigures, StudyChart } from '../components/StudyProgress'
import { getInstrument, instruments } from '../../instruments'
import { loadAllPieces } from '../../library/allPieces'
import type { Piece } from '../../library/catalog'
import type { Notebook, NotebookStore } from '../../library/notebooks'
import { matchesQuery } from '../../library/search'
import { ArrowLeft, BookOpen, Check, ChevronDown, GraduationCap, InstrumentIcon, Minus, Plus, Search, Stars, Target, Timer, Trash2 } from '../icons'

/** The teacher gives each of their students pieces: as homework or to play for fun. */
export function TeacherScreen({ me, notebookStore, onBack }: { me: Profile; notebookStore: NotebookStore; onBack(): void }) {
  const [students, setStudents] = useState<Profile[] | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [logs, setLogs] = useState<PracticeLog[]>([])
  const [pieces, setPieces] = useState<Piece[]>([])
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [studentId, setStudentId] = useState<string | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [looking, setLooking] = useState<{ pieceId: string; title: string } | null>(null)

  useEffect(() => {
    notebookStore.load().then(setNotebooks, () => setFailed(true))
    void loadAllPieces().then(({ pieces }) => setPieces(pieces))
    myStudents(me)
      .then(async list => {
        setStudents(list)
        setAssignments(await loadAssignments(list.map(s => s.id)))
        // Without the progress table yet, the rest still works.
        loadPractice(list.map(s => s.id)).then(setLogs, () => {})
        if (list.length === 1) setStudentId(list[0].id)
      })
      .catch(() => setFailed(true))
  }, [me, notebookStore])

  /** Shows a change straight away and saves it; on failure, tells and reloads. */
  const save = async (run: () => Promise<void>, next: Assignment[]) => {
    const before = assignments
    setFailed(false)
    setAssignments(next)
    try {
      await run()
    } catch {
      setFailed(true)
      setAssignments(before)
    }
  }

  const student = students?.find(s => s.id === studentId) ?? null
  const theirs = assignments.filter(a => a.student_id === studentId)
  const theirLogs = logs.filter(l => l.student_id === studentId)
  const progress = progressByPiece(theirLogs.filter(l => l.kind === 'piece'))
  const exerciseSeconds = theirLogs.filter(l => l.kind === 'exercise').reduce((sum, l) => sum + l.seconds, 0)
  const lastDay = theirLogs.at(-1)?.created_at
  const shownStudents = students?.filter(s => matchesPerson(s, query)) ?? []

  return (
    <main className="library teacher">
      <header className="practice-header requests-header">
        <button className="chip" onClick={choosing ? () => setChoosing(false) : onBack}>
          <ArrowLeft /> {choosing ? 'Volver' : 'Biblioteca'}
        </button>
        <h1>{choosing && student ? `Asignar a ${student.nombre}` : me.role === 'admin' ? 'Tareas de los alumnos' : 'Mis alumnos'}</h1>
      </header>
      {failed && <p className="notice warn">No se ha podido guardar o cargar. Revisa la conexión y vuelve a probar.</p>}
      {students === null ? (!failed && <p className="score-message">Cargando…</p>)
        : students.length === 0 ? <p className="score-message">Todavía no tienes alumnos. El administrador te los asigna desde su panel.</p>
        : choosing && student ? (
          <Chooser pieces={pieces} notebooks={notebooks} assigned={theirs} onCancel={() => setChoosing(false)} onAssign={async (chosen, homework) => {
            setFailed(false)
            try {
              const saved = await assign(me, student.id, chosen, homework)
              const ids = new Set(saved.map(a => a.id))
              setAssignments([...assignments.filter(a => !ids.has(a.id)), ...saved])
              setChoosing(false)
            } catch {
              setFailed(true)
            }
          }} />
        ) : (
          <div className="teacher-layout">
            <nav className="teacher-students" aria-label="Alumnos">
              {students.length > 6 && (
                <label className="library-search admin-search">
                  <Search /><input type="search" placeholder="Buscar alumno" value={query} onChange={e => setQuery(e.target.value)} />
                </label>
              )}
              {shownStudents.map(s => {
                const homework = assignments.filter(a => a.student_id === s.id && a.homework).length
                return (
                  <button key={s.id} className={`teacher-student${s.id === studentId ? ' active' : ''}`} onClick={() => setStudentId(s.id)}>
                    <GraduationCap />
                    <span className="teacher-student-name">{fullName(s)}</span>
                    {homework > 0 && <span className="count" title="Canciones de deberes">{homework}</span>}
                  </button>
                )
              })}
            </nav>
            {student ? (
              <section className="teacher-work">
                <div className="teacher-work-head">
                  <h2>{fullName(student)}</h2>
                  <button className="big-button primary" onClick={() => setChoosing(true)}><Plus /> Asignar canciones</button>
                </div>
                <p className="teacher-progress">
                  <span><Timer /> Esta semana: <strong>{formatDuration(secondsSince(theirLogs, startOfWeek()))}</strong></span>
                  <span><Target /> Ejercicios y escalas: <strong>{formatDuration(exerciseSeconds)}</strong></span>
                  <span>{lastDay ? <>Último estudio: <strong>{new Date(lastDay).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</strong></> : 'Todavía no ha estudiado con la app'}</span>
                </p>
                <StudyChart logs={theirLogs} />
                {theirs.length === 0 && <p className="score-message">Todavía no tiene canciones. Pulsa «Asignar canciones».</p>}
                {[true, false].map(homework => {
                  const list = theirs.filter(a => a.homework === homework)
                  if (list.length === 0) return null
                  return (
                    <div key={String(homework)} className="teacher-group">
                      <h3>{homework ? 'Deberes' : 'Por gusto'} <span className="count">{list.length}</span></h3>
                      <ul className="assignment-list">
                        {list.map(a => (
                          <li key={a.id}>
                            <button className="assignment-title link-button" title="Ver su progreso"
                              onClick={() => setLooking({ pieceId: a.piece_id, title: a.piece_title || a.piece_id })}>{a.piece_title || a.piece_id}</button>
                            {a.source && <span className="status">{a.source}</span>}
                            <ProgressFigures progress={progress.get(a.piece_id)} />
                            <label className="toggle assignment-homework">
                              <input type="checkbox" checked={a.homework}
                                onChange={e => save(() => setHomework(a.id, e.target.checked),
                                  assignments.map(x => (x.id === a.id ? { ...x, homework: e.target.checked } : x)))} />
                              Deberes
                            </label>
                            <button className="chip" aria-label={`Quitar ${a.piece_title}`} title="Quitar"
                              onClick={() => save(() => unassign(a.id), assignments.filter(x => x.id !== a.id))}><Trash2 /></button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
                {theirLogs.some(l => l.kind === 'piece' && !theirs.some(a => a.piece_id === l.piece_id)) && (
                  <div className="teacher-group">
                    <h3>Ya trabajadas</h3>
                    <p className="group-hint">Canciones que estudió y ya no tiene asignadas. Pulsa una para ver su progreso.</p>
                    <PractisedList logs={theirLogs} skip={new Set(theirs.map(a => a.piece_id))}
                      onOpen={id => setLooking({ pieceId: id, title: progress.get(id)?.title || id })} />
                  </div>
                )}
                {looking && <PieceProgressDialog {...looking} logs={theirLogs} onClose={() => setLooking(null)} />}
              </section>
            ) : <p className="score-message">Elige un alumno para ver y asignar sus canciones.</p>}
          </div>
        )}
    </main>
  )
}

type Tab = 'notebooks' | 'levels' | 'pieces'

/** A notebook or a level in the chooser: given whole, only some of its pieces, or not at all. */
interface Group {
  key: string
  whole: boolean
  picks: string[]
  pieces: Piece[]
}

/** Ticks whole notebooks, whole levels and single pieces, then gives them all at once. */
function Chooser({ pieces, notebooks, assigned, onCancel, onAssign }: {
  pieces: Piece[]
  notebooks: Notebook[]
  assigned: Assignment[]
  onCancel(): void
  onAssign(chosen: { piece: Piece; source: string }[], homework: boolean): Promise<void>
}) {
  const [tab, setTab] = useState<Tab>(notebooks.length ? 'notebooks' : 'levels')
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION)
  const [instrument, setInstrument] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [homework, setHomeworkMode] = useState(true)
  const [busy, setBusy] = useState(false)

  const shown = pieces.filter(p => !instrument || getInstrument(p.instrument).id === instrument)
  const chosen = selectedPieces(selection, pieces, notebooks, shown)
  const has = new Set(assigned.map(a => a.piece_id))
  const levels = [...new Set(shown.map(p => p.level).filter((l): l is number => !!l))].sort((a, b) => a - b)
  const available = Object.values(instruments).filter(inst => pieces.some(p => getInstrument(p.instrument).id === inst.id))
  const [open, setOpen] = useState<string | null>(null)
  const toggle = <K extends 'notebookIds' | 'levels' | 'pieceIds'>(key: K, value: Selection[K][number]) => {
    const list = selection[key] as Selection[K][number][]
    setSelection({ ...selection, [key]: list.includes(value) ? list.filter(v => v !== value) : [...list, value] })
  }

  const notebookGroup = (n: Notebook): Group => {
    const byId = new Map(pieces.map(p => [p.id, p]))
    return {
      key: `n:${n.id}`, whole: selection.notebookIds.includes(n.id), picks: selection.notebookPicks?.[n.id] ?? [],
      pieces: n.pieceIds.map(id => byId.get(id)).filter((p): p is Piece => !!p),
    }
  }
  const levelGroup = (level: number): Group => ({
    key: `l:${level}`, whole: selection.levels.includes(level), picks: selection.levelPicks?.[level] ?? [],
    pieces: shown.filter(p => p.level === level),
  })
  /** Leaves a group whole, with only these pieces, or out; ticking every piece makes it whole. */
  const setGroup = (group: Group, whole: boolean, picks: string[]) => {
    const all = group.pieces.length > 0 && group.pieces.every(p => picks.includes(p.id))
    const isWhole = whole || all
    const keep = isWhole ? [] : picks
    const id = group.key.slice(2)
    if (group.key.startsWith('n:')) {
      const notebookPicks = { ...selection.notebookPicks }
      if (keep.length) notebookPicks[id] = keep
      else delete notebookPicks[id]
      const notebookIds = selection.notebookIds.filter(x => x !== id)
      setSelection({ ...selection, notebookPicks, notebookIds: isWhole ? [...notebookIds, id] : notebookIds })
    } else {
      const level = Number(id)
      const levelPicks = { ...selection.levelPicks }
      if (keep.length) levelPicks[level] = keep
      else delete levelPicks[level]
      const levels = selection.levels.filter(x => x !== level)
      setSelection({ ...selection, levelPicks, levels: isWhole ? [...levels, level] : levels })
    }
  }
  const togglePiece = (group: Group, pieceId: string) => {
    const current = group.whole ? group.pieces.map(p => p.id) : group.picks
    setGroup(group, false, current.includes(pieceId) ? current.filter(x => x !== pieceId) : [...current, pieceId])
  }
  const groupCard = (group: Group, icon: ReactNode, name: string, extra = '') => {
    const some = !group.whole && group.picks.length > 0
    const isOpen = open === group.key
    const count = group.pieces.length
    return (
      <li key={group.key} className={isOpen ? 'pick-open' : undefined}>
        <div className={`pick-card${group.whole ? ' on' : some ? ' some' : ''}`}>
          <button className="pick-box" role="checkbox" aria-checked={group.whole ? true : some ? 'mixed' : false}
            aria-label={`${name}: todas las canciones`} onClick={() => setGroup(group, !group.whole, [])}>
            {group.whole ? <Check /> : some && <Minus />}
          </button>
          <button className="pick-expand" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : group.key)}>
            {icon}
            <span className="pick-text">
              <strong>{name}</strong>
              <small>{some ? `${group.picks.length} de ${count}` : count === 1 ? '1 canción' : `${count} canciones`}{extra}</small>
            </span>
            <ChevronDown className="pick-chevron" />
          </button>
        </div>
        {isOpen && (
          <div className="pick-drop">
            <button className="chip" onClick={() => setGroup(group, !group.whole, [])}>
              {group.whole ? 'Quitar todas' : 'Aplicar todas'}
            </button>
            <ul className="pick-list">
              {group.pieces.map(p => {
                const on = group.whole || group.picks.includes(p.id)
                return (
                  <li key={p.id}>
                    <button className={`pick-row${on ? ' on' : ''}`} aria-pressed={on} onClick={() => togglePiece(group, p.id)}>
                      <span className="pick-box">{on && <Check />}</span>
                      <InstrumentIcon id={getInstrument(p.instrument).id} className="pick-icon" />
                      <span className="pick-text"><strong>{p.title}</strong>{p.composer && <small>{p.composer}</small>}</span>
                      {has.has(p.id) && <span className="status status-approved">Ya la tiene</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </li>
    )
  }
  const notebookCount = selection.notebookIds.length + Object.keys(selection.notebookPicks ?? {}).length
  const levelCount = selection.levels.length + Object.keys(selection.levelPicks ?? {}).length

  return (
    <section className="chooser">
      <nav className="admin-tabs" role="tablist">
        {([['notebooks', 'Cuadernos', notebookCount], ['levels', 'Niveles', levelCount], ['pieces', 'Canciones', selection.pieceIds.length]] as const)
          .map(([id, label, count]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`chip${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
              {label}{count > 0 && <span className="count">{count}</span>}
            </button>
          ))}
      </nav>
      {tab !== 'notebooks' && available.length > 1 && (
        <div className="instrument-filter" role="group" aria-label="Instrumento">
          <button className={`chip${!instrument ? ' active' : ''}`} onClick={() => setInstrument(null)}>Todos</button>
          {available.map(inst => (
            <button key={inst.id} className={`chip${instrument === inst.id ? ' active' : ''}`} onClick={() => setInstrument(inst.id)}>
              <InstrumentIcon id={inst.id} /> {inst.name}
            </button>
          ))}
        </div>
      )}

      {tab === 'notebooks' && (
        notebooks.length === 0
          ? <p className="score-message">Todavía no hay cuadernos. Créalos en la biblioteca con «Crear cuaderno».</p>
          : <ul className="pick-grid">
            {notebooks.map(n => groupCard(notebookGroup(n), <BookOpen className="pick-icon" />, n.name, n.school ? ' · De la escuela' : ''))}
          </ul>
      )}

      {tab === 'levels' && (
        <ul className="pick-grid">
          {levels.map(level => groupCard(levelGroup(level), <Stars count={level} label={false} />, `Nivel ${level}`))}
        </ul>
      )}

      {tab === 'pieces' && (
        <>
          <label className="library-search admin-search">
            <Search /><input type="search" placeholder="Buscar por título o autor" value={query} onChange={e => setQuery(e.target.value)} />
          </label>
          <ul className="pick-list">
            {shown.filter(p => matchesQuery(p, query)).map(p => {
              const on = selection.pieceIds.includes(p.id)
              return (
                <li key={p.id}>
                  <button className={`pick-row${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle('pieceIds', p.id)}>
                    <span className="pick-box">{on && <Check />}</span>
                    <InstrumentIcon id={getInstrument(p.instrument).id} className="pick-icon" />
                    <span className="pick-text"><strong>{p.title}</strong>{p.composer && <small>{p.composer}</small>}</span>
                    {p.level && <Stars count={p.level} />}
                    {has.has(p.id) && <span className="status status-approved">Ya la tiene</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <div className="notebook-bar chooser-bar">
        <span className="notebook-count"><strong>{chosen.length}</strong> {chosen.length === 1 ? 'canción' : 'canciones'}</span>
        <div className="chooser-mode" role="radiogroup" aria-label="Cómo se asignan">
          <button role="radio" aria-checked={homework} className={`chip${homework ? ' active' : ''}`} onClick={() => setHomeworkMode(true)}>De deberes</button>
          <button role="radio" aria-checked={!homework} className={`chip${!homework ? ' active' : ''}`} onClick={() => setHomeworkMode(false)}>Por gusto</button>
        </div>
        <button className="chip" onClick={onCancel}>Cancelar</button>
        <button className="big-button primary" disabled={busy || chosen.length === 0} onClick={async () => {
          setBusy(true)
          await onAssign(chosen, homework)
          setBusy(false)
        }}><Check /> {busy ? 'Asignando…' : 'Asignar'}</button>
      </div>
    </section>
  )
}
