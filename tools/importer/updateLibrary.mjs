// Rebuilds the teacher's library from a folder of scores and the Excel sheet that
// describes them, then publishes it as the encrypted school library.
import JSZip from 'jszip'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { readSheet, SHEET_NAME, writeSheet } from './catalogSheet.mjs'
import { slugify, titleFromFilename, writeIndex } from './library.mjs'
import { LIBRARY_DIR, LOCAL_DIR, LOCAL_INDEX } from './paths.mjs'
import { applyMetadata, readMetadata } from './scoreMetadata.mjs'
import { publishSchoolLibrary } from './schoolLibrary.mjs'
import { convertWithMuseScore, findMuseScore } from './tools.mjs'

const SCORE_EXTENSIONS = new Set(['.mscz', '.mscx', '.musicxml', '.xml'])

/**
 * Converts a MuseScore file to MusicXML. Older MuseScore 3 versions refuse files
 * saved by a newer 3.x even though the format is the same, so on failure it
 * retries with a copy labelled as 3.01.
 */
async function convertMuseScore(mscore, input, output) {
  try {
    convertWithMuseScore(mscore, input, output)
    return
  } catch (error) {
    if (extname(input).toLowerCase() !== '.mscz') throw error
  }
  const zip = await JSZip.loadAsync(readFileSync(input))
  for (const name of Object.keys(zip.files).filter(n => n.endsWith('.mscx'))) {
    const text = await zip.file(name).async('string')
    zip.file(name, text.replace(/museScore version="3\.\d+"/, 'museScore version="3.01"'))
  }
  const dir = mkdtempSync(join(tmpdir(), 'notelisa-mscz-'))
  try {
    const copy = join(dir, 'score.mscz')
    writeFileSync(copy, await zip.generateAsync({ type: 'nodebuffer' }))
    convertWithMuseScore(mscore, copy, output)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function guessInstrument(file) {
  return /fl(auta|ute|\.)|flautas/i.test(file) ? 'flute' : 'piano'
}

// Rows for the free pieces that ship with the app (public/library/libre/). Their files
// are not in the teacher's folder; the sheet is only used to set their title and level.
const isFreeRow = row => row.file.startsWith('libre/')

/**
 * Applies the titles and levels written in the sheet to the free pieces of index.json, keeping
 * them sorted by level. Returns how many changed.
 */
function applyFreeLevels(libraryDir, rows) {
  const path = join(libraryDir, 'index.json')
  if (!existsSync(path) || rows.length === 0) return 0
  const index = JSON.parse(readFileSync(path, 'utf8'))
  const byFile = new Map(rows.map(r => [r.file, r]))
  let changed = 0
  for (const piece of index.pieces) {
    const row = byFile.get(piece.file)
    if (!row) continue
    const title = row.title || piece.title
    const level = row.level || piece.level
    if (title !== piece.title || level !== piece.level) {
      Object.assign(piece, { title, level })
      changed++
    }
  }
  if (!changed) return 0
  const free = index.pieces.filter(p => p.file.startsWith('libre/')).sort((a, b) => a.level - b.level)
  index.pieces = [...index.pieces.filter(p => !p.file.startsWith('libre/')), ...free]
  writeFileSync(path, JSON.stringify(index, null, 2) + '\n')
  return changed
}

/**
 * Converts every score of `folder`, applies the details from its Excel sheet
 * (adding rows for new files and dropping rows of deleted ones), writes the sheet
 * back and publishes the encrypted library. Rows of the free pieces (`libre/…`) stay in
 * the sheet and set those pieces' level in index.json.
 * Returns { published, failed, added, removed, freeLevels }.
 */
export async function updateLibrary(folder, password, { onLog = () => {}, libraryDir = LIBRARY_DIR } = {}) {
  let mscore
  const files = readdirSync(folder).filter(f => SCORE_EXTENSIONS.has(extname(f).toLowerCase()))
  const sheetPath = join(folder, SHEET_NAME)
  const previous = await readSheet(sheetPath)
  const byFile = new Map(previous.map(r => [r.file, r]))
  const present = new Set(files.map(f => f.normalize('NFC')))
  const free = previous.filter(isFreeRow)
  const removed = previous.filter(r => !isFreeRow(r) && !present.has(r.file)).map(r => r.file)

  const localDir = libraryDir === LIBRARY_DIR ? LOCAL_DIR : join(libraryDir, 'local')
  rmSync(localDir, { recursive: true, force: true })
  mkdirSync(localDir, { recursive: true })

  const rows = []
  const pieces = []
  const failed = []
  const added = []
  const ids = new Set()
  for (const file of files.sort((a, b) => a.localeCompare(b, 'es'))) {
    const name = file.normalize('NFC')
    const tmp = join(localDir, `tmp-${ids.size}.musicxml`)
    try {
      if (/\.(musicxml|xml)$/i.test(file)) copyFileSync(join(folder, file), tmp)
      else {
        mscore ??= findMuseScore()
        if (!mscore) throw new Error('No se ha encontrado MuseScore')
        await convertMuseScore(mscore, join(folder, file), tmp)
      }
    } catch (error) {
      failed.push({ file: name, reason: error.message })
      onLog(`✗ ${name}: no se ha podido convertir`)
      // Keep the teacher's row so nothing she wrote is lost.
      if (byFile.has(name)) rows.push(byFile.get(name))
      continue
    }
    const xml = readFileSync(tmp, 'utf8')
    let row = byFile.get(name)
    if (!row) {
      const found = readMetadata(xml)
      row = {
        file: name,
        title: found.title ?? titleFromFilename(name),
        composer: found.composer ?? '',
        arranger: found.arranger ?? '',
        instrument: guessInstrument(name),
        level: undefined,
        publish: true,
      }
      added.push(name)
    }
    rows.push(row)
    let id = slugify(row.title || titleFromFilename(name))
    for (let n = 2; ids.has(id); n++) id = `${slugify(row.title)}-${n}`
    ids.add(id)
    const target = `local/${id}.musicxml`
    writeFileSync(join(libraryDir, target), applyMetadata(xml, row))
    rmSync(tmp)
    if (row.publish) {
      pieces.push({
        id,
        title: row.title || titleFromFilename(name),
        ...(row.composer ? { composer: row.composer } : {}),
        ...(row.arranger ? { arranger: row.arranger } : {}),
        ...(row.level ? { level: row.level } : {}),
        instrument: row.instrument,
        file: target,
      })
    }
    onLog(`✓ ${row.title}`)
  }

  writeIndex({ pieces }, libraryDir === LIBRARY_DIR ? LOCAL_INDEX : join(libraryDir, 'index.local.json'))
  rows.sort((a, b) => (a.title || a.file).localeCompare(b.title || b.file, 'es'))
  await writeSheet(sheetPath, [...rows, ...free])
  const freeLevels = applyFreeLevels(libraryDir, free)
  const published = await publishSchoolLibrary({ escuela: password }, { libraryDir })
  return { published, failed, added, removed, freeLevels }
}
