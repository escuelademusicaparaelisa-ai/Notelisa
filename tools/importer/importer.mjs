// Import pipeline: turns MusicXML, MuseScore, PDF and image files into library pieces.
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { LIBRARY_DIR } from './paths.mjs'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'
import { prepareForOmr } from './image.mjs'
import { readIndex, slugify, titleFromFilename, uniqueId, upsertPiece, writeIndex } from './library.mjs'
import { LOCAL_DIR, REVIEW_DIR } from './paths.mjs'
import { convertWithMuseScore, findAudiveris, findMuseScore, findPdftoppm, recognise, renderPdf } from './tools.mjs'

const KINDS = {
  '.musicxml': 'musicxml', '.xml': 'musicxml', '.mxl': 'musicxml',
  '.mscz': 'musescore', '.mscx': 'musescore',
  '.pdf': 'pdf',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.tif': 'image', '.tiff': 'image', '.webp': 'image',
}

export function kindOf(file) {
  return KINDS[extname(file).toLowerCase()] ?? null
}

/** Finds the external programs once; missing ones stay null and are reported when needed. */
export function detectTools() {
  return { mscore: findMuseScore(), audiveris: findAudiveris(), pdftoppm: findPdftoppm() }
}

const MISSING = {
  mscore: 'No encuentro MuseScore. Instálalo (musescore.org) o indica su ruta con MSCORE=/ruta/a/mscore',
  audiveris: 'No encuentro Audiveris. Instálalo (audiveris.github.io) o indica su ruta con AUDIVERIS=/ruta/a/Audiveris',
  pdftoppm: 'No encuentro pdftoppm (Poppler), necesario para leer PDF. En Mac: brew install poppler; en Windows: instala "poppler for Windows"',
}

function need(tools, name) {
  if (!tools[name]) throw new Error(MISSING[name])
  return tools[name]
}

/**
 * Imports one file. Returns the pieces added to the library (a PDF can give several).
 * options.id replaces an existing piece (used when re-importing a corrected file).
 */
export async function importFile(input, options = {}) {
  const kind = kindOf(input)
  if (!kind) throw new Error(`Tipo de archivo no admitido: ${basename(input)}`)
  const tools = options.tools ?? detectTools()
  const title = options.title ?? titleFromFilename(basename(input))
  const instrument = options.instrument ?? 'piano'
  mkdirSync(LOCAL_DIR, { recursive: true })
  let index = readIndex()
  const added = []

  const register = piece => {
    index = upsertPiece(index, piece)
    added.push(piece)
  }

  if (kind === 'musicxml' || kind === 'musescore') {
    const id = uniqueId(index, slugify(title), options.id)
    const ext = kind === 'musicxml' ? extname(input).toLowerCase() : '.musicxml'
    const file = `local/${id}${ext}`
    if (kind === 'musicxml') copyFileSync(input, join(LOCAL_DIR, `${id}${ext}`))
    else {
      try {
        convertWithMuseScore(need(tools, 'mscore'), input, join(LOCAL_DIR, `${id}${ext}`))
      } catch (error) {
        if (!tools.mscore) throw error
        throw new Error('MuseScore no pudo convertirlo. ¿Está guardado con una versión de MuseScore más nueva que la instalada?')
      }
    }
    const previous = index.pieces.find(p => p.id === id)
    // The corrected file may have another extension than the recognised one.
    if (previous?.file && previous.file !== file) rmSync(join(LIBRARY_DIR, previous.file), { force: true })
    // A corrected file replaces a reviewed OMR piece: it no longer needs review.
    const review = previous?.review ? { ...previous.review, status: 'approved', correctedAt: new Date().toISOString() } : undefined
    register({ ...previous, id, title: previous?.title ?? title, instrument, file, review, source: kind })
  } else {
    const audiveris = need(tools, 'audiveris')
    const work = mkdtempSync(join(tmpdir(), 'notelisa-omr-'))
    try {
      const pages = kind === 'pdf'
        ? renderPdf(need(tools, 'pdftoppm'), input, join(work, 'pages'))
        : [input]
      for (const [n, page] of pages.entries()) {
        const pageLabel = pages.length > 1 ? ` (pág. ${n + 1})` : ''
        const baseId = slugify(title) + (pages.length > 1 ? `-p${n + 1}` : '')
        const clean = join(work, `clean-${n + 1}.png`)
        await prepareForOmr(page, clean)
        const result = recognise(audiveris, clean, join(work, `omr-${n + 1}`))
        options.onLog?.(result.log)
        const outputs = result.files.length ? result.files : [null]
        for (const [m, mxl] of outputs.entries()) {
          const id = uniqueId(index, baseId + (outputs.length > 1 ? `-${m + 1}` : ''), options.id)
          const reviewDir = join(REVIEW_DIR, id)
          mkdirSync(reviewDir, { recursive: true })
          // Keep the original page (colours and all) for side-by-side review.
          await sharp(page).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 85 })
            .toFile(join(reviewDir, 'original.jpg'))
          copyFileSync(clean, join(reviewDir, 'prepared.png'))
          if (mxl) copyFileSync(mxl, join(LOCAL_DIR, `${id}.mxl`))
          register({
            id,
            title: title + pageLabel + (outputs.length > 1 ? ` · ${m + 1}` : ''),
            instrument,
            file: mxl ? `local/${id}.mxl` : null,
            source: kind,
            review: {
              status: mxl ? 'pending' : 'failed',
              originals: [`local/review/${id}/original.jpg`],
              importedFrom: basename(input),
              importedAt: new Date().toISOString(),
            },
          })
        }
      }
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  }

  writeIndex(index)
  return added
}
