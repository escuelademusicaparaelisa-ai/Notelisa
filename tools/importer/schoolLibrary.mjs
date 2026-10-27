// Publishes the teacher's library (index.local.json) as the encrypted school library
// in public/library/school/, which can be committed and deployed safely.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { createKeyFile, encryptBytes, newLibraryKey } from '../../src/library/schoolCrypto.js'
import { readIndex } from './library.mjs'
import { LIBRARY_DIR } from './paths.mjs'

/**
 * Encrypts every approved piece of the local library with the given passwords
 * ({ id: password }). A new library key is made each time, so old passwords
 * stop working. Returns the published pieces.
 */
export async function publishSchoolLibrary(passwords, { libraryDir = LIBRARY_DIR, iterations } = {}) {
  const outDir = join(libraryDir, 'school')
  const pieces = readIndex(join(libraryDir, 'index.local.json')).pieces
    .filter(p => p.file && (!p.review || p.review.status === 'approved'))
  const key = newLibraryKey()
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  const published = []
  for (const piece of pieces) {
    const format = extname(piece.file).toLowerCase() === '.mxl' ? 'mxl' : 'xml'
    const file = `school/${piece.id}.bin`
    writeFileSync(join(libraryDir, file), await encryptBytes(key, readFileSync(join(libraryDir, piece.file))))
    const { review: _review, content: _content, ...rest } = piece
    published.push({ ...rest, file, encrypted: { format } })
  }
  const index = new TextEncoder().encode(JSON.stringify({ pieces: published }))
  writeFileSync(join(outDir, 'index.bin'), await encryptBytes(key, index))
  writeFileSync(join(outDir, 'keys.json'), JSON.stringify(await createKeyFile(key, passwords, iterations), null, 2) + '\n')
  return published
}
