import { useState } from 'react'
import { formatDuration, pieceDays, practisedPieces, weeklyStudy, type PieceProgress, type PracticeLog } from '../../account/progress'
import { ChevronRight, CircleCheck, Repeat, Timer, X } from '../icons'

const shortDate = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
const longDate = (d: Date | string) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
const minutes = (seconds: number) => Math.round(seconds / 60)

/** Minutes of study in each of the last eight weeks: pieces and exercises stacked. */
export function StudyChart({ logs, title = 'Minutos de estudio por semana' }: { logs: PracticeLog[]; title?: string }) {
  const weeks = weeklyStudy(logs)
  const top = Math.max(10, ...weeks.map(w => minutes(w.pieces + w.exercises)))
  const [hover, setHover] = useState<number | null>(null)
  const W = 320, H = 150, base = H - 22, plot = base - 22, slot = W / weeks.length, bar = Math.min(26, slot - 10)
  const height = (s: number) => (minutes(s) / top) * plot

  return (
    <figure className="study-chart">
      <figcaption>
        <strong>{title}</strong>
        <span className="study-legend">
          <span><i className="swatch swatch-pieces" /> Canciones</span>
          <span><i className="swatch swatch-exercises" /> Ejercicios y escalas</span>
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${weeks.map(w => `semana del ${shortDate(w.start)}, ${formatDuration(w.pieces + w.exercises)}`).join('; ')}`}>
        <line x1={0} x2={W} y1={base} y2={base} className="study-axis" />
        {weeks.map((w, i) => {
          const x = i * slot + (slot - bar) / 2
          const hp = height(w.pieces), he = height(w.exercises)
          const total = minutes(w.pieces + w.exercises)
          const now = i === weeks.length - 1
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <title>{`Semana del ${shortDate(w.start)}: ${formatDuration(w.pieces)} de canciones, ${formatDuration(w.exercises)} de ejercicios`}</title>
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              {hp > 0 && <rect className="bar-pieces" x={x} y={base - hp} width={bar} height={hp} rx={4} />}
              {he > 0 && <rect className="bar-exercises" x={x} y={base - hp - he - (hp > 0 ? 2 : 0)} width={bar} height={he} rx={4} />}
              {(total > 0 || hover === i) && (
                <text x={x + bar / 2} y={base - hp - he - (hp > 0 && he > 0 ? 2 : 0) - 5} className={`study-value${hover === i ? ' on' : ''}`}>{total}</text>
              )}
              <text x={x + bar / 2} y={H - 6} className={`study-label${now ? ' now' : ''}`}>{now ? 'Esta sem.' : shortDate(w.start)}</text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/** Every piece practised, also the ones finished or removed, to open its progress. */
export function PractisedList({ logs, skip = new Set(), onOpen }: {
  logs: PracticeLog[]
  /** Pieces already shown elsewhere on the page. */
  skip?: Set<string>
  onOpen(pieceId: string): void
}) {
  const list = practisedPieces(logs).filter(p => !skip.has(p.pieceId))
  if (list.length === 0) return null
  return (
    <ul className="assignment-list practised-list">
      {list.map(p => (
        <li key={p.pieceId}>
          <button className="practised-row" onClick={() => onOpen(p.pieceId)}>
            <span className="assignment-title">{p.title || p.pieceId}</span>
            <ProgressFigures progress={p} />
            <span className="practised-last">{longDate(p.last)}</span>
            <ChevronRight className="practised-go" />
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Time and best result of a piece, or that it is not started. */
export function ProgressFigures({ progress }: { progress?: PieceProgress }) {
  if (!progress) return <span className="assignment-progress muted">Sin empezar</span>
  return (
    <span className="assignment-progress">
      <span><Timer /> {formatDuration(progress.seconds)}</span>
      {progress.best !== null && <span title="Mejor resultado"><CircleCheck /> {progress.best}%</span>}
    </span>
  )
}

/** One piece's progress day by day, in a window. */
export function PieceProgressDialog({ pieceId, title, logs, onClose }: { pieceId: string; title: string; logs: PracticeLog[]; onClose(): void }) {
  const days = pieceDays(logs, pieceId)
  const seconds = days.reduce((s, d) => s + d.seconds, 0)
  const attempts = days.reduce((s, d) => s + d.attempts, 0)
  const bests = days.map(d => d.best).filter((b): b is number => b !== null)
  const shown = days.slice(-12)
  const top = Math.max(5, ...shown.map(d => minutes(d.seconds)))
  const W = 320, H = 150, base = H - 22, plot = base - 22, slot = W / Math.max(shown.length, 6), bar = Math.min(26, slot - 10)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal piece-history" role="dialog" aria-label={`Progreso de ${title}`} onClick={e => e.stopPropagation()}>
        <button className="chip modal-close" onClick={onClose} aria-label="Cerrar"><X /></button>
        <h2>{title}</h2>
        {days.length === 0 ? <p>Todavía no se ha estudiado con la app.</p> : <>
          <p className="teacher-progress">
            <span><Timer /> En total: <strong>{formatDuration(seconds)}</strong></span>
            <span><Repeat /> Terminada: <strong>{attempts === 1 ? '1 vez' : `${attempts} veces`}</strong></span>
            {bests.length > 0 && <span><CircleCheck /> Mejor: <strong>{Math.max(...bests)}%</strong></span>}
          </p>
          <figure className="study-chart">
            <figcaption><strong>Minutos cada día que la estudió</strong>{days.length > shown.length && <small>Los últimos {shown.length} días</small>}</figcaption>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={shown.map(d => `${shortDate(d.day)}: ${formatDuration(d.seconds)}${d.best !== null ? `, ${d.best}%` : ''}`).join('; ')}>
              <line x1={0} x2={W} y1={base} y2={base} className="study-axis" />
              {shown.map((d, i) => {
                const x = i * slot + (slot - bar) / 2
                const h = (minutes(d.seconds) / top) * plot
                return (
                  <g key={i}>
                    <title>{`${longDate(d.day)}: ${formatDuration(d.seconds)}${d.best !== null ? ` · mejor resultado ${d.best}%` : ''}`}</title>
                    <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
                    {h > 0 && <rect className="bar-pieces" x={x} y={base - h} width={bar} height={h} rx={4} />}
                    <text x={x + bar / 2} y={base - h - 5} className="study-value">{minutes(d.seconds)}</text>
                    <text x={x + bar / 2} y={H - 6} className="study-label">{shortDate(d.day)}</text>
                  </g>
                )
              })}
            </svg>
          </figure>
          <table className="piece-days">
            <thead><tr><th>Día</th><th>Tiempo</th><th>Terminada</th><th>Mejor</th></tr></thead>
            <tbody>
              {[...days].reverse().map(d => (
                <tr key={d.day.getTime()}>
                  <td>{shortDate(d.day)}</td>
                  <td>{formatDuration(d.seconds)}</td>
                  <td>{d.attempts ? (d.attempts === 1 ? '1 vez' : `${d.attempts} veces`) : '—'}</td>
                  <td>{d.best !== null ? `${d.best}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>}
      </section>
    </div>
  )
}
