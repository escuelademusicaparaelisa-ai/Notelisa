import { useCallback, useEffect, useRef } from 'react'
import type { PracticeSummary } from '../core/practice/summary'
import { MIN_SECONDS, savePractice, type NewPracticeLog } from './progress'

interface Running {
  start: number
  attempts: number
  best: number | null
  rhythm: number | null
}

const fresh = (): Running => ({ start: Date.now(), attempts: 0, best: null, rhythm: null })

/**
 * Saves how long a student spends on a piece and how well it went. Time counts while
 * the screen is open and visible; it is saved on leaving, or when the app goes to the
 * background (so closing the app does not lose it). Returns what to call with each
 * end-of-piece summary.
 */
export function usePracticeLog(piece: { id: string; title: string }, kind: NewPracticeLog['kind'], enabled: boolean): (summary: PracticeSummary) => void {
  const running = useRef<Running>(fresh())

  useEffect(() => {
    if (!enabled) return
    running.current = fresh()
    const flush = () => {
      const r = running.current
      running.current = fresh()
      const seconds = (Date.now() - r.start) / 1000
      if (seconds < MIN_SECONDS && r.attempts === 0) return
      savePractice({
        piece_id: kind === 'exercise' ? `exercise:${piece.title}` : piece.id, piece_title: piece.title, kind,
        seconds, attempts: r.attempts, best_accuracy: r.best, best_rhythm: r.rhythm,
      }).catch(() => {
        // Without connection this bit of practice is not saved; the app keeps working.
      })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
      else running.current = fresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
  }, [enabled, kind, piece.id, piece.title])

  return useCallback((summary: PracticeSummary) => {
    const r = running.current
    r.attempts += 1
    r.best = Math.max(r.best ?? 0, summary.accuracy)
    if (summary.rhythm !== null) r.rhythm = Math.max(r.rhythm ?? 0, summary.rhythm)
  }, [])
}
