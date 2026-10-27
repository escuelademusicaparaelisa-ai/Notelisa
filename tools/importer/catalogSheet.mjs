// The teacher's Excel sheet with the details of every score (datos-partituras.xlsx).
import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'

export const SHEET_NAME = 'datos-partituras.xlsx'

const COLUMNS = [
  { key: 'file', header: 'Archivo', width: 42 },
  { key: 'title', header: 'Título', width: 40 },
  { key: 'composer', header: 'Compositor', width: 28 },
  { key: 'arranger', header: 'Arreglista', width: 28 },
  { key: 'instrument', header: 'Instrumento', width: 14 },
  { key: 'level', header: 'Nivel (1-5)', width: 12 },
  { key: 'publish', header: 'Publicar', width: 10 },
]

// Spanish names in the sheet ↔ instrument ids in the app.
const INSTRUMENTS = { piano: 'Piano', flute: 'Flauta' }

export function instrumentId(name) {
  const text = String(name ?? '').trim().toLowerCase()
  if (/^fl/.test(text)) return 'flute'
  return 'piano'
}

function cellText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && 'richText' in value) return value.richText.map(r => r.text).join('')
  if (typeof value === 'object' && 'text' in value) return String(value.text)
  return String(value).trim()
}

/** Rows of the sheet as { file, title, composer, arranger, instrument, level, publish }. */
export async function readSheet(path) {
  if (!existsSync(path)) return []
  const book = new ExcelJS.Workbook()
  await book.xlsx.readFile(path)
  const sheet = book.worksheets[0]
  const rows = []
  sheet.eachRow((row, number) => {
    if (number === 1) return
    const value = i => cellText(row.getCell(i + 1).value)
    const file = value(0)
    if (!file) return
    const level = parseInt(value(5), 10)
    rows.push({
      file: file.normalize('NFC'),
      title: value(1),
      composer: value(2),
      arranger: value(3),
      instrument: instrumentId(value(4)),
      level: level >= 1 && level <= 5 ? level : undefined,
      publish: !/^n/i.test(value(6)),
    })
  })
  return rows
}

export async function writeSheet(path, rows) {
  const book = new ExcelJS.Workbook()
  const sheet = book.addWorksheet('Partituras')
  sheet.columns = COLUMNS
  sheet.getRow(1).font = { bold: true }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  for (const row of rows) {
    sheet.addRow({
      ...row,
      instrument: INSTRUMENTS[row.instrument] ?? 'Piano',
      level: row.level ?? '',
      publish: row.publish === false ? 'no' : 'sí',
    })
  }
  const last = rows.length + 1
  sheet.dataValidations.add(`E2:E${Math.max(last, 2)}`, { type: 'list', allowBlank: false, formulae: ['"Piano,Flauta"'] })
  sheet.dataValidations.add(`G2:G${Math.max(last, 2)}`, { type: 'list', allowBlank: false, formulae: ['"sí,no"'] })
  await book.xlsx.writeFile(path)
}
