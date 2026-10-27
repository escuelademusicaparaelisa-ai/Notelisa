#!/usr/bin/env node
// Command line entry point:  npm run importar -- <archivos o carpetas> [--titulo "…"] [--id pieza]
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { detectTools, importFile, kindOf } from './importer.mjs'

const args = process.argv.slice(2)
const option = name => {
  const i = args.indexOf(name)
  if (i === -1) return undefined
  const [, value] = args.splice(i, 2)
  return value
}
const title = option('--titulo')
const id = option('--id')
const instrument = option('--instrumento')
const verbose = args.includes('--detalles') && args.splice(args.indexOf('--detalles'), 1)

const inputs = args.flatMap(p => statSync(p).isDirectory() ? readdirSync(p).map(f => join(p, f)) : [p])
  .filter(f => kindOf(f))

if (inputs.length === 0) {
  console.log(`Uso: npm run importar -- <archivo o carpeta> [--titulo "Nombre"] [--id pieza-a-reemplazar]

Admite MusicXML (.musicxml .xml .mxl), MuseScore (.mscz .mscx), PDF y fotos (.png .jpg).
Los PDF y fotos pasan por reconocimiento óptico (Audiveris) y quedan "pendientes de revisar".`)
  process.exit(1)
}

const tools = detectTools()
console.log(`MuseScore: ${tools.mscore ?? '—'} · Audiveris: ${tools.audiveris ?? '—'} · pdftoppm: ${tools.pdftoppm ?? '—'}\n`)

let failures = 0
for (const input of inputs) {
  try {
    const pieces = await importFile(input, {
      tools, title: inputs.length === 1 ? title : undefined, id, instrument,
      onLog: verbose ? log => console.log(log) : undefined,
    })
    for (const p of pieces) {
      const state = p.review?.status === 'pending' ? ' → pendiente de revisar'
        : p.review?.status === 'failed' ? ' → ✗ el reconocimiento no dio resultado' : ''
      console.log(`✓ ${p.title}${state}`)
    }
  } catch (error) {
    failures++
    console.error(`✗ ${input}: ${error.message}`)
  }
}
console.log('\nAbre la app (npm run dev) y entra en "Revisar importaciones" para comprobar las piezas reconocidas.')
process.exit(failures ? 1 : 0)
