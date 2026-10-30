import { useState } from 'react'
import { EMPTY_REGISTRATION, MIN_PASSWORD, register, registrationProblem, signIn, signOut, fullName, type Profile, type Registration } from '../../account/account'
import { LogIn, RefreshCw, UserPlus } from '../icons'
import { PasswordInput } from '../components/PasswordInput'

/** Entry to the app: sign in, or ask the administrator for access. */
export function LoginScreen() {
  const [mode, setMode] = useState<'signIn' | 'register'>('signIn')
  const [form, setForm] = useState<Registration>(EMPTY_REGISTRATION)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)
  const set = (field: keyof Registration) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: event.target.value })

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const formProblem = mode === 'register' ? registrationProblem(form) : null
    setProblem(formProblem)
    if (formProblem) return
    setBusy(true)
    if (mode === 'signIn') {
      setProblem(await signIn(form.email, form.password))
    } else {
      const result = await register(form)
      setProblem(result.error)
      setCheckEmail(result.needsEmail)
    }
    setBusy(false)
  }

  const switchTo = (next: typeof mode) => {
    setMode(next)
    setProblem(null)
    setCheckEmail(false)
  }

  return (
    <main className="account-page">
      <img className="account-logo" src={`${import.meta.env.BASE_URL}brand/logo-notelisa.png`} alt="Notelisa" />
      <form className="account-card" onSubmit={submit} noValidate>
        <div className="account-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'signIn'} className={`chip${mode === 'signIn' ? ' active' : ''}`}
            onClick={() => switchTo('signIn')}><LogIn /> Entrar</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={`chip${mode === 'register' ? ' active' : ''}`}
            onClick={() => switchTo('register')}><UserPlus /> Pedir acceso</button>
        </div>
        {checkEmail ? (
          <p className="notice">Te hemos enviado un correo a <strong>{form.email.trim()}</strong>. Abre el enlace para confirmar tu email.
            Después, la escuela revisará tu solicitud y te dará acceso.</p>
        ) : (
          <>
            {mode === 'register' && (
              <>
                <p className="account-intro">Rellena tus datos. La escuela revisará tu solicitud y te dará acceso.</p>
                <RegistrationFields form={form} onChange={setForm} />
              </>
            )}
            <label>Email<input type="email" autoComplete="email" autoCapitalize="none" value={form.email} onChange={set('email')} /></label>
            <label>Contraseña
              <PasswordInput autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')}
                placeholder={mode === 'register' ? `Mínimo ${MIN_PASSWORD} caracteres` : undefined} />
            </label>
            {problem && <p className="notice warn" role="alert">{problem}</p>}
            <button className="big-button primary" type="submit" disabled={busy}>
              {busy ? 'Un momento…' : mode === 'signIn' ? 'Entrar' : 'Enviar solicitud'}
            </button>
          </>
        )}
      </form>
    </main>
  )
}

/** Who the account is for: student or teacher, name, surnames and phone. */
export function RegistrationFields({ form, onChange, roleLabel = 'Soy' }: { form: Registration; onChange(form: Registration): void; roleLabel?: string }) {
  const set = (field: keyof Registration) => (event: React.ChangeEvent<HTMLInputElement>) => onChange({ ...form, [field]: event.target.value })
  return (
    <>
      <div className="account-roles" role="radiogroup" aria-label={roleLabel}>
        <span>{roleLabel}</span>
        {(['student', 'teacher'] as const).map(role => (
          <button key={role} type="button" role="radio" aria-checked={form.role === role}
            className={`chip${form.role === role ? ' active' : ''}`} onClick={() => onChange({ ...form, role })}>
            {role === 'student' ? 'Alumno' : 'Profesor'}
          </button>
        ))}
      </div>
      <div className="account-row">
        <label>Nombre<input autoComplete="given-name" value={form.nombre} onChange={set('nombre')} /></label>
        <label>Apellidos<input autoComplete="family-name" value={form.apellidos} onChange={set('apellidos')} /></label>
      </div>
      <label>Teléfono<input type="tel" autoComplete="tel" value={form.telefono} onChange={set('telefono')} /></label>
    </>
  )
}

/** Shown while the administrator has not accepted the account, or has turned it down. */
export function WaitingScreen({ profile, onCheck }: { profile: Profile | null; onCheck(): void }) {
  const rejected = profile?.status === 'rejected'
  return (
    <main className="account-page">
      <img className="account-logo" src={`${import.meta.env.BASE_URL}brand/logo-notelisa.png`} alt="Notelisa" />
      <section className="account-card">
        <h1>{profile ? `Hola, ${fullName(profile)}` : 'No se ha podido conectar'}</h1>
        <p>
          {!profile ? 'Revisa la conexión a internet y vuelve a probar.'
            : rejected ? 'La escuela no ha aceptado esta solicitud. Si crees que es un error, habla con la escuela.'
            : 'Tu solicitud está enviada. En cuanto la escuela la acepte podrás entrar en Notelisa.'}
        </p>
        <div className="modal-actions">
          {!rejected && <button className="big-button primary" onClick={onCheck}><RefreshCw /> Comprobar otra vez</button>}
          <button className="chip" onClick={() => void signOut()}>Salir</button>
        </div>
      </section>
    </main>
  )
}
