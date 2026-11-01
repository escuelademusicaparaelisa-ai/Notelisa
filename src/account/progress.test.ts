import { describe, expect, it } from 'vitest'
import { formatDuration, pieceDays, practisedPieces, progressByPiece, secondsSince, startOfWeek, weeklyStudy, type PracticeLog } from './progress'

const log = (piece_id: string, seconds: number, best_accuracy: number | null, created_at: string, attempts = 1): PracticeLog =>
  ({ student_id: 's', piece_id, piece_title: piece_id, kind: 'piece', seconds, attempts, best_accuracy, best_rhythm: null, created_at })

describe('progressByPiece', () => {
  it('adds up time and keeps the best accuracy and the last day', () => {
    const p = progressByPiece([log('a', 60, 70, '2026-10-01'), log('a', 120, null, '2026-10-03', 0), log('a', 30, 90, '2026-10-02'), log('b', 10, null, '2026-10-01', 0)])
    expect(p.get('a')).toEqual({ title: 'a', seconds: 210, attempts: 2, best: 90, last: '2026-10-03' })
    expect(p.get('b')).toEqual({ title: 'b', seconds: 10, attempts: 0, best: null, last: '2026-10-01' })
  })
})

it('counts the time since a moment', () => {
  expect(secondsSince([log('a', 60, null, '2026-10-01T10:00:00.000Z'), log('a', 30, null, '2026-10-05T10:00:00.000Z')], new Date('2026-10-03T00:00:00Z'))).toBe(30)
})

it('starts the week on Monday', () => {
  const monday = startOfWeek(new Date(2026, 9, 30, 15))
  expect([monday.getDate(), monday.getDay(), monday.getHours()]).toEqual([26, 1, 0])
  expect(startOfWeek(new Date(2026, 10, 1)).getDate()).toBe(26)
})

it('writes durations simply', () => {
  expect(formatDuration(0)).toBe('0 min')
  expect(formatDuration(20)).toBe('menos de 1 min')
  expect(formatDuration(45 * 60)).toBe('45 min')
  expect(formatDuration(80 * 60)).toBe('1 h 20 min')
  expect(formatDuration(120 * 60)).toBe('2 h')
})

it('lists every piece practised, the most recent first, without exercises', () => {
  const ex = { ...log('exercise:Escala', 60, null, '2026-10-09'), kind: 'exercise' as const }
  const list = practisedPieces([log('a', 60, 70, '2026-10-01'), log('b', 30, null, '2026-10-05'), ex])
  expect(list.map(p => p.pieceId)).toEqual(['b', 'a'])
})

it('adds up each week, pieces and exercises apart', () => {
  const now = new Date(2026, 9, 30, 12)
  const ex = { ...log('exercise:Escala', 40, null, new Date(2026, 9, 27, 9).toISOString()), kind: 'exercise' as const }
  const weeks = weeklyStudy([
    log('a', 60, null, new Date(2026, 9, 26, 0, 30).toISOString()),
    log('a', 30, null, new Date(2026, 9, 25, 23).toISOString()),
    log('a', 99, null, new Date(2026, 8, 1).toISOString()),
    ex,
  ], 3, now)
  expect(weeks.map(w => [w.start.getDate(), w.pieces, w.exercises])).toEqual([[12, 0, 0], [19, 30, 0], [26, 60, 40]])
})

it('follows one piece day by day', () => {
  const days = pieceDays([
    log('a', 60, 70, new Date(2026, 9, 1, 10).toISOString()),
    log('a', 30, 80, new Date(2026, 9, 1, 18).toISOString(), 2),
    log('b', 30, 90, new Date(2026, 9, 1, 18).toISOString()),
    log('a', 20, null, new Date(2026, 9, 3, 18).toISOString(), 0),
  ], 'a')
  expect(days.map(d => [d.day.getDate(), d.seconds, d.attempts, d.best])).toEqual([[1, 90, 3, 80], [3, 20, 0, null]])
})
