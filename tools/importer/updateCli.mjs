#!/usr/bin/env node
// Command line:  npm run actualizar-biblioteca -- <carpeta de partituras> --clave "clave de la escuela"
import { updateLibrary } from './updateLibrary.mjs'

const args = process.argv.slice(2)
const i = args.indexOf('--clave')
const password = i === -1 ? undefined : args.splice(i, 2)[1]
const folder = args[0]
if (!folder || !password) {
  console.log(`Uso: npm run actualizar-biblioteca -- <carpeta de partituras> --clave "clave de la escuela"

Convierte todas las partituras de la carpeta (MuseScore o MusicXML), aplica los datos de
la hoja datos-partituras.xlsx de esa carpeta (título, compositor, arreglista, instrumento,
nivel, publicar), la actualiza con las partituras nuevas y publica la biblioteca cifrada.`)
  process.exit(1)
}

const result = await updateLibrary(folder, password, { onLog: line => console.log(line) })
console.log(`\n✅ ${result.published.length} piezas publicadas.`)
if (result.added.length) console.log(`Nuevas en la hoja: ${result.added.join(', ')}`)
if (result.freeLevels) console.log(`Partituras libres con título o nivel cambiado: ${result.freeLevels}`)
if (result.removed.length) console.log(`Quitadas (ya no están en la carpeta): ${result.removed.join(', ')}`)
if (result.failed.length) {
  console.log('No se han podido convertir:')
  for (const f of result.failed) console.log(`   · ${f.file}: ${f.reason}`)
  process.exitCode = 1
}
