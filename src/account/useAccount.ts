import { useCallback, useEffect, useState } from 'react'
import { accounts, loadProfile, type Profile } from './account'

export type AccountState =
  /** The app runs without accounts. */
  | { state: 'off' }
  | { state: 'loading' }
  | { state: 'signedOut' }
  /** profile null: the server could not be reached. */
  | { state: 'signedIn'; profile: Profile | null }

// Read before the accounts connection takes the details out of the address.
const arrival = typeof window === 'undefined' ? '' : `${window.location.hash}&${window.location.search}`
/** They opened the link to choose a new password. */
const cameToRecover = /[#&?]type=recovery\b/.test(arrival)
/** The link they opened no longer works (used already or too old). */
export const brokenLink = /error_code=otp_expired|error=access_denied/.test(arrival)
if (brokenLink) window.history.replaceState(null, '', window.location.pathname)

/** Who is using the app, kept up to date when they sign in or out. */
export function useAccount(): AccountState & { reload(): void; recovering: boolean; recovered(): void } {
  const [account, setAccount] = useState<AccountState>(() => (accounts() ? { state: 'loading' } : { state: 'off' }))
  const [userId, setUserId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  // Came from the email to choose a new password: ask for it before opening the app.
  const [recovering, setRecovering] = useState(cameToRecover)

  useEffect(() => {
    const supabase = accounts()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setUserId(session?.user.id ?? null)
      if (!session) {
        setAccount({ state: 'signedOut' })
        setRecovering(false)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) return
    let current = true
    void loadProfile(userId).then(profile => {
      if (current) setAccount({ state: 'signedIn', profile })
    })
    return () => { current = false }
  }, [userId, version])

  const reload = useCallback(() => setVersion(v => v + 1), [])
  const recovered = useCallback(() => setRecovering(false), [])
  return { ...account, reload, recovering, recovered }
}
