// Reads and writes the teacher's local library index (public/library/index.local.json).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { LOCAL_INDEX } from './paths.mjs'

export function slugify(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pieza'
}

export function titleFromFilename(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function readIndex(path = LOCAL_INDEX) {
  if (!existsSync(path)) return { pieces: [] }
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function writeIndex(index, path = LOCAL_INDEX) {
  index.pieces.sort((a, b) => a.title.localeCompare(b.title, 'es'))
  writeFileSync(path, JSON.stringify(index, null, 2) + '\n')
}

/** Adds or replaces a piece (matched by id) and returns the updated index. */
export function upsertPiece(index, piece) {
  return { ...index, pieces: [...index.pieces.filter(p => p.id !== piece.id), piece] }
}

/** Picks an id not used by another piece, unless we are replacing that piece on purpose. */
export function uniqueId(index, base, replaceId) {
  if (replaceId) return replaceId
  const taken = new Set(index.pieces.map(p => p.id))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

export function setReviewStatus(index, id, status) {
  const piece = index.pieces.find(p => p.id === id)
  if (!piece) throw new Error(`No existe la pieza ${id}`)
  piece.review = { ...piece.review, status, reviewedAt: new Date().toISOString() }
  return index
}
