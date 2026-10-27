import type { PracticeSummary } from '../../core/practice/summary'
import { Repeat, RotateCcw, StarFilled } from '../icons'

interface Props {
  summary: PracticeSummary
  onPracticeMeasure(measure: number): void
  onAgain(): void
  onClose(): void
}

const PRAISE = ['¡Sigue practicando, vas por buen camino!', '¡Muy bien!', '¡Genial, casi perfecto!', '¡Perfecto!']

/** End-of-exercise results: stars, percentages and the measures to practise. */
export function SummaryCard({ summary, onPracticeMeasure, onAgain, onClose }: Props) {
  const perfect = summary.accuracy === 100 && (summary.rhythm ?? 100) === 100
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="summary-title">
      <div className="modal summary">
        <p className="stars" aria-label={`${summary.stars} de 3 estrellas`}>
          {[1, 2, 3].map(n => <StarFilled key={n} className={n <= summary.stars ? 'on' : ''} />)}
        </p>
        <h2 id="summary-title">{PRAISE[perfect ? 3 : summary.stars - 1]}</h2>
        <div className="summary-scores">
          <div>
            <b>{summary.accuracy}%</b>
            <span>notas correctas</span>
          </div>
          {summary.rhythm !== null && summary.correct > 0 && (
            <div>
              <b>{summary.rhythm}%</b>
              <span>a tiempo</span>
            </div>
          )}
        </div>
        <p className="summary-detail">
          {summary.correct} bien · {summary.wrong} {summary.wrong === 1 ? 'equivocada' : 'equivocadas'}
          {summary.rhythm !== null && <> · {summary.missed} sin tocar</>}
        </p>
        {summary.problemMeasures.length > 0 && (
          <div className="summary-problems">
            <p>Los compases que más cuestan:</p>
            <div className="modal-actions">
              {summary.problemMeasures.map(m => (
                <button key={m} className="chip" onClick={() => onPracticeMeasure(m)}><Repeat /> Practicar compás {m + 1}</button>
              ))}
            </div>
          </div>
        )}
        <div className="modal-actions">
          <button className="big-button primary" onClick={onAgain}><RotateCcw /> Otra vez</button>
          <button className="chip" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
