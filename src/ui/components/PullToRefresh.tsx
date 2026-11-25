import { RotateCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PULL_THRESHOLD, canStartPull, pullDistance } from './pullToRefresh'

/**
 * Reloads the app when the finger pulls down about 4 cm from the top of the page.
 * The installed app has no browser bar, so this is the way to reload it on a phone or tablet.
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0)
  const [reloading, setReloading] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const current = useRef(0)

  useEffect(() => {
    const show = (distance: number) => {
      current.current = distance
      setPull(distance)
    }
    const onStart = (e: TouchEvent) => {
      start.current = e.touches.length === 1 && canStartPull(e.target as Element) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null
      show(0)
    }
    const onMove = (e: TouchEvent) => {
      if (!start.current) return
      if (e.touches.length !== 1) { start.current = null; show(0); return }
      const dy = e.touches[0].clientY - start.current.y
      const dx = e.touches[0].clientX - start.current.x
      // Moving up first means the person is scrolling, not pulling.
      if (dy < -10) { start.current = null; show(0); return }
      const distance = pullDistance(dy, dx)
      // Keeps the page from bouncing while the indicator follows the finger.
      if (distance > 0 && e.cancelable) e.preventDefault()
      show(distance)
    }
    const onEnd = () => {
      if (start.current && current.current >= PULL_THRESHOLD) {
        setReloading(true)
        window.location.reload()
      } else show(0)
      start.current = null
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  if (!pull && !reloading) return null
  const ready = reloading || pull >= PULL_THRESHOLD
  const progress = Math.min(pull / PULL_THRESHOLD, 1)
  const offset = reloading ? 0.5 * PULL_THRESHOLD : Math.min(pull, PULL_THRESHOLD) * 0.5
  return (
    <div className={`pull-refresh${ready ? ' ready' : ''}${reloading ? ' reloading' : ''}`} role="status"
      aria-label={ready ? 'Suelta para recargar' : 'Desliza para recargar'}
      style={{ transform: `translate(-50%, ${offset}px)`, opacity: reloading ? 1 : progress }}>
      <RotateCw style={{ transform: reloading ? undefined : `rotate(${progress * 270}deg)` }} />
    </div>
  )
}
