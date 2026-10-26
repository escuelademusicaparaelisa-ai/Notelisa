#!/usr/bin/env node
// Converts MuseScore files (.mscz/.mscx) to MusicXML with the MuseScore command line
// and registers them in public/library/index.local.json (the teacher's own library).
//
// Usage: npm run import-scores -- <folder-or-file> [...]
// MuseScore must be installed. Set MSCORE=/path/to/mscore if it is not found.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const outDir = join(root, 'public/library/local')
const indexPath = join(root, 'public/library/index.local.json')

const CANDIDATES = [
  process.env.MSCORE,
  'mscore4portable', 'mscore', 'mscore3', 'musescore',
  '/Applications/MuseScore 4.app/Contents/MacOS/mscore',
  'C:\\Program Files\\MuseScore 4\\bin\\MuseScore4.exe',
].filter(Boolean)

function findMuseScore() {
  for (const bin of CANDIDATES) {
    try {
      execFileSync(bin, ['--version'], { stdio: 'ignore', env: { ...process.env, QT_QPA_PLATFORM: 'offscreen' } })
      return bin
    } catch { /* try next */ }
  }
  console.error('No encuentro MuseScore. Instálalo o indica su ruta con MSCORE=/ruta/a/mscore')
  process.exit(1)
}

function slugify(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function collect(paths) {
  return paths.flatMap(p => statSync(p).isDirectory()
    ? readdirSync(p).map(f => join(p, f))
    : [p]).filter(f => ['.mscz', '.mscx'].includes(extname(f).toLowerCase()))
}

const inputs = collect(process.argv.slice(2))
if (inputs.length === 0) {
  console.error('Uso: npm run import-scores -- <carpeta o archivo .mscz>')
  process.exit(1)
}

const mscore = findMuseScore()
mkdirSync(outDir, { recursive: true })
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : { pieces: [] }

for (const input of inputs) {
  const title = basename(input, extname(input)).replace(/_/g, ' ').trim()
  const id = slugify(title)
  const file = `local/${id}.musicxml`
  try {
    execFileSync(mscore, ['-o', join(outDir, `${id}.musicxml`), input], {
      stdio: 'ignore', env: { ...process.env, QT_QPA_PLATFORM: 'offscreen' },
    })
  } catch {
    console.error(`✗ ${title}: MuseScore no pudo convertirlo`)
    continue
  }
  index.pieces = index.pieces.filter(p => p.id !== id)
  index.pieces.push({ id, title, instrument: 'piano', file })
  console.log(`✓ ${title}`)
}

index.pieces.sort((a, b) => a.title.localeCompare(b.title, 'es'))
writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n')
console.log(`Biblioteca local: ${index.pieces.length} piezas`)
