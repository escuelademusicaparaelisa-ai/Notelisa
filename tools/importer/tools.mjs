// Locates and runs the external programs: MuseScore, Audiveris and Poppler (pdftoppm).
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const HEADLESS_ENV = { ...process.env, QT_QPA_PLATFORM: 'offscreen' }

function works(bin, args) {
  try {
    execFileSync(bin, args, { stdio: 'ignore', env: HEADLESS_ENV, timeout: 60_000 })
    return true
  } catch {
    return false
  }
}

function find(envVar, candidates, probeArgs) {
  const list = [process.env[envVar], ...candidates].filter(Boolean)
  return list.find(bin => (bin.includes('/') || bin.includes('\\') ? existsSync(bin) : true) && works(bin, probeArgs)) ?? null
}

export function findMuseScore() {
  return find('MSCORE', [
    'mscore4portable', 'mscore', 'mscore3', 'musescore', 'MuseScore4',
    '/Applications/MuseScore 4.app/Contents/MacOS/mscore',
    'C:\\Program Files\\MuseScore 4\\bin\\MuseScore4.exe',
  ], ['--version'])
}

export function findAudiveris() {
  return find('AUDIVERIS', [
    'audiveris', 'Audiveris',
    '/opt/audiveris/bin/Audiveris',
    '/Applications/Audiveris.app/Contents/MacOS/Audiveris',
    'C:\\Program Files\\Audiveris\\Audiveris.exe',
    'C:\\Program Files\\Audiveris\\bin\\Audiveris.bat',
  ], ['-help'])
}

export function findPdftoppm() {
  return find('PDFTOPPM', ['pdftoppm'], ['-v'])
}

export function convertWithMuseScore(mscore, input, output) {
  execFileSync(mscore, ['-o', output, input], { stdio: 'ignore', env: HEADLESS_ENV, timeout: 120_000 })
}

/** Renders every PDF page to PNG at the given resolution; returns the page files in order. */
export function renderPdf(pdftoppm, pdf, outDir, dpi = 300) {
  mkdirSync(outDir, { recursive: true })
  execFileSync(pdftoppm, ['-r', String(dpi), '-png', pdf, join(outDir, 'page')], { stdio: 'ignore' })
  return readdirSync(outDir).filter(f => /^page-\d+\.png$/.test(f))
    .sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5)))
    .map(f => join(outDir, f))
}

/**
 * Runs Audiveris in batch mode and returns the MusicXML files it produced.
 * Audiveris names its outputs after the input and may write one file per movement,
 * so we collect every .mxl under the output folder.
 */
export function recognise(audiveris, image, outDir) {
  mkdirSync(outDir, { recursive: true })
  const result = spawnSync(audiveris, ['-batch', '-export', '-output', outDir, '--', image], {
    encoding: 'utf8', env: HEADLESS_ENV, timeout: 600_000,
  })
  const files = findFiles(outDir, /\.mxl$/i)
  return { files, log: `${result.stdout ?? ''}\n${result.stderr ?? ''}`, ok: result.status === 0 && files.length > 0 }
}

function findFiles(dir, pattern) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? findFiles(path, pattern) : pattern.test(name) ? [path] : []
  }).sort()
}
