import { describe, expect, it } from 'vitest'
import {
  exerciseToMusicXml, generateExercise, KEYS, measureLength, rhythmForMeasure, seededRandom,
  type ExerciseOptions, type RhythmLevel, type TimeSignature,
} from './generator'

const BASE: ExerciseOptions = {
  kind: 'reading', instrument: 'piano', clef: 'treble', key: 'C', time: '4/4', rhythm: 2, rests: false, range: 1, measures: 8, minor: 'harmonic',
}
const TIMES: TimeSignature[] = ['2/4', '3/4', '4/4', '6/8']
const LEVELS: RhythmLevel[] = [1, 2, 3, 4]

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

describe('rhythmForMeasure', () => {
  it('always fills the measure exactly', () => {
    const random = seededRandom(1)
    for (const time of TIMES) {
      for (const level of LEVELS) {
        for (let i = 0; i < 50; i++) expect(sum(rhythmForMeasure(time, level, random))).toBe(measureLength(time))
      }
    }
  })

  it('uses only long figures at level 1 in 4/4', () => {
    const random = seededRandom(2)
    for (let i = 0; i < 50; i++) {
      for (const d of rhythmForMeasure('4/4', 1, random)) expect([8, 16]).toContain(d)
    }
  })

  it('has no sixteenths below level 4', () => {
    const random = seededRandom(3)
    for (const time of TIMES) {
      for (let i = 0; i < 50; i++) expect(rhythmForMeasure(time, 3, random)).not.toContain(1)
    }
  })
})

describe('generateExercise', () => {
  it('is the same for the same seed and different for another', () => {
    const a = exerciseToMusicXml(generateExercise({ ...BASE, rhythm: 3 }, 7))
    expect(exerciseToMusicXml(generateExercise({ ...BASE, rhythm: 3 }, 7))).toBe(a)
    expect(exerciseToMusicXml(generateExercise({ ...BASE, rhythm: 3 }, 8))).not.toBe(a)
  })

  it('fills every measure of every staff and ends on the tonic', () => {
    for (const time of TIMES) {
      for (const clef of ['treble', 'bass', 'grand'] as const) {
        for (const key of KEYS) {
          const exercise = generateExercise({ ...BASE, time, clef, key: key.id, rhythm: 4, rests: true, range: 3 }, 11)
          for (const staff of exercise.staves) {
            expect(staff.measures).toHaveLength(8)
            for (const measure of staff.measures) expect(sum(measure.map(e => e.duration))).toBe(measureLength(time))
            const notes = staff.measures.flat().filter(e => e.degree !== null)
            expect(((notes[notes.length - 1].degree! % 7) + 7) % 7).toBe(0)
          }
        }
      }
    }
  })

  it('keeps five-note exercises between the tonic and the fifth', () => {
    const exercise = generateExercise({ ...BASE, rhythm: 4 }, 5)
    const midis = exercise.staves[0].measures.flat().flatMap(e => (e.midi === null ? [] : [e.midi]))
    expect(Math.min(...midis)).toBeGreaterThanOrEqual(60)
    expect(Math.max(...midis)).toBeLessThanOrEqual(67)
  })

  it('keeps the flute in its range and on one staff', () => {
    const exercise = generateExercise({ ...BASE, instrument: 'flute', clef: 'grand', range: 3, rhythm: 4 }, 3)
    expect(exercise.staves).toHaveLength(1)
    const midis = exercise.staves[0].measures.flat().flatMap(e => (e.midi === null ? [] : [e.midi]))
    expect(Math.min(...midis)).toBeGreaterThanOrEqual(60)
  })

  it('keeps wide bass-clef exercises near the staff', () => {
    for (const key of KEYS) {
      const exercise = generateExercise({ ...BASE, clef: 'bass', key: key.id, range: 3, rhythm: 4 }, 2)
      const midis = exercise.staves[0].measures.flat().flatMap(e => (e.midi === null ? [] : [e.midi]))
      expect(Math.max(...midis)).toBeLessThanOrEqual(64)
      expect(Math.min(...midis)).toBeGreaterThanOrEqual(40)
    }
  })

  it('only adds rests when asked', () => {
    const rests = (r: boolean) => generateExercise({ ...BASE, rests: r, measures: 12 }, 9).staves[0].measures.flat().filter(e => e.midi === null).length
    expect(rests(false)).toBe(0)
    expect(rests(true)).toBeGreaterThan(0)
  })
})

