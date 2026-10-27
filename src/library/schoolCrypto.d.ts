export interface KeyFileEntry {
  id: string
  salt: string
  iv: string
  key: string
}

export interface KeyFile {
  version: number
  iterations: number
  entries: KeyFileEntry[]
}

export function normalizePassword(password: string): string
export function toBase64(bytes: Uint8Array): string
export function fromBase64(text: string): Uint8Array
export function newLibraryKey(): Uint8Array
export function createKeyFile(rawKey: Uint8Array, passwords: Record<string, string>, iterations?: number): Promise<KeyFile>
export function unlockKeyFile(keyFile: KeyFile, password: string): Promise<Uint8Array | null>
export function encryptBytes(rawKey: Uint8Array, bytes: Uint8Array): Promise<Uint8Array>
export function decryptBytes(rawKey: Uint8Array, bytes: ArrayBuffer | Uint8Array): Promise<Uint8Array>
