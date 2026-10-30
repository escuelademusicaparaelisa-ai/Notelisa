import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { changePassword, fullName, MIN_PASSWORD, pendingRequests, ROLE_NAMES, signOut, type Profile } from '../../account/account'
import { Check, GraduationCap, KeyRound, LogOut, UserRound, Users, X } from '../icons'
import { PasswordInput } from './PasswordInput'

/** The signed-in person in the library bar: the admin panel, their students (teachers) and their account. */
export function AccountBar({ profile, pending, onPending, onAdmin, onTeacher }: {
  profile: Profile
  /** Requests waiting for the admin; null until known. */
  pending: number | null
  onPending(count: number): void
  onAdmin(): void
  /** The teacher's panel: their students and what they practise. */
  onTeacher(): void
}) {
  const isAdmin = profile.role === 'admin'
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (isAdmin && pending === null) pendingRequests().then(list => onPending(list.length), () => {})
  }, [isAdmin, pending, onPending])

  return (
    <>
      {isAdmin && (
        <button className={`chip${pending ? ' requests-waiting' : ''}`} onClick={onAdmin}>
          <Users /> Administración{pending ? ` (${pending})` : ''}
        </button>
      )}
      {(isAdmin || profile.role === 'teacher') && (
        <button className="chip" onClick={onTeacher}><GraduationCap /> {isAdmin ? 'Tareas' : 'Mis alumnos'}</button>
      )}
      <button className="chip" onClick={() => setOpen(true)} title={profile.email}><UserRound /> {profile.nombre || 'Mi cuenta'}</button>
      {/* Outside the bar, so it still shows when the bar's menu closes. */}
      {open && createPortal(<MyAccount profile={profile} onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}

/** Who is signed in, changing the password and signing out. */
function MyAccount({ profile, onClose }: { profile: Profile; onClose(): void }) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [changed, setChanged] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password !== repeat) {
      setProblem('Las dos contraseñas no coinciden.')
      return
    }
    setBusy(true)
    const error = await changePassword(password)
    setBusy(false)
    setProblem(error)
    if (!error) {
      setChanged(true)
      setPassword('')
      setRepeat('')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal my-account" role="dialog" aria-label="Mi cuenta" onClick={e => e.stopPropagation()}>
        <button className="chip modal-close" onClick={onClose} aria-label="Cerrar"><X /></button>
        <h2>{fullName(profile) || profile.email}</h2>
        <p>{ROLE_NAMES[profile.role]} · {profile.email}</p>
        <form className="account-card my-account-password" onSubmit={submit} noValidate>
          <h3><KeyRound /> Cambiar contraseña</h3>
          <label>Nueva contraseña
            <PasswordInput autoComplete="new-password" value={password} placeholder={`Mínimo ${MIN_PASSWORD} caracteres`}
              onChange={e => { setPassword(e.target.value); setChanged(false) }} />
          </label>
          <label>Repítela
            <PasswordInput autoComplete="new-password" value={repeat} onChange={e => { setRepeat(e.target.value); setChanged(false) }} />
          </label>
          {problem && <p className="notice warn" role="alert">{problem}</p>}
          {changed && <p className="notice account-created"><Check /> Contraseña cambiada. La próxima vez entra con la nueva.</p>}
          <button className="big-button primary" type="submit" disabled={busy || !password}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </form>
        <button className="chip" onClick={() => void signOut()}><LogOut /> Salir</button>
      </section>
    </div>
  )
}
