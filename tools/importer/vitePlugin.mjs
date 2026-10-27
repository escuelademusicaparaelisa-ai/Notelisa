// Development-only endpoints so the review screen can save decisions on the
// teacher's computer (the published app is static and cannot write files).
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { importFile, kindOf } from './importer.mjs'
import { readIndex, setReviewStatus, writeIndex } from './library.mjs'

const STATUSES = new Set(['pending', 'approved', 'rejected'])

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export function notelisaReviewPlugin() {
  return {
    name: 'notelisa-review',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__notelisa/', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        const url = new URL(req.url ?? '', 'http://localhost')
        const [action, id] = url.pathname.split('/').filter(Boolean)
        try {
          if (action === 'review') {
            const { status } = JSON.parse((await readBody(req)).toString('utf8'))
            if (!STATUSES.has(status)) return send(res, 400, { error: 'Estado no válido' })
            writeIndex(setReviewStatus(readIndex(), id, status))
            return send(res, 200, { ok: true })
          }
          if (action === 'replace') {
            // A corrected file (MusicXML or MuseScore) replaces the recognised piece.
            const filename = basename(decodeURIComponent(String(req.headers['x-filename'] ?? '')))
            if (!kindOf(filename) || ['pdf', 'image'].includes(kindOf(filename))) {
              return send(res, 400, { error: 'Usa un archivo MusicXML (.musicxml, .mxl) o MuseScore (.mscz)' })
            }
            const dir = mkdtempSync(join(tmpdir(), 'notelisa-upload-'))
            try {
              const path = join(dir, filename)
              writeFileSync(path, await readBody(req))
              await importFile(path, { id })
            } finally {
              rmSync(dir, { recursive: true, force: true })
            }
            return send(res, 200, { ok: true })
          }
          return next()
        } catch (error) {
          return send(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      })
    },
  }
}
