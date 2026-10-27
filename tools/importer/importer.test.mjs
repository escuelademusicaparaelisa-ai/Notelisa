import { describe, expect, it } from 'vitest'
import { dropColourHighlights } from './image.mjs'
import { kindOf } from './importer.mjs'
import { setReviewStatus, slugify, titleFromFilename, uniqueId, upsertPiece } from './library.mjs'

describe('kindOf', () => {
  it('recognises every supported format', () => {
    expect(kindOf('a.mxl')).toBe('musicxml')
    expect(kindOf('a.MusicXML')).toBe('musicxml')
    expect(kindOf('a.mscz')).toBe('musescore')
    expect(kindOf('a.pdf')).toBe('pdf')
    expect(kindOf('foto.JPG')).toBe('image')
    expect(kindOf('notas.txt')).toBeNull()
  })
})

describe('library helpers', () => {
  it('makes readable ids and titles', () => {
    expect(slugify('Resistiré (2 flautas)')).toBe('resistire-2-flautas')
    expect(titleFromFilename('La_Pantera_Rosa.mscz')).toBe('La Pantera Rosa')
  })
  it('avoids id clashes unless replacing on purpose', () => {
    const index = { pieces: [{ id: 'oda', title: 'Oda' }, { id: 'oda-2', title: 'Oda' }] }
    expect(uniqueId(index, 'oda')).toBe('oda-3')
    expect(uniqueId(index, 'oda', 'oda')).toBe('oda')
  })
  it('replaces a piece with the same id', () => {
    const index = upsertPiece({ pieces: [{ id: 'a', title: 'Old' }] }, { id: 'a', title: 'New' })
    expect(index.pieces).toEqual([{ id: 'a', title: 'New' }])
  })
  it('records the review decision', () => {
    const index = setReviewStatus({ pieces: [{ id: 'a', title: 'A', review: { status: 'pending' } }] }, 'a', 'approved')
    expect(index.pieces[0].review.status).toBe('approved')
    expect(() => setReviewStatus(index, 'x', 'approved')).toThrow()
  })
})

describe('dropColourHighlights', () => {
  it('turns coloured highlights white and keeps black ink', () => {
    const rgb = Buffer.from([
      0, 0, 0, // black note
      200, 230, 250, // light blue band
      30, 150, 240, // dark blue cursor
      10, 20, 40, // note under the cursor
      255, 255, 255, // paper
    ])
    expect([...dropColourHighlights(rgb, 3)]).toEqual([0, 250, 240, 40, 255])
  })
})
