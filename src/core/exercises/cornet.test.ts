import { describe, expect, it } from 'vitest'
import { accompanimentNotes, stylesForTime } from './accompaniment'
import { CORNET_COLORS, CORNET_NOTES, cornetNotes, exerciseToMusicXml, generateExercise, measureLength, type ExerciseOptions } from './generator'

const BASE: ExerciseOptions = {
  kind: 'reading', instrument: 'cornet', clef: 'treble', key: 'C', time: '4/4', rhythm: 3, rests: false, range: 1, notes: [], maxInterval: 5, measures: 8, minor: 'harmonic',
  cornetPosition: 'do',
}

const names = (position: 'do' | 'reb' | 'both') => cornetNotes(position).map(n => n.name)

describe('cornet notes', () => {
  it('are the natural notes of each position, as on the teacher\'s sheet', () => {
    expect(names('do')).toEqual(['Sol4', 'Do5', 'Mi5', 'Sol5', 'Do6', 'Re6', 'Mi6'])
    expect(names('reb')).toEqual(['La♭4', 'Re♭5', 'Fa5', 'La♭5', 'Re♭6', 'Mi♭6', 'Fa6'])
  })

  it('alternate Do and Re♭ positions in the complete scale, low to high', () => {
    expect(CORNET_NOTES).toHaveLength(14)
    CORNET_NOTES.forEach((n, i) => expect(n.position).toBe(i % 2 === 0 ? 'do' : 'reb'))
    for (let i = 1; i < CORNET_NOTES.length; i++) expect(CORNET_NOTES[i].midi).toBeGreaterThan(CORNET_NOTES[i - 1].midi)
  })
})

describe('cornet exercises', () => {
  const sounding = (options: ExerciseOptions, seed = 3) =>
    generateExercise(options, seed).staves[0].measures.flat().filter(e => e.midi !== null)

  it('scales go up and down the position\'s notes', () => {
    for (const position of ['do', 'reb', 'both'] as const) {
      const pool = cornetNotes(position).map(n => n.midi)
      expect(sounding({ ...BASE, kind: 'scale', cornetPosition: position }).map(e => e.midi)).toEqual([...pool, ...pool.slice(0, -1).reverse()])
    }
  })

  it('reading uses only the chosen position\'s notes and fills every measure', () => {
    for (const position of ['do', 'reb', 'both'] as const) {
      const pool = cornetNotes(position).map(n => n.midi)
      for (let seed = 1; seed < 20; seed++) {
        const exercise = generateExercise({ ...BASE, cornetPosition: position, rests: true }, seed)
        for (const measure of exercise.staves[0].measures) expect(measure.reduce((a, e) => a + e.duration, 0)).toBe(measureLength('4/4'))
        for (const e of sounding({ ...BASE, cornetPosition: position }, seed)) expect(pool).toContain(e.midi)
      }
    }
  })

  it('is written without key signature, with each note\'s accidental', () => {
    const xml = exerciseToMusicXml(generateExercise({ ...BASE, kind: 'scale', cornetPosition: 'reb' }, 1))
    expect(xml).toContain('<fifths>0</fifths>')
    expect(xml).toContain('<step>A</step><alter>-1</alter><octave>4</octave>')
    expect(xml).toContain('<part-name>Corneta</part-name>')
  })

  it('colours the notes by position only when asked', () => {
    expect(exerciseToMusicXml(generateExercise({ ...BASE, kind: 'scale' }, 1))).not.toContain('color=')
    const both = exerciseToMusicXml(generateExercise({ ...BASE, kind: 'scale', cornetPosition: 'both', cornetColors: true }, 1))
    expect(both).toContain(`<note color="${CORNET_COLORS.do}"><pitch><step>G</step><octave>4</octave>`)
    expect(both).toContain(`<note color="${CORNET_COLORS.reb}"><pitch><step>A</step><alter>-1</alter><octave>4</octave>`)
  })

  it('accompanies in Do or Re♭, and not with both positions', () => {
    expect(generateExercise({ ...BASE, cornetPosition: 'reb' }, 2).harmony.tonic).toBe(1)
    const both = generateExercise({ ...BASE, cornetPosition: 'both', accompaniment: 'march' }, 2)
    expect(both.harmony.slots).toHaveLength(0)
    expect(both.options.accompaniment).toBe('off')
  })
})

describe('processional march', () => {
  it('is offered in 2/4 and 4/4 and plays a deep bass on the first beat of each measure', () => {
    expect(stylesForTime('4/4')).toContain('procession')
    expect(stylesForTime('2/4')).toContain('procession')
    const exercise = generateExercise({ ...BASE, accompaniment: 'procession' }, 4)
    const notes = accompanimentNotes(exercise.harmony, 'procession')
    for (let m = 0; m < 7; m++) {
      const downbeat = notes.filter(n => Math.abs(n.time - m) < 1e-9)
      expect(Math.min(...downbeat.map(n => n.midi))).toBeLessThan(48)
    }
  })
})
