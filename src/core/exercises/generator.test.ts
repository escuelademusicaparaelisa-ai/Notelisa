import { describe, expect, it } from 'vitest'
import {
  exerciseToMusicXml, generateExercise, KEYS, measureLength, rhythmForMeasure, seededRandom,
  type ExerciseOptions, type RhythmLevel, type TimeSignature,
} from './generator'

const BASE: ExerciseOptions = {
  kind: 'reading', instrument: 'piano', clef: 'treble', key: 'C', time: '4/4', rhythm: 2, rests: false, range: 1, maxInterval: 3, measures: 8, minor: 'harmonic',
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

  it('moves only by step when the widest interval is a second', () => {
    for (const range of [0, 1, 2, 3, 4] as const) {
      const exercise = generateExercise({ ...BASE, range, maxInterval: 2, rhythm: 4, measures: 12 }, 4)
      const degrees = exercise.staves[0].measures.flat().flatMap(e => (e.degree === null ? [] : [e.degree]))
      // The final tonic may be reached from anywhere.
      for (let i = 1; i < degrees.length - 1; i++) expect(Math.abs(degrees[i] - degrees[i - 1])).toBeLessThanOrEqual(1)
    }
  })

  it('never leaps wider than the chosen interval', () => {
    for (const maxInterval of [3, 4, 5, 6, 7, 8] as const) {
      const exercise = generateExercise({ ...BASE, range: 4, maxInterval, rhythm: 4, measures: 12 }, 6)
      const degrees = exercise.staves[0].measures.flat().flatMap(e => (e.degree === null ? [] : [e.degree]))
      const moves = degrees.slice(1, -1).map((d, i) => Math.abs(d - degrees[i]))
      expect(Math.max(...moves)).toBeLessThanOrEqual(maxInterval - 1)
    }
  })

  it('keeps three-note exercises between the tonic and the third', () => {
    const exercise = generateExercise({ ...BASE, range: 0, rhythm: 4 }, 5)
    const midis = exercise.staves[0].measures.flat().flatMap(e => (e.midi === null ? [] : [e.midi]))
    expect(Math.min(...midis)).toBeGreaterThanOrEqual(60)
    expect(Math.max(...midis)).toBeLessThanOrEqual(64)
  })

  it('spans two octaves when there is room on the staff', () => {
    const exercise = generateExercise({ ...BASE, range: 4, maxInterval: 8, rhythm: 4, measures: 12 }, 1)
    const midis = exercise.staves[0].measures.flat().flatMap(e => (e.midi === null ? [] : [e.midi]))
    expect(Math.max(...midis) - Math.min(...midis)).toBeGreaterThan(12)
    expect(Math.min(...midis)).toBeGreaterThanOrEqual(57)
    expect(Math.max(...midis)).toBeLessThanOrEqual(81)
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

describe('arpeggios', () => {
  const notes = (options: Partial<ExerciseOptions>, staff = 0) =>
    generateExercise({ ...BASE, kind: 'arpeggio', ...options }, 1).staves[staff].measures.flat().filter(e => e.midi !== null)

  it('goes up and down the tonic chord', () => {
    expect(notes({ key: 'C' }).map(e => e.midi)).toEqual([60, 64, 67, 72, 67, 64, 60])
    expect(notes({ key: 'Am', minor: 'melodic' }).map(e => e.midi)).toEqual([69, 72, 76, 81, 76, 72, 69])
    expect(notes({ key: 'G', clef: 'grand', range: 4 }).map(e => e.midi)).toEqual([67, 71, 74, 79, 83, 86, 91, 86, 83, 79, 74, 71, 67])
  })

  it('fingers each hand on the piano', () => {
    expect(notes({ key: 'D' }).map(e => e.finger)).toEqual([1, 2, 3, 5, 3, 2, 1])
    expect(notes({ key: 'D', clef: 'grand' }, 1).map(e => e.finger)).toEqual([5, 4, 2, 1, 2, 4, 5])
    expect(notes({ key: 'C', clef: 'grand', range: 4 }, 1).map(e => e.finger)).toEqual([5, 4, 2, 1, 4, 2, 1, 2, 4, 1, 2, 4, 5])
    const xml = exerciseToMusicXml(generateExercise({ ...BASE, kind: 'arpeggio' }, 1))
    expect(xml).toContain('<technical><fingering placement="above">5</fingering></technical>')
  })

  it('leaves black-key and flute arpeggios without fingering', () => {
    expect(notes({ key: 'Eb' }).every(e => e.finger === undefined)).toBe(true)
    expect(notes({ instrument: 'flute' }).every(e => e.finger === undefined)).toBe(true)
  })

  it('plays the scale and then the arpeggio, sharing the tonic', () => {
    const midis = generateExercise({ ...BASE, kind: 'scale-arpeggio' }, 1).staves[0].measures.flat().flatMap(e => (e.midi === null ? [] : [e.midi]))
    expect(midis).toEqual([60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60, 64, 67, 72, 67, 64, 60])
  })

  it('fills every measure', () => {
    for (const kind of ['arpeggio', 'scale-arpeggio'] as const) {
      for (const time of TIMES) {
        for (const rhythm of LEVELS) {
          for (const staff of generateExercise({ ...BASE, kind, time, rhythm, clef: 'grand', range: 4 }, 1).staves) {
            for (const measure of staff.measures) expect(sum(measure.map(e => e.duration))).toBe(measureLength(time))
          }
        }
      }
    }
  })

  it('names the exercise', () => {
    expect(generateExercise({ ...BASE, kind: 'arpeggio', key: 'Dm' }, 1).title).toBe('Arpegio · Re menor')
    expect(generateExercise({ ...BASE, kind: 'scale-arpeggio', key: 'Dm', minor: 'harmonic' }, 1).title).toBe('Escala y arpegio · Re menor armónica')
  })
})
