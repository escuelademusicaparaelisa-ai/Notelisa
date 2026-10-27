import { describe, expect, it } from 'vitest'
import { summarize } from './summary'
import type { MeasureStats } from './waitSession'

const stats = (entries: [number, Partial<MeasureStats>][]) =>
  new Map(entries.map(([m, s]) => [m, { correct: 0, wrong: 0, missed: 0, offTime: 0, ...s }]))

describe('summarize', () => {
  it('gives three stars to a perfect run', () => {
    const s = summarize(stats([[0, { correct: 8 }], [1, { correct: 8 }]]), true)
    expect(s).toMatchObject({ accuracy: 100, rhythm: 100, stars: 3, problemMeasures: [] })
  })

  it('computes accuracy and rhythm in tempo mode', () => {
    const s = summarize(stats([[0, { correct: 6, missed: 2, offTime: 3 }], [1, { correct: 2 }]]), true)
    expect(s.accuracy).toBe(80)
    expect(s.rhythm).toBe(63)
    expect(s.stars).toBe(2)
  })

  it('has no rhythm score in wait mode', () => {
    const s = summarize(stats([[0, { correct: 3, wrong: 1 }]]), false)
    expect(s).toMatchObject({ accuracy: 75, rhythm: null, stars: 2 })
  })

  it('lists the three worst measures, worst first', () => {
    const s = summarize(stats([
      [0, { correct: 4, wrong: 1 }],
      [1, { correct: 4, offTime: 1 }],
      [2, { correct: 2, missed: 3 }],
      [3, { correct: 4, wrong: 2 }],
      [4, { correct: 4 }],
    ]), true)
    expect(s.problemMeasures).toEqual([2, 3, 0])
  })

  it('always gives at least one star', () => {
    expect(summarize(stats([[0, { wrong: 5 }]]), false).stars).toBe(1)
  })
})
