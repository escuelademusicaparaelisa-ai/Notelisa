import { describe, expect, it } from 'vitest'
import { createKeyFile, decryptBytes, encryptBytes, newLibraryKey, unlockKeyFile } from './schoolCrypto.js'

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

describe('school library encryption', () => {
  it('opens the library with the right password, in any capitals', async () => {
    const key = newLibraryKey()
    const keyFile = await createKeyFile(key, { escuela: 'Elisa-Sol-2026' }, 1000)
    expect(await unlockKeyFile(keyFile, ' elisa-sol-2026 ')).toEqual(key)
    expect(await unlockKeyFile(keyFile, 'otra')).toBeNull()
  })

  it('accepts any of several passwords', async () => {
    const key = newLibraryKey()
    const keyFile = await createKeyFile(key, { escuela: 'uno', ana: 'dos' }, 1000)
    expect(await unlockKeyFile(keyFile, 'dos')).toEqual(key)
  })

  it('encrypts and decrypts files', async () => {
    const key = newLibraryKey()
    const encrypted = await encryptBytes(key, new TextEncoder().encode('<score-partwise/>'))
    expect(text(encrypted)).not.toContain('score-partwise')
    expect(text(await decryptBytes(key, encrypted))).toBe('<score-partwise/>')
    await expect(decryptBytes(newLibraryKey(), encrypted)).rejects.toThrow()
  })
})
