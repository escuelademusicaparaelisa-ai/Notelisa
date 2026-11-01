import { describe, expect, it } from 'vitest'
import { accompanimentNotes, chordName, chordTones, resolveStyle, stylesForTime } from './accompaniment'
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

describe('chord names on the score', () => {
  it('spells the chords in the key', () => {
    const c = { tonic: 0, letter: 0 }
    expect(chordName({ degree: 4, tones: chordTones(4, 'major') }, c)).toBe('G')
    expect(chordName({ degree: 5, tones: chordTones(5, 'major') }, c)).toBe('Am')
    // F# minor: iv is Bm, V is C# major, VI is D.
    const fSharpMinor = { tonic: 6, letter: 3 }
    expect(chordName({ degree: 3, tones: chordTones(3, 'minor') }, fSharpMinor)).toBe('Bm')
    expect(chordName({ degree: 4, tones: chordTones(4, 'minor') }, fSharpMinor)).toBe('C#')
    expect(chordName({ degree: 5, tones: chordTones(5, 'minor') }, fSharpMinor)).toBe('D')
    // E flat major: IV is Ab.
    expect(chordName({ degree: 3, tones: chordTones(3, 'major') }, { tonic: 3, letter: 2 })).toBe('Ab')
  })

  it('writes one name per chord under a note, only when asked', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const exercise = generateExercise({ ...BASE, rests: true, rhythm: 3 }, seed)
      expect(exerciseToMusicXml(exercise)).not.toContain('<lyric')
      const names = exerciseToMusicXml(exercise, { chords: true }).match(/<text>[^<]*<\/text>/g) ?? []
      expect(names.length).toBeGreaterThan(0)
      expect(names.length).toBeLessThanOrEqual(exercise.harmony.slots.length)
      expect(names[0]).toBe('<text>C</text>')
    }
  })
})
