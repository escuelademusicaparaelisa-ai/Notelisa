import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decryptBytes, unlockKeyFile } from '../../src/library/schoolCrypto.js'
import { publishSchoolLibrary } from './schoolLibrary.mjs'

describe('publishSchoolLibrary', () => {
  it('encrypts approved pieces and their index', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'notelisa-school-'))
    mkdirSync(join(dir, 'local'))
    writeFileSync(join(dir, 'local/a.musicxml'), '<score-partwise>A</score-partwise>')
    writeFileSync(join(dir, 'index.local.json'), JSON.stringify({
      pieces: [
        { id: 'a', title: 'Canción A', instrument: 'piano', file: 'local/a.musicxml' },
        { id: 'b', title: 'Pendiente', instrument: 'piano', file: 'local/b.mxl', review: { status: 'pending' } },
      ],
    }))
    const published = await publishSchoolLibrary({ escuela: 'clave' }, { libraryDir: dir, iterations: 1000 })
    expect(published.map(p => p.id)).toEqual(['a'])

    const keyFile = JSON.parse(readFileSync(join(dir, 'school/keys.json'), 'utf8'))
    const key = await unlockKeyFile(keyFile, 'Clave')
    expect(key).not.toBeNull()
    const index = JSON.parse(new TextDecoder().decode(await decryptBytes(key, readFileSync(join(dir, 'school/index.bin')))))
    expect(index.pieces[0]).toMatchObject({ id: 'a', title: 'Canción A', file: 'school/a.bin', encrypted: { format: 'xml' } })
    expect(readFileSync(join(dir, 'school/a.bin')).toString()).not.toContain('score-partwise')
    expect(new TextDecoder().decode(await decryptBytes(key, readFileSync(join(dir, 'school/a.bin'))))).toContain('A</score')
  })

  it('keeps the library key while the password stays the same', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'notelisa-school-'))
    writeFileSync(join(dir, 'index.local.json'), JSON.stringify({ pieces: [] }))
    const keyOf = async password => unlockKeyFile(JSON.parse(readFileSync(join(dir, 'school/keys.json'), 'utf8')), password)
    await publishSchoolLibrary({ escuela: 'uno' }, { libraryDir: dir, iterations: 1000 })
    const first = await keyOf('uno')
    await publishSchoolLibrary({ escuela: 'uno' }, { libraryDir: dir, iterations: 1000 })
    expect(await keyOf('uno')).toEqual(first)
    await publishSchoolLibrary({ escuela: 'dos' }, { libraryDir: dir, iterations: 1000 })
    expect(await keyOf('dos')).not.toEqual(first)
    expect(await keyOf('uno')).toBeNull()
  })
})
