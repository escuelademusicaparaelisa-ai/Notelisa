import { useCallback, useEffect, useState } from 'react'
import { accounts, loadProfile, type Profile } from './account'

export type AccountState =
  /** The app runs without accounts. */
  | { state: 'off' }
  | { state: 'loading' }
  | { state: 'signedOut' }
  /** profile null: the server could not be reached. */
  | { state: 'signedIn'; profile: Profile | null }

/** Who is using the app, kept up to date when they sign in or out. */
export function useAccount(): AccountState & { reload(): void } {
  const [account, setAccount] = useState<AccountState>(() => (accounts() ? { state: 'loading' } : { state: 'off' }))
  const [userId, setUserId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const supabase = accounts()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null)
      if (!session) setAccount({ state: 'signedOut' })
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
  return { ...account, reload }
}
