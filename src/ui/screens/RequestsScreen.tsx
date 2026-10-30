import { useEffect, useState } from 'react'
import { answerRequest, createAccount, EMPTY_REGISTRATION, fullName, MIN_PASSWORD, pendingRequests, registrationProblem, ROLE_NAMES, type Profile, type Registration, type Role } from '../../account/account'
import { ArrowLeft, Check, Mail, Phone, UserPlus, X } from '../icons'
import { RegistrationFields } from './LoginScreen'

/** The administrator accepts or turns down requests for access. */
export function RequestsScreen({ onBack, onChange }: { onBack(): void; onChange(count: number): void }) {
  const [requests, setRequests] = useState<Profile[] | null>(null)
  const [failed, setFailed] = useState(false)
  // The role each request will be accepted as; starts as the one asked for.
  const [roles, setRoles] = useState<Record<string, Role>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<string | null>(null)

  const show = (list: Profile[]) => {
    setRequests(list)
    onChange(list.length)
  }

  useEffect(() => {
    pendingRequests().then(show, () => setFailed(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const answer = async (profile: Profile, accept: boolean) => {
    setBusy(profile.id)
    setFailed(false)
    try {
      await answerRequest(profile.id, accept ? { status: 'approved', role: roles[profile.id] ?? profile.role } : { status: 'rejected' })
      show((requests ?? []).filter(r => r.id !== profile.id))
    } catch {
      setFailed(true)
    }
    setBusy(null)
  }

  return (
    <main className="library">
      <header className="practice-header requests-header">
        <button className="chip" onClick={onBack}><ArrowLeft /> Biblioteca</button>
        <h1>Solicitudes de acceso</h1>
        {!creating && <button className="chip" onClick={() => { setCreating(true); setCreated(null) }}><UserPlus /> Crear cuenta</button>}
      </header>
      {creating && <NewAccount onCancel={() => setCreating(false)} onCreated={name => { setCreating(false); setCreated(name) }} />}
      {created && <p className="notice account-created">Cuenta creada para <strong>{created}</strong>. Ya puede entrar con su email y la contraseña que has puesto.</p>}
      {failed && <p className="notice warn">No se ha podido conectar con el servidor. Revisa la conexión y vuelve a probar.</p>}
      {requests === null ? (!failed && <p className="score-message">Cargando…</p>)
        : requests.length === 0 ? <p className="score-message">No hay solicitudes pendientes.</p>
        : (
          <ul className="request-list">
            {requests.map(profile => {
              const role = roles[profile.id] ?? profile.role
              return (
                <li key={profile.id} className="request-card">
                  <div className="request-who">
                    <strong>{fullName(profile) || profile.email}</strong>
                    <span className="status status-pending">Pide entrar como {ROLE_NAMES[profile.role].toLowerCase()}</span>
                  </div>
                  <div className="request-contact">
                    <a href={`mailto:${profile.email}`}><Mail /> {profile.email}</a>
                    {profile.telefono && <a href={`tel:${profile.telefono}`}><Phone /> {profile.telefono}</a>}
                    <span>{new Date(profile.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</span>
                  </div>
                  <div className="request-actions">
                    <span>Aceptar como</span>
                    {(['student', 'teacher'] as const).map(r => (
                      <button key={r} className={`chip${role === r ? ' active' : ''}`} onClick={() => setRoles({ ...roles, [profile.id]: r })}>
                        {ROLE_NAMES[r]}
                      </button>
                    ))}
                    <button className="chip approve" disabled={busy === profile.id} onClick={() => answer(profile, true)}><Check /> Aceptar</button>
                    <button className="chip" disabled={busy === profile.id} onClick={() => answer(profile, false)}><X /> Rechazar</button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
    </main>
  )
}

/** The administrator creates a student or teacher account that works straight away. */
function NewAccount({ onCancel, onCreated }: { onCancel(): void; onCreated(name: string): void }) {
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
    else onCreated(fullName(form))
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
