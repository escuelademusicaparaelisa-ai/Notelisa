import { join, resolve } from 'node:path'

export const ROOT = resolve(import.meta.dirname, '../..')
export const LIBRARY_DIR = join(ROOT, 'public/library')
export const LOCAL_DIR = join(LIBRARY_DIR, 'local')
export const REVIEW_DIR = join(LOCAL_DIR, 'review')
export const LOCAL_INDEX = join(LIBRARY_DIR, 'index.local.json')
