import { useEffect, useState } from 'react'
import {
  answerRequest, changesProblem, createAccount, EMPTY_REGISTRATION, fullName, MIN_PASSWORD, registrationProblem, ROLE_NAMES,
  updateProfile, type Profile, type ProfileChanges, type Registration, type Role,
} from '../../account/account'
import { isLinked, loadSchool, matchesPerson, members, setTeacherStudent, unlinkEveryone, withLink, type School } from '../../account/admin'
import { ArrowLeft, Check, GraduationCap, Mail, Pencil, Phone, Search, UserPlus, Users, X } from '../icons'
import { RegistrationFields } from './LoginScreen'

type Tab = 'requests' | 'students' | 'teachers'

/** The administrator's panel: requests for access, students and teachers. */
export function AdminScreen({ onBack, onPending }: { onBack(): void; onPending(count: number): void }) {
  const [school, setSchool] = useState<School | null>(null)
  const [failed, setFailed] = useState(false)
  const [tab, setTab] = useState<Tab>('requests')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<string | null>(null)

  const show = (next: School) => {
    setSchool(next)
    onPending(next.profiles.filter(p => p.status === 'pending').length)
  }
  const reload = () => loadSchool().then(show, () => setFailed(true))

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Runs a change on the server and shows its result; on failure, tells and reloads. */
  const change = async (run: () => Promise<void>, next: School) => {
    setFailed(false)
    show(next)
    try {
      await run()
    } catch {
      setFailed(true)
      void reload()
    }
  }

  const setStatus = (profile: Profile, status: 'approved' | 'rejected', role: Role = profile.role) => change(
    () => answerRequest(profile.id, status === 'approved' ? { status, role } : { status }),
    { ...school!, profiles: school!.profiles.map(p => (p.id === profile.id ? { ...p, status, role } : p)) },
  )
  const link = (teacherId: string, studentId: string, linked: boolean) => {
    const pair = { teacher_id: teacherId, student_id: studentId }
    return change(() => setTeacherStudent(pair, linked), withLink(school!, pair, linked))
  }

  const edit = (profile: Profile, changes: ProfileChanges) => {
    const roleChanged = changes.role !== profile.role
    return change(async () => {
      await updateProfile(profile.id, changes)
      // A student who becomes a teacher (or the other way round) starts with no pairs.
      if (roleChanged) await unlinkEveryone(profile.id)
    }, {
      profiles: school!.profiles.map(p => (p.id === profile.id ? { ...p, ...changes } : p)),
      links: roleChanged ? school!.links.filter(l => l.teacher_id !== profile.id && l.student_id !== profile.id) : school!.links,
    })
  }

  const pending = school?.profiles.filter(p => p.status === 'pending') ?? []
  const students = school ? members(school, 'student') : []
  const teachers = school ? members(school, 'teacher') : []

  return (
    <main className="library admin">
      <header className="practice-header requests-header">
        <button className="chip" onClick={onBack}><ArrowLeft /> Biblioteca</button>
        <h1>Administración</h1>
        {!creating && <button className="chip" onClick={() => { setCreating(true); setCreated(null) }}><UserPlus /> Crear cuenta</button>}
      </header>
      {creating && (
        <NewAccount onCancel={() => setCreating(false)} onCreated={(name, role) => {
          setCreating(false)
          setCreated(name)
          setTab(role === 'teacher' ? 'teachers' : 'students')
          void reload()
        }} />
      )}
      {created && <p className="notice account-created">Cuenta creada para <strong>{created}</strong>. Ya puede entrar con su email y la contraseña que has puesto.</p>}
      {failed && <p className="notice warn">No se ha podido guardar o cargar. Revisa la conexión y vuelve a probar.</p>}
      <nav className="admin-tabs" role="tablist">
        {([['requests', 'Solicitudes', pending.length], ['students', 'Alumnos', students.length], ['teachers', 'Profesores', teachers.length]] as const)
          .map(([id, label, count]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`chip${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
              {label} <span className="count">{count}</span>
            </button>
          ))}
      </nav>
      {!school ? (!failed && <p className="score-message">Cargando…</p>)
        : tab === 'requests' ? <Requests school={school} onAnswer={setStatus} />
        : tab === 'students' ? <Students school={school} teachers={teachers} students={students} onLink={link} onRemove={p => setStatus(p, 'rejected')} onEdit={edit} />
        : <Teachers school={school} teachers={teachers} students={students} onLink={link} onRemove={p => setStatus(p, 'rejected')} onEdit={edit} />}
    </main>
  )
}

function Contact({ profile }: { profile: Profile }) {
  return (
    <div className="request-contact">
      <a href={`mailto:${profile.email}`}><Mail /> {profile.email}</a>
      {profile.telefono && <a href={`tel:${profile.telefono}`}><Phone /> {profile.telefono}</a>}
    </div>
  )
}

/** Requests waiting for an answer, and accounts without access that can get it back. */
function Requests({ school, onAnswer }: { school: School; onAnswer(profile: Profile, status: 'approved' | 'rejected', role?: Role): void }) {
  // The role each request will be accepted as; starts as the one asked for.
  const [roles, setRoles] = useState<Record<string, Role>>({})
  const [showRejected, setShowRejected] = useState(false)
  const pending = school.profiles.filter(p => p.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at))
  const rejected = school.profiles.filter(p => p.status === 'rejected')

  const card = (profile: Profile) => {
    const role = roles[profile.id] ?? (profile.role === 'admin' ? 'student' : profile.role)
    return (
      <li key={profile.id} className="request-card">
        <div className="request-who">
          <strong>{fullName(profile) || profile.email}</strong>
          {profile.status === 'pending'
            ? <span className="status status-pending">Pide entrar como {ROLE_NAMES[profile.role].toLowerCase()}</span>
            : <span className="status status-rejected">Sin acceso</span>}
        </div>
        <div className="request-contact">
          <Contact profile={profile} />
          <span>{new Date(profile.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</span>
        </div>
        <div className="request-actions">
          <span>{profile.status === 'pending' ? 'Aceptar como' : 'Dar acceso como'}</span>
          {(['student', 'teacher'] as const).map(r => (
            <button key={r} className={`chip${role === r ? ' active' : ''}`} onClick={() => setRoles({ ...roles, [profile.id]: r })}>
              {ROLE_NAMES[r]}
            </button>
          ))}
          <button className="chip approve" onClick={() => onAnswer(profile, 'approved', role)}><Check /> Aceptar</button>
          {profile.status === 'pending' && <button className="chip" onClick={() => onAnswer(profile, 'rejected')}><X /> Rechazar</button>}
        </div>
      </li>
    )
  }

  return (
    <>
      {pending.length === 0 ? <p className="score-message">No hay solicitudes pendientes.</p> : <ul className="request-list">{pending.map(card)}</ul>}
      {rejected.length > 0 && (
        <>
          <button className="chip admin-more" onClick={() => setShowRejected(!showRejected)}>
            {showRejected ? 'Ocultar' : 'Ver'} cuentas sin acceso ({rejected.length})
          </button>
          {showRejected && <ul className="request-list">{rejected.map(card)}</ul>}
        </>
      )}
    </>
  )
}

interface PeopleProps {
  school: School
  teachers: Profile[]
  students: Profile[]
  onLink(teacherId: string, studentId: string, linked: boolean): void
  onRemove(profile: Profile): void
  onEdit(profile: Profile, changes: ProfileChanges): void
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange(value: string): void; placeholder: string }) {
  return (
    <label className="library-search admin-search">
      <Search />
      <input type="search" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

/** «Quitar acceso», asking once more before doing it. */
function RemoveAccess({ profile, onRemove }: { profile: Profile; onRemove(profile: Profile): void }) {
  const [sure, setSure] = useState(false)
  return sure ? (
    <span className="admin-remove">
      <button className="chip danger" onClick={() => onRemove(profile)}>Sí, quitar acceso</button>
      <button className="chip" onClick={() => setSure(false)}>No</button>
    </span>
  ) : <button className="chip admin-remove" onClick={() => setSure(true)}><X /> Quitar acceso</button>
}

/** Each student with the teachers they have; a tap on a teacher assigns or unassigns them. */
function Students({ school, teachers, students, onLink, onRemove, onEdit }: PeopleProps) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const shown = students.filter(p => matchesPerson(p, query))
  if (students.length === 0) return <p className="score-message">Todavía no hay alumnos. Crea una cuenta o acepta una solicitud.</p>
  return (
    <>
      <SearchBox value={query} onChange={setQuery} placeholder="Buscar alumno por nombre, email o teléfono" />
      <ul className="request-list">
        {shown.map(student => (
          <li key={student.id} className="request-card">
            <div className="request-who">
              <GraduationCap className="admin-role-icon" /><strong>{fullName(student) || student.email}</strong>
              {editing !== student.id && <button className="chip admin-edit" onClick={() => setEditing(student.id)}><Pencil /> Editar</button>}
            </div>
            {editing === student.id ? (
              <EditPerson profile={student} onCancel={() => setEditing(null)} onSave={changes => { onEdit(student, changes); setEditing(null) }} />
            ) : <>
            <Contact profile={student} />
            <div className="request-actions">
              <span>Profesores</span>
              {teachers.length === 0 && <span className="admin-empty">Todavía no hay profesores.</span>}
              {teachers.map(teacher => {
                const linked = isLinked(school, teacher.id, student.id)
                return (
                  <button key={teacher.id} className={`chip${linked ? ' active' : ''}`} aria-pressed={linked}
                    onClick={() => onLink(teacher.id, student.id, !linked)}>
                    {linked && <Check />} {fullName(teacher)}
                  </button>
                )
              })}
              <RemoveAccess profile={student} onRemove={onRemove} />
            </div>
            </>}
          </li>
        ))}
      </ul>
    </>
  )
}

/** Each teacher with their students; «Elegir alumnos» opens every student to tick. */
function Teachers({ school, teachers, students, onLink, onRemove, onEdit }: PeopleProps) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [choosing, setChoosing] = useState<string | null>(null)
  const [studentQuery, setStudentQuery] = useState('')
  const shown = teachers.filter(p => matchesPerson(p, query))
  if (teachers.length === 0) return <p className="score-message">Todavía no hay profesores. Crea una cuenta o acepta una solicitud.</p>
  return (
    <>
      <SearchBox value={query} onChange={setQuery} placeholder="Buscar profesor por nombre, email o teléfono" />
      <ul className="request-list">
        {shown.map(teacher => {
          const mine = students.filter(s => isLinked(school, teacher.id, s.id))
          const open = choosing === teacher.id
          return (
            <li key={teacher.id} className="request-card">
              <div className="request-who">
                <Users className="admin-role-icon" /><strong>{fullName(teacher) || teacher.email}</strong>
                <span className="status">{mine.length === 1 ? '1 alumno' : `${mine.length} alumnos`}</span>
                {editing !== teacher.id && <button className="chip admin-edit" onClick={() => setEditing(teacher.id)}><Pencil /> Editar</button>}
              </div>
              {editing === teacher.id ? (
                <EditPerson profile={teacher} onCancel={() => setEditing(null)} onSave={changes => { onEdit(teacher, changes); setEditing(null) }} />
              ) : <Contact profile={teacher} />}
              {editing === teacher.id ? null : open ? (
                <div className="admin-choose">
                  <SearchBox value={studentQuery} onChange={setStudentQuery} placeholder="Buscar alumno" />
                  <div className="request-actions">
                    {students.filter(s => matchesPerson(s, studentQuery)).map(student => {
                      const linked = isLinked(school, teacher.id, student.id)
                      return (
                        <button key={student.id} className={`chip${linked ? ' active' : ''}`} aria-pressed={linked}
                          onClick={() => onLink(teacher.id, student.id, !linked)}>
                          {linked && <Check />} {fullName(student)}
                        </button>
                      )
                    })}
                    {students.length === 0 && <span className="admin-empty">Todavía no hay alumnos.</span>}
                  </div>
                  <button className="big-button primary" onClick={() => setChoosing(null)}><Check /> Listo</button>
                </div>
              ) : (
                <div className="request-actions">
                  <span>Alumnos</span>
                  {mine.length === 0 && <span className="admin-empty">Ninguno todavía.</span>}
                  {mine.map(student => <span key={student.id} className="admin-name">{fullName(student)}</span>)}
                  <button className="chip" onClick={() => { setChoosing(teacher.id); setStudentQuery('') }}><Users /> Elegir alumnos</button>
                  <RemoveAccess profile={teacher} onRemove={onRemove} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** The administrator creates a student or teacher account that works straight away. */
function NewAccount({ onCancel, onCreated }: { onCancel(): void; onCreated(name: string, role: Role): void }) {
  const [form, setForm] = useState<Registration>(EMPTY_REGISTRATION)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const set = (field: 'email' | 'password') => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: event.target.value })

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const formProblem = registrationProblem(form)?.replace('tu nombre y tus apellidos', 'el nombre y los apellidos') ?? null
    setProblem(formProblem)
    if (formProblem) return
    setBusy(true)
    const error = await createAccount(form)
    setBusy(false)
    if (error) setProblem(error)
    else onCreated(fullName(form), form.role)
  }

  return (
    <form className="account-card new-account" onSubmit={submit} noValidate>
      <h2><UserPlus /> Crear cuenta</h2>
      <RegistrationFields form={form} onChange={setForm} roleLabel="Es" />
      <div className="account-row">
        <label>Email<input type="email" autoComplete="off" autoCapitalize="none" value={form.email} onChange={set('email')} /></label>
        {/* Visible so the administrator can pass it on. */}
        <label>Contraseña<input type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} value={form.password} onChange={set('password')}
          placeholder={`Mínimo ${MIN_PASSWORD} caracteres`} /></label>
      </div>
      {problem && <p className="notice warn" role="alert">{problem}</p>}
      <div className="modal-actions">
        <button className="big-button primary" type="submit" disabled={busy}>{busy ? 'Creando…' : 'Crear cuenta'}</button>
        <button className="chip" type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

/** The administrator corrects name, surnames and phone, or turns a student into a teacher (or back). */
function EditPerson({ profile, onCancel, onSave }: { profile: Profile; onCancel(): void; onSave(changes: ProfileChanges): void }) {
  const [form, setForm] = useState<ProfileChanges>({ nombre: profile.nombre, apellidos: profile.apellidos, telefono: profile.telefono, role: profile.role })
  const [problem, setProblem] = useState<string | null>(null)
  const set = (field: 'nombre' | 'apellidos' | 'telefono') => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: event.target.value })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const formProblem = changesProblem(form)
    setProblem(formProblem)
    if (!formProblem) onSave(form)
  }

  return (
    <form className="edit-person" onSubmit={submit} noValidate>
      <div className="account-row">
        <label>Nombre<input value={form.nombre} onChange={set('nombre')} /></label>
        <label>Apellidos<input value={form.apellidos} onChange={set('apellidos')} /></label>
      </div>
      <div className="account-row">
        <label>Teléfono<input type="tel" value={form.telefono} onChange={set('telefono')} /></label>
        <label>Email<input value={profile.email} disabled title="El email no se puede cambiar desde aquí" /></label>
      </div>
      {profile.role !== 'admin' && (
        <div className="account-roles" role="radiogroup" aria-label="Es">
          <span>Es</span>
          {(['student', 'teacher'] as const).map(role => (
            <button key={role} type="button" role="radio" aria-checked={form.role === role}
              className={`chip${form.role === role ? ' active' : ''}`} onClick={() => setForm({ ...form, role })}>{ROLE_NAMES[role]}</button>
          ))}
        </div>
      )}
      {form.role !== profile.role && (
        <p className="notice warn">Al pasar a {ROLE_NAMES[form.role].toLowerCase()} se quitan sus parejas de profesor y alumno actuales.</p>
      )}
      {problem && <p className="notice warn" role="alert">{problem}</p>}
      <div className="modal-actions">
        <button className="big-button primary" type="submit"><Check /> Guardar</button>
        <button className="chip" type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}
