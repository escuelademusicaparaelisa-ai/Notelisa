import { createClient, type AuthError, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

// Accounts: administrator, teachers and students. Anyone can ask for access; the
// administrator accepts the request before the app opens for them.

export type Role = 'admin' | 'teacher' | 'student'
export type Status = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  email: string
  nombre: string
  apellidos: string
  telefono: string
  role: Role
  status: Status
  created_at: string
}

export interface Registration {
  nombre: string
  apellidos: string
  telefono: string
  email: string
  password: string
  role: 'teacher' | 'student'
}

export const ROLE_NAMES: Record<Role, string> = { admin: 'Administrador', teacher: 'Profesor', student: 'Alumno' }

export const MIN_PASSWORD = 6

let client: SupabaseClient | null = null

/** The connection to the accounts server, or null when the app runs without accounts. */
export function accounts(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return client
}

function server(): SupabaseClient {
  const supabase = accounts()
  if (!supabase) throw new Error('Notelisa no tiene cuentas configuradas')
  return supabase
}

export function fullName(profile: Pick<Profile, 'nombre' | 'apellidos'>): string {
  return `${profile.nombre} ${profile.apellidos}`.trim()
}

/** What is wrong with a registration form, in words for the person filling it in; null if nothing. */
export function registrationProblem(form: Registration): string | null {
  if (!form.nombre.trim() || !form.apellidos.trim()) return 'Escribe tu nombre y tus apellidos.'
  if (form.telefono.replace(/\D/g, '').length < 9) return 'Escribe un teléfono de al menos 9 números.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Ese email no parece correcto.'
  if (form.password.length < MIN_PASSWORD) return `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`
  return null
}

/** Server errors in plain Spanish. */
export function errorMessage(error: Pick<AuthError, 'code' | 'message'> | null | undefined): string {
  switch (error?.code) {
    case 'invalid_credentials': return 'El email o la contraseña no son correctos.'
    case 'user_already_exists':
    case 'email_exists': return 'Ya hay una cuenta con ese email. Prueba a entrar.'
    case 'email_not_confirmed': return 'Antes de entrar, confirma tu email con el enlace que te hemos enviado.'
    case 'weak_password': return `La contraseña es demasiado corta o sencilla (mínimo ${MIN_PASSWORD} caracteres).`
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.'
  }
  return 'No se ha podido conectar. Revisa la conexión a internet y vuelve a probar.'
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await server().auth.signInWithPassword({ email: email.trim(), password })
  return error ? errorMessage(error) : null
}

/** Sends a request for access. needsEmail: the server asks to confirm the email first. */
export async function register(form: Registration): Promise<{ error: string | null; needsEmail: boolean }> {
  const { email, password, ...data } = form
  const { data: result, error } = await server().auth.signUp({
    email: email.trim(),
    password,
    options: { data: { nombre: data.nombre.trim(), apellidos: data.apellidos.trim(), telefono: data.telefono.trim(), role: data.role } },
  })
  if (error) return { error: errorMessage(error), needsEmail: false }
  // With email confirmation on, an existing email comes back as a user without identities.
  if (result.user && result.user.identities?.length === 0) return { error: errorMessage({ code: 'user_already_exists', message: '' }), needsEmail: false }
  return { error: null, needsEmail: !result.session }
}

export async function signOut(): Promise<void> {
  await server().auth.signOut()
}

export async function loadProfile(id: string): Promise<Profile | null> {
  const { data } = await server().from('profiles').select('*').eq('id', id).maybeSingle()
  return (data as Profile | null) ?? null
}

/** Requests waiting for the administrator, oldest first. */
export async function pendingRequests(): Promise<Profile[]> {
  const { data, error } = await server().from('profiles').select('*').eq('status', 'pending').order('created_at')
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function answerRequest(id: string, answer: { status: 'approved'; role: Role } | { status: 'rejected' }): Promise<void> {
  const { error } = await server().from('profiles').update(answer).eq('id', id)
  if (error) throw error
}
