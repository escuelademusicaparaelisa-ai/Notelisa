import type { Piece } from '../library/catalog'
import type { Notebook } from '../library/notebooks'
import { server, type Profile } from './account'
import { byName } from './admin'

// The pieces each teacher gives their students: as homework, or open to play for fun.

export interface Assignment {
  id: number
  student_id: string
  teacher_id: string | null
  piece_id: string
  piece_title: string
  /** Where it came from: «Cuaderno Navidad», «Nivel 2»… or empty when chosen on its own. */
  source: string
  homework: boolean
  created_at: string
}

/** What the teacher ticked: whole notebooks, whole levels and single pieces. */
export interface Selection {
  notebookIds: string[]
  levels: number[]
  pieceIds: string[]
}

export const EMPTY_SELECTION: Selection = { notebookIds: [], levels: [], pieceIds: [] }

/**
 * The pieces a selection stands for, each once, with where it came from (a notebook
 * first, then a level). Levels take their pieces from levelPieces, so an instrument
 * filter can narrow them.
 */
export function selectedPieces(selection: Selection, pieces: Piece[], notebooks: Notebook[], levelPieces: Piece[] = pieces): { piece: Piece; source: string }[] {
  const byId = new Map(pieces.map(p => [p.id, p]))
  const chosen = new Map<string, { piece: Piece; source: string }>()
  const add = (piece: Piece | undefined, source: string) => {
    if (piece && !chosen.has(piece.id)) chosen.set(piece.id, { piece, source })
  }
  for (const notebook of notebooks.filter(n => selection.notebookIds.includes(n.id))) {
    for (const id of notebook.pieceIds) add(byId.get(id), `Cuaderno ${notebook.name}`)
  }
  for (const level of [...selection.levels].sort((a, b) => a - b)) {
    for (const piece of levelPieces.filter(p => p.level === level)) add(piece, `Nivel ${level}`)
  }
  for (const id of selection.pieceIds) add(byId.get(id), '')
  return [...chosen.values()]
}

/** Students the teacher looks after; the administrator looks after all of them. */
export async function myStudents(me: Profile): Promise<Profile[]> {
  const supabase = server()
  let query = supabase.from('profiles').select('*').eq('role', 'student').eq('status', 'approved')
  if (me.role !== 'admin') {
    const { data, error } = await supabase.from('teacher_students').select('student_id').eq('teacher_id', me.id)
    if (error) throw error
    query = query.in('id', (data ?? []).map(row => row.student_id as string))
  }
  const { data, error } = await query
  if (error) throw error
  return (data as Profile[]).sort(byName)
}

export async function loadAssignments(studentIds: string[]): Promise<Assignment[]> {
  if (studentIds.length === 0) return []
  const { data, error } = await server().from('assignments').select('*').in('student_id', studentIds).order('created_at')
  if (error) throw error
  return data as Assignment[]
}

/** Gives the pieces to the student; pieces they already had take the new homework mark. */
export async function assign(me: Profile, studentId: string, chosen: { piece: Piece; source: string }[], homework: boolean): Promise<Assignment[]> {
  const rows = chosen.map(({ piece, source }) => ({
    student_id: studentId, teacher_id: me.id, piece_id: piece.id, piece_title: piece.title, source, homework,
  }))
  const { data, error } = await server().from('assignments').upsert(rows, { onConflict: 'student_id,piece_id' }).select('*')
  if (error) throw error
  return data as Assignment[]
}

export async function setHomework(id: number, homework: boolean): Promise<void> {
  const { error } = await server().from('assignments').update({ homework }).eq('id', id)
  if (error) throw error
}

export async function unassign(id: number): Promise<void> {
  const { error } = await server().from('assignments').delete().eq('id', id)
  if (error) throw error
}
