import { accounts } from '../account/account'
import { libraryUrl, type Piece } from './catalog'
import { decryptBytes, fromBase64, toBase64, unlockKeyFile, type KeyFile } from './schoolCrypto.js'

// The school library: the teacher's own scores, published encrypted. The library key
// is kept on the school's server, where only approved accounts can read it, so every
// approved student and teacher sees the library without typing anything. The device
// keeps a copy of the key to open the library offline.

const STORAGE_KEY = 'notelisa.schoolKey'

export type SchoolLibrary =
  | { state: 'none' }
  // The server does not have the key yet: only the administrator (or anyone, when the
  // app runs without accounts) can connect it by typing the school password once.
  | { state: 'locked'; canConnect: boolean }
  | { state: 'open'; pieces: Piece[] }

function storedKey(): Uint8Array | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value ? fromBase64(value) : null
  } catch {
    return null
  }
}

function storeKey(key: Uint8Array | null): void {
  try {
    if (key) localStorage.setItem(STORAGE_KEY, toBase64(key))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private browsing: the key is fetched from the server again next time.
  }
}

async function fetchKeyFile(): Promise<KeyFile | null> {
  try {
    const response = await fetch(libraryUrl('school/keys.json'), { cache: 'no-cache' })
    return response.ok ? ((await response.json()) as KeyFile) : null
  } catch {
    return null
  }
}

async function decryptIndex(key: Uint8Array): Promise<Piece[] | null> {
  try {
    const response = await fetch(libraryUrl('school/index.bin'), { cache: 'no-cache' })
    if (!response.ok) return null
    const data = JSON.parse(new TextDecoder().decode(await decryptBytes(key, await response.arrayBuffer())))
    return (data.pieces ?? []) as Piece[]
  } catch {
    return null
  }
}

/** The key on the school's server: a key, null when it has none, undefined when unreachable. */
async function serverKey(): Promise<Uint8Array | null | undefined> {
  const supabase = accounts()
  if (!supabase) return undefined
  try {
    const { data, error } = await supabase.from('school_library').select('key').eq('id', 1).maybeSingle()
    if (error) return undefined
    return data?.key ? fromBase64(data.key as string) : null
  } catch {
    return undefined
  }
}

async function saveServerKey(key: Uint8Array): Promise<boolean> {
  const supabase = accounts()
  if (!supabase) return true
  const { error } = await supabase.from('school_library').upsert({ id: 1, key: toBase64(key), updated_at: new Date().toISOString() })
  return !error
}

async function isAdmin(): Promise<boolean> {
  const supabase = accounts()
  if (!supabase) return true
  const { data } = await supabase.rpc('is_admin')
  return data === true
}

/** Loads the school library with the key from the server (or the copy on this device). */
export async function loadSchoolLibrary(): Promise<SchoolLibrary> {
  if (!(await fetchKeyFile())) return { state: 'none' }
  const fromServer = await serverKey()
  const local = storedKey()
  const candidates = [fromServer, local].filter((k): k is Uint8Array => !!k)
  for (const key of candidates) {
    const pieces = await decryptIndex(key)
    if (!pieces) continue
    storeKey(key)
    // A device that opened the library with the old password gives the key to the
    // server the first time the administrator signs in on it.
    if (key === local && fromServer === null) void saveServerKey(key).catch(() => {})
    return { state: 'open', pieces }
  }
  // The key changed (new password) or the server does not have it yet.
  storeKey(null)
  return { state: 'locked', canConnect: await isAdmin().catch(() => false) }
}

/** The administrator types the school password once; the key goes to the server for everyone. */
export async function connectSchoolLibrary(password: string): Promise<'ok' | 'wrong' | 'failed'> {
  const keyFile = await fetchKeyFile()
  const key = keyFile && (await unlockKeyFile(keyFile, password))
  if (!key) return 'wrong'
  if (!(await saveServerKey(key).catch(() => false))) return 'failed'
  storeKey(key)
  return 'ok'
}

/** Forgets the key on this device, when signing out. */
export function forgetSchoolLibrary(): void {
  storeKey(null)
}

/** Downloads and decrypts a school piece so the score renderer can show it. */
export async function openSchoolPiece(piece: Piece): Promise<Piece> {
  const key = storedKey()
  if (!piece.encrypted || !piece.file || !key) return piece
  const response = await fetch(libraryUrl(piece.file))
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const bytes = await decryptBytes(key, await response.arrayBuffer())
  // OSMD takes MusicXML as text and MXL (zip) as a binary string.
  let content = ''
  if (piece.encrypted.format === 'mxl') {
    for (const byte of bytes) content += String.fromCharCode(byte)
  } else {
    content = new TextDecoder().decode(bytes)
  }
  return { ...piece, content }
}
