import { describe, expect, it } from 'vitest'
import { accompanimentNotes, chordNumeral, chordTones, resolveStyle, stylesForTime } from './accompaniment'
import { exerciseToMusicXml, generateExercise, KEYS, measureLength, type ExerciseOptions, type TimeSignature } from './generator'

const BASE: ExerciseOptions = {
  kind: 'reading', instrument: 'piano', clef: 'treble', key: 'C', time: '4/4', rhythm: 2, rests: false, range: 2, notes: [], maxInterval: 5, measures: 8, minor: 'harmonic',
}
const TIMES: TimeSignature[] = ['2/4', '3/4', '4/4', '6/8']

describe('harmony', () => {
  it('fills every measure, starting and ending on the tonic chord', () => {
    for (const key of KEYS) {
      for (const time of TIMES) {
        for (const kind of ['reading', 'scale', 'scale-arpeggio'] as const) {
          const exercise = generateExercise({ ...BASE, key: key.id, time, kind, rhythm: 3 }, 5)
          const { slots } = exercise.harmony
          expect(slots[0].degree).toBe(0)
          expect(slots[slots.length - 1].degree).toBe(0)
          exercise.staves[0].measures.forEach((_, m) => {
            const inMeasure = slots.filter(s => s.measure === m)
            expect(inMeasure.reduce((sum, s) => sum + s.length, 0)).toBe(measureLength(time))
          })
        }
      }
    }
  })

  it('mostly fits the melody note on the first beat of each chord', () => {
    let fitting = 0
    let total = 0
    for (let seed = 1; seed <= 30; seed++) {
      const exercise = generateExercise({ ...BASE, rhythm: 2 }, seed)
      const tonic = 0
      for (const slot of exercise.harmony.slots) {
        let position = 0
        const note = exercise.staves[0].measures[slot.measure].find(e => {
          const at = position
          position += e.duration
          return at === slot.start
        })
        if (!note?.midi) continue
        total++
        if (slot.tones.map(t => (tonic + t) % 12).includes(note.midi % 12)) fitting++
      }
    }
    expect(fitting / total).toBeGreaterThan(0.85)
  })

  it('makes V major in minor keys', () => {
    expect(chordTones(4, 'minor')).toEqual([7, 11, 2])
    expect(chordTones(0, 'minor')).toEqual([0, 3, 7])
  })

  it('gives the two-staff left hand the root of each chord', () => {
    const exercise = generateExercise({ ...BASE, clef: 'grand', key: 'G' }, 3)
    const bass = exercise.staves[1].measures
    exercise.harmony.slots.forEach(slot => {
      const root = (7 + slot.tones[0]) % 12
      expect(bass[slot.measure][0].midi! % 12).toBe(root)
    })
  })
})

describe('accompaniment styles', () => {
  it('offers the waltz only in 3/4 and keeps a style when the time changes', () => {
    expect(stylesForTime('3/4')).toContain('waltz')
    expect(stylesForTime('4/4')).not.toContain('waltz')
    expect(resolveStyle('waltz', '4/4')).toBe(stylesForTime('4/4')[0])
    expect(resolveStyle('off', '3/4')).toBe('off')
    expect(resolveStyle(undefined, '3/4')).toBe('off')
  })

  it('stays inside the exercise and on the piano', () => {
    for (const time of TIMES) {
      for (const clef of ['treble', 'bass', 'grand'] as const) {
        const exercise = generateExercise({ ...BASE, time, clef, key: 'F#m' }, 9)
        const end = (exercise.staves[0].measures.length * measureLength(time)) / 16
        for (const style of stylesForTime(time)) {
          const notes = accompanimentNotes(exercise.harmony, style)
          expect(notes.length).toBeGreaterThan(0)
          for (const n of notes) {
            expect(n.time).toBeGreaterThanOrEqual(0)
            expect(n.time + n.duration).toBeLessThanOrEqual(end + 1e-9)
            expect(n.midi).toBeGreaterThanOrEqual(36)
            expect(n.midi).toBeLessThanOrEqual(84)
          }
        }
      }
    }
  })

  it('plays nothing when off', () => {
    expect(accompanimentNotes(generateExercise(BASE, 1).harmony, 'off')).toEqual([])
  })
})

describe('degrees on the score', () => {
  it('writes capitals for major chords and small letters for minor ones', () => {
    expect(chordNumeral({ degree: 4, tones: chordTones(4, 'minor') })).toBe('V')
    expect(chordNumeral({ degree: 3, tones: chordTones(3, 'minor') })).toBe('iv')
    expect(chordNumeral({ degree: 5, tones: chordTones(5, 'major') })).toBe('vi')
  })

  it('writes one degree per chord, only when asked', () => {
    const exercise = generateExercise(BASE, 2)
    expect(exerciseToMusicXml(exercise)).not.toContain('<words')
    const words = exerciseToMusicXml(exercise, { degrees: true }).match(/<words[^>]*>[^<]*<\/words>/g) ?? []
    expect(words.length).toBe(exercise.harmony.slots.length)
    expect(words[0]).toContain('>I<')
  })
})