describe('scales', () => {
  it('goes up and down the scale', () => {
    const exercise = generateExercise({ ...BASE, kind: 'scale', key: 'G', rhythm: 2 }, 1)
    const midis = exercise.staves[0].measures.flat().flatMap(e => (e.midi === null ? [] : [e.midi]))
    expect(midis).toEqual([67, 69, 71, 72, 74, 76, 78, 79, 78, 76, 74, 72, 71, 69, 67])
  })

  it('raises the seventh in harmonic minor scales', () => {
    const xml = exerciseToMusicXml(generateExercise({ ...BASE, kind: 'scale', key: 'Am', minor: 'harmonic' }, 1))
    expect(xml).toContain('<step>G</step><alter>1</alter>')
  })

  it('fills the last measure in every time signature', () => {
    for (const time of TIMES) {
      for (const rhythm of LEVELS) {
        const exercise = generateExercise({ ...BASE, kind: 'scale', time, rhythm, clef: 'grand', range: 3 }, 1)
        for (const staff of exercise.staves) {
          for (const measure of staff.measures) expect(sum(measure.map(e => e.duration))).toBe(measureLength(time))
        }
      }
    }
  })
})

describe('minor scales', () => {
  const midis = (minor: 'natural' | 'harmonic' | 'melodic') =>
    generateExercise({ ...BASE, kind: 'scale', key: 'Am', minor }, 1).staves[0].measures.flat().flatMap(e => (e.midi === null ? [] : [e.midi]))

  it('plays the natural, harmonic and melodic minor', () => {
    expect(midis('natural')).toEqual([69, 71, 72, 74, 76, 77, 79, 81, 79, 77, 76, 74, 72, 71, 69])
    expect(midis('harmonic')).toEqual([69, 71, 72, 74, 76, 77, 80, 81, 80, 77, 76, 74, 72, 71, 69])
    expect(midis('melodic')).toEqual([69, 71, 72, 74, 76, 78, 80, 81, 79, 77, 76, 74, 72, 71, 69])
  })

  it('spells raised notes with sharps and double sharps', () => {
    const xml = exerciseToMusicXml(generateExercise({ ...BASE, kind: 'scale', key: 'G#m', minor: 'harmonic' }, 1))
    expect(xml).toContain('<fifths>5</fifths>')
    expect(xml).toContain('<step>F</step><alter>2</alter>')
  })

  it('names the minor scale in the title', () => {
    expect(generateExercise({ ...BASE, key: 'Dm', minor: 'melodic' }, 1).title).toBe('Lectura · Re menor melódica')
  })
})

describe('keys', () => {
  it('has all 15 major and 15 minor keys, spelled from the tonic', () => {
    expect(KEYS.filter(k => k.mode === 'major')).toHaveLength(15)
    expect(KEYS.filter(k => k.mode === 'minor')).toHaveLength(15)
    const xml = exerciseToMusicXml(generateExercise({ ...BASE, kind: 'scale', key: 'Cb' }, 1))
    expect(xml).toMatch(/<step>C<\/step><alter>-1<\/alter><octave>5<\/octave>/)
    expect(xml).toContain('<fifths>-7</fifths>')
  })
})

describe('exerciseToMusicXml', () => {
  it('writes key, time, both clefs and spelled pitches', () => {
    const xml = exerciseToMusicXml(generateExercise({ ...BASE, key: 'Bb', clef: 'grand', time: '3/4' }, 4))
    expect(xml).toContain('<fifths>-2</fifths>')
    expect(xml).toContain('<beats>3</beats><beat-type>4</beat-type>')
    expect(xml).toContain('<staves>2</staves>')
    expect(xml).toContain('<clef number="2"><sign>F</sign><line>4</line></clef>')
    expect(xml).toMatch(/<step>B<\/step><alter>-1<\/alter><octave>4<\/octave>/)
  })

  it('beams eighths within a beat', () => {
    const xml = exerciseToMusicXml(generateExercise({ ...BASE, kind: 'scale', rhythm: 3 }, 1))
    expect(xml).toContain('<beam number="1">begin</beam>')
    expect(xml).toContain('<beam number="1">end</beam>')
  })
})
