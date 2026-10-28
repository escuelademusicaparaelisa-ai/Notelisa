import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readSheet, SHEET_NAME, writeSheet } from './catalogSheet.mjs'
import { readMetadata } from './scoreMetadata.mjs'
import { updateLibrary } from './updateLibrary.mjs'

const score = title => `<?xml version="1.0"?>
<score-partwise version="3.1">
  <work><work-title>${title}</work-title></work>
  <part-list></part-list>
</score-partwise>`

describe('updateLibrary', () => {
  it('follows the sheet, adds new files to it and drops deleted ones', async () => {
    const root = mkdtempSync(join(tmpdir(), 'notelisa-update-'))
    const folder = join(root, 'partituras')
    const libraryDir = join(root, 'library')
    mkdirSync(folder)
    mkdirSync(libraryDir)
    writeFileSync(join(folder, 'Secreto_Eterno.musicxml'), score('Title'))
    writeFileSync(join(folder, 'Nueva canción.musicxml'), score('Canción nueva'))
    writeFileSync(join(folder, 'Oculta.musicxml'), score('Oculta'))
    await writeSheet(join(folder, SHEET_NAME), [
      { file: 'Secreto_Eterno.musicxml', title: 'Secreto eterno', composer: 'Popular', arranger: 'Foki', instrument: 'flute', level: 2, publish: true },
      { file: 'Oculta.musicxml', title: 'Oculta', composer: '', arranger: '', instrument: 'piano', publish: false },
      { file: 'Borrada.mscz', title: 'Borrada', composer: '', arranger: '', instrument: 'piano', publish: true },
    ])

    const result = await updateLibrary(folder, 'clave', { libraryDir })
    expect(result.added).toEqual(['Nueva canción.musicxml'])
    expect(result.removed).toEqual(['Borrada.mscz'])
    expect(result.published.map(p => p.title).sort()).toEqual(['Canción nueva', 'Secreto eterno'])
    expect(result.published.find(p => p.title === 'Secreto eterno')).toMatchObject({ instrument: 'flute', composer: 'Popular', arranger: 'Foki', level: 2 })

    const xml = readFileSync(join(libraryDir, 'local/secreto-eterno.musicxml'), 'utf8')
    expect(readMetadata(xml)).toEqual({ title: 'Secreto eterno', composer: 'Popular', arranger: 'Foki' })

    const sheet = await readSheet(join(folder, SHEET_NAME))
    expect(sheet.map(r => r.file)).toEqual(['Nueva canción.musicxml', 'Oculta.musicxml', 'Secreto_Eterno.musicxml'])
    expect(sheet.find(r => r.file === 'Oculta.musicxml')?.publish).toBe(false)
  })

  it('keeps the rows of the free pieces and applies their level to index.json', async () => {
    const root = mkdtempSync(join(tmpdir(), 'notelisa-update-'))
    const folder = join(root, 'partituras')
    const libraryDir = join(root, 'library')
    mkdirSync(folder)
    mkdirSync(libraryDir)
    writeFileSync(join(folder, 'Una.musicxml'), score('Una'))
    writeFileSync(join(libraryDir, 'index.json'), JSON.stringify({ pieces: [
      { id: 'demo', title: 'Demo', level: 1, instrument: 'piano', file: 'demo/demo.musicxml' },
      { id: 'libre-a', title: 'A', level: 2, instrument: 'piano', file: 'libre/a.mxl' },
      { id: 'libre-b', title: 'B', level: 3, instrument: 'piano', file: 'libre/b.mxl' },
    ] }))
    await writeSheet(join(folder, SHEET_NAME), [
      { file: 'libre/a.mxl', title: 'A', composer: '', arranger: '', instrument: 'piano', level: 4, publish: true },
      { file: 'libre/b.mxl', title: 'B nuevo', composer: '', arranger: '', instrument: 'piano', publish: true },
    ])

    const result = await updateLibrary(folder, 'clave', { libraryDir })
    expect(result.removed).toEqual([])
    expect(result.freeLevels).toBe(2)
    const index = JSON.parse(readFileSync(join(libraryDir, 'index.json'), 'utf8'))
    expect(index.pieces.map(p => [p.id, p.level])).toEqual([['demo', 1], ['libre-b', 3], ['libre-a', 4]])
    expect(index.pieces.find(p => p.id === 'libre-b').title).toBe('B nuevo')
    const sheet = await readSheet(join(folder, SHEET_NAME))
    expect(sheet.map(r => r.file)).toEqual(['Una.musicxml', 'libre/a.mxl', 'libre/b.mxl'])
  })
})
