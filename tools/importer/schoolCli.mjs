#!/usr/bin/env node
// Command line:  npm run biblioteca-escuela -- --clave "clave de la escuela"
import { publishSchoolLibrary } from './schoolLibrary.mjs'

const args = process.argv.slice(2)
const i = args.indexOf('--clave')
const password = i === -1 ? undefined : args[i + 1]
if (!password) {
  console.log(`Uso: npm run biblioteca-escuela -- --clave "clave de la escuela"

Cifra las piezas aprobadas de tu biblioteca (public/library/index.local.json) en
public/library/school/. Esa carpeta se puede publicar: sin la clave no se puede leer.
Con la misma clave, los alumnos no tienen que volver a escribirla. Con una clave nueva
(o con --nueva-llave) las claves anteriores dejan de valer.`)
  process.exit(1)
}

const pieces = await publishSchoolLibrary({ escuela: password }, { newKey: args.includes('--nueva-llave') })
console.log(`✅ Biblioteca de la escuela cifrada con ${pieces.length} piezas:`)
for (const p of pieces) console.log(`   · ${p.title}`)
