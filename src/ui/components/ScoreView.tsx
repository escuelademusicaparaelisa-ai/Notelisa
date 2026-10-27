import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ScoreController } from '../../core/score/ScoreController'
import type { Timeline } from '../../core/score/timeline'

export interface ScoreViewHandle {
  goTo(step: number): void
  setZoom(zoom: number): void
  colorCurrent(midis: readonly number[], color: string): void
  colorStep(step: number, midis: readonly number[], color: string): void
  clearColors(): void
}

interface Props {
  source: string
  onLoaded(timeline: Timeline): void
}

export const ScoreView = forwardRef<ScoreViewHandle, Props>(function ScoreView({ source, onLoaded }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<ScoreController | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useImperativeHandle(ref, () => ({
    goTo: step => controllerRef.current?.goTo(step),
    setZoom: zoom => controllerRef.current?.setZoom(zoom),
    colorCurrent: (midis, color) => controllerRef.current?.colorCurrent(midis, color),
    colorStep: (step, midis, color) => controllerRef.current?.colorStep(step, midis, color),
    clearColors: () => controllerRef.current?.clearColors(),
  }), [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    const controller = new ScoreController(container)
    controllerRef.current = controller
    setStatus('loading')
    controller.load(source)
      .then(timeline => {
        if (cancelled) return
        setStatus('ready')
        onLoaded(timeline)
      })
      .catch(error => {
        console.error(error)
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
      controller.dispose()
      controllerRef.current = null
    }
    // onLoaded is intentionally not a dependency: reload only when the score changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  return (
    <div className="score-view">
      {status === 'loading' && <p className="score-message">Cargando partitura…</p>}
      {status === 'error' && <p className="score-message error">No se ha podido abrir esta partitura.</p>}
      <div ref={containerRef} className="score-canvas" />
    </div>
  )
})
