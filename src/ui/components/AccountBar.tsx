import { useEffect, useState } from 'react'
import { pendingRequests, signOut, type Profile } from '../../account/account'
import { LogOut, Users } from '../icons'

/** The signed-in person in the library bar: their name, requests (admin) and «Salir». */
export function AccountBar({ profile, pending, onPending, onRequests }: {
  profile: Profile
  /** Requests waiting for the admin; null until known. */
  pending: number | null
  onPending(count: number): void
  onRequests(): void
}) {
  const isAdmin = profile.role === 'admin'
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (isAdmin && pending === null) pendingRequests().then(list => onPending(list.length), () => {})
  }, [isAdmin, pending, onPending])

  return (
    <>
      {isAdmin && (
        <button className={`chip${pending ? ' requests-waiting' : ''}`} onClick={onRequests}>
          <Users /> Solicitudes{pending ? ` (${pending})` : ''}
        </button>
      )}
      {confirm ? (
        <button className="chip danger" onClick={() => void signOut()} onBlur={() => setConfirm(false)} autoFocus>
          <LogOut /> ¿Salir, {profile.nombre}?
        </button>
      ) : (
        <button className="chip" onClick={() => setConfirm(true)} title={profile.email}><LogOut /> {profile.nombre || 'Salir'}</button>
      )}
    </>
  )
}
