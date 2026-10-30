import { server } from './account'

// What each student practises: time on each piece or exercise and the best result.

export interface PracticeLog {
  student_id: string
  piece_id: string
  piece_title: string
  kind: 'piece' | 'exercise'
  seconds: number
  attempts: number
  best_accuracy: number | null
  best_rhythm: number | null
  created_at: string
}

export type NewPracticeLog = Pick<PracticeLog, 'piece_id' | 'piece_title' | 'kind' | 'seconds' | 'attempts' | 'best_accuracy' | 'best_rhythm'>

export interface PieceProgress {
  seconds: number
  /** Times the piece was played to the end. */
  attempts: number
  best: number | null
  last: string
}

/** Practice is only saved from a few seconds on; longer than an hour counts as an hour (the screen was left open). */
export const MIN_SECONDS = 5
export const MAX_SECONDS = 60 * 60

export async function savePractice(log: NewPracticeLog): Promise<void> {
  const { error } = await server().from('practice_log').insert({ ...log, seconds: Math.min(Math.round(log.seconds), MAX_SECONDS) })
  if (error) throw error
}

export async function loadPractice(studentIds: string[]): Promise<PracticeLog[]> {
  if (studentIds.length === 0) return []
  const { data, error } = await server().from('practice_log').select('*').in('student_id', studentIds).order('created_at')
  if (error) throw error
  return data as PracticeLog[]
}

/** Total time, attempts and best accuracy of each piece, for one student. */
export function progressByPiece(logs: PracticeLog[]): Map<string, PieceProgress> {
  const result = new Map<string, PieceProgress>()
  for (const log of logs) {
    const p = result.get(log.piece_id) ?? { seconds: 0, attempts: 0, best: null, last: log.created_at }
    p.seconds += log.seconds
    p.attempts += log.attempts
    if (log.best_accuracy !== null) p.best = Math.max(p.best ?? 0, log.best_accuracy)
    if (log.created_at > p.last) p.last = log.created_at
    result.set(log.piece_id, p)
  }
  return result
}

/** Seconds practised from the given moment on. */
export function secondsSince(logs: PracticeLog[], since: Date): number {
  const from = since.toISOString()
  return logs.filter(l => l.created_at >= from).reduce((sum, l) => sum + l.seconds, 0)
}

/** Monday 00:00 of this week, local time. */
export function startOfWeek(now = new Date()): Date {
  const day = (now.getDay() + 6) % 7
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day)
}

/** «45 min», «1 h 20 min», «menos de 1 min». */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 1) return seconds > 0 ? 'menos de 1 min' : '0 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}
