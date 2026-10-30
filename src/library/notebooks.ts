// Notebooks: the teacher's own lists of pieces from the library ("Nivel 1", "Navidad"…).
// A piece can be in any number of notebooks. They are kept on this device.

export interface Notebook {
  id: string
  name: string
  /** Pieces in the order they were added. */
  pieceIds: string[]
  /** Made by the administrator for every teacher (with accounts). */
  school?: boolean
  /** Someone else's notebook: it can be used but not changed. */
  readOnly?: boolean
}

/** Where notebooks are kept: on this device, or on the school's server with accounts. */
export interface NotebookStore {
  load(): Promise<Notebook[]>
  save(notebook: Notebook): Promise<void>
  remove(id: string): Promise<void>
}

export const deviceNotebooks: NotebookStore = {
  load: async () => savedNotebooks(),
  save: async notebook => saveNotebooks(upsertNotebook(savedNotebooks(), notebook)),
  remove: async id => saveNotebooks(removeNotebook(savedNotebooks(), id)),
}

const NOTEBOOKS_KEY = 'notelisa.notebooks'

export function savedNotebooks(): Notebook[] {
  try {
    const saved = localStorage.getItem(NOTEBOOKS_KEY)
    if (!saved) return []
    const parsed = JSON.parse(saved) as Notebook[]
    return Array.isArray(parsed) ? parsed.filter(n => n && typeof n.id === 'string' && Array.isArray(n.pieceIds)) : []
  } catch {
    return []
  }
}

export function saveNotebooks(notebooks: Notebook[]): void {
  try {
    if (notebooks.length === 0) localStorage.removeItem(NOTEBOOKS_KEY)
    else localStorage.setItem(NOTEBOOKS_KEY, JSON.stringify(notebooks))
  } catch {
    // Private browsing: the notebooks last until the page is closed.
  }
}

/** Adds the notebook, or replaces the one with the same id. */
export function upsertNotebook(notebooks: Notebook[], notebook: Notebook): Notebook[] {
  const name = notebook.name.trim()
  const clean = { ...notebook, name, pieceIds: [...new Set(notebook.pieceIds)] }
  return notebooks.some(n => n.id === notebook.id)
    ? notebooks.map(n => (n.id === notebook.id ? clean : n))
    : [...notebooks, clean]
}

export function removeNotebook(notebooks: Notebook[], id: string): Notebook[] {
  return notebooks.filter(n => n.id !== id)
}

/** Adds the piece at the end, or takes it out if it was already there. */
export function togglePiece(pieceIds: string[], pieceId: string): string[] {
  return pieceIds.includes(pieceId) ? pieceIds.filter(id => id !== pieceId) : [...pieceIds, pieceId]
}

export function newNotebookId(): string {
  return `notebook:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
