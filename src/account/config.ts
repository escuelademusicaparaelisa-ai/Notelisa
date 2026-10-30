// Connection to the school's Supabase project (accounts and database). Both values are
// public by design: the database rules decide what each account may see. With them
// empty the app works as before, without accounts.

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
