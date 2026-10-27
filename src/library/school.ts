import { libraryUrl, type Piece } from './catalog'
import { decryptBytes, fromBase64, toBase64, unlockKeyFile, type KeyFile } from './schoolCrypto.js'

// The school library: the teacher's own scores, published encrypted. Students type
// the school password once; the device then keeps the library key (not the password).

const STORAGE_KEY = 'notelisa.schoolKey'

export type SchoolLibrary =
  | { state: 'none' }
  | { state: 'locked' }
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
    // Private browsing: the password will be asked again next time.
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

/** Loads the school library with the key saved on this device, if any. */
export async function loadSchoolLibrary(): Promise<SchoolLibrary> {
  if (!(await fetchKeyFile())) return { state: 'none' }
  const key = storedKey()
  if (!key) return { state: 'locked' }
  const pieces = await decryptIndex(key)
  if (pieces) return { state: 'open', pieces }
  // The password was changed: the saved key no longer opens the library.
  storeKey(null)
  return { state: 'locked' }
}

/** Checks the password and remembers the library key on this device. */
export async function unlockSchoolLibrary(password: string): Promise<boolean> {
  const keyFile = await fetchKeyFile()
  const key = keyFile && (await unlockKeyFile(keyFile, password))
  if (!key) return false
  storeKey(key)
  return true
}

export function lockSchoolLibrary(): void {
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
