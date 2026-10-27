// Encryption of the school library, shared by the app (browser) and the command
// line tool (Node). Plain JavaScript so Node can run it without a build step.
//
// Every file is encrypted with one random "library key" (AES-GCM). keys.json holds
// that key wrapped with a key derived from each password (PBKDF2), so more
// passwords (one per student, for example) can be added later without
// re-encrypting the files.

const PBKDF2_ITERATIONS = 250000
const IV_BYTES = 12

/** Same password however it is typed: spaces around it and capitals do not matter. */
export function normalizePassword(password) {
  return password.normalize('NFC').trim().toLowerCase()
}

export function toBase64(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function fromBase64(text) {
  return Uint8Array.from(atob(text), c => c.charCodeAt(0))
}

async function passwordKey(password, salt, iterations) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(normalizePassword(password)), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

function aesKey(rawKey) {
  return crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** A new random library key (32 bytes). */
export function newLibraryKey() {
  return crypto.getRandomValues(new Uint8Array(32))
}

/** keys.json content: the library key wrapped once per password. */
export async function createKeyFile(rawKey, passwords, iterations = PBKDF2_ITERATIONS) {
  const entries = []
  for (const [id, password] of Object.entries(passwords)) {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
    const wrapped = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await passwordKey(password, salt, iterations), rawKey))
    entries.push({ id, salt: toBase64(salt), iv: toBase64(iv), key: toBase64(wrapped) })
  }
  return { version: 1, iterations, entries }
}

/** Returns the library key if the password matches one of the entries, otherwise null. */
export async function unlockKeyFile(keyFile, password) {
  for (const entry of keyFile.entries ?? []) {
    try {
      const kek = await passwordKey(password, fromBase64(entry.salt), keyFile.iterations)
      return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(entry.iv) }, kek, fromBase64(entry.key)))
    } catch {
      // Wrong password for this entry: try the next one.
    }
  }
  return null
}

/** Encrypted file layout: 12-byte IV followed by the AES-GCM ciphertext. */
export async function encryptBytes(rawKey, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(rawKey), bytes))
  const out = new Uint8Array(IV_BYTES + cipher.length)
  out.set(iv)
  out.set(cipher, IV_BYTES)
  return out
}

/** Throws when the key is wrong or the file was changed. */
export async function decryptBytes(rawKey, bytes) {
  const data = new Uint8Array(bytes)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, IV_BYTES) }, await aesKey(rawKey), data.slice(IV_BYTES))
  return new Uint8Array(plain)
}
