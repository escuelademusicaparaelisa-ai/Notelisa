import { describe, expect, it } from 'vitest'
import type { Piece } from './catalog'
import { matchesQuery } from './search'

const piece = { id: 'x', title: 'Canción de cuna', composer: 'J. Brahms', level: 2, instrument: 'piano', file: 'x.mxl' } as Piece

describe('matchesQuery', () => {
  it('ignores accents and case', () => expect(matchesQuery(piece, 'CANCION')).toBe(true))
  it('looks at the composer', () => expect(matchesQuery(piece, 'brahms')).toBe(true))
  it('needs every word', () => {
    expect(matchesQuery(piece, 'cuna brahms')).toBe(true)
    expect(matchesQuery(piece, 'cuna mozart')).toBe(false)
  })
  it('matches everything with an empty query', () => expect(matchesQuery(piece, '  ')).toBe(true))
})
