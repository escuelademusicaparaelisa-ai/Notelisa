import { describe, expect, it } from 'vitest'
import type { Piece } from '../library/catalog'
import { selectedPieces } from './assignments'
import { sortNotebooks } from './sharedNotebooks'

const piece = (id: string, level: number): Piece => ({ id, title: id.toUpperCase(), level, instrument: 'piano', file: `${id}.musicxml` })
const pieces = [piece('a', 1), piece('b', 1), piece('c', 2), piece('d', 3)]
const notebooks = [{ id: 'n1', name: 'Navidad', pieceIds: ['c', 'a', 'gone'] }]

describe('selectedPieces', () => {
  it('expands notebooks and levels, each piece once', () => {
    const chosen = selectedPieces({ notebookIds: ['n1'], levels: [1], pieceIds: ['d', 'a'] }, pieces, notebooks)
    expect(chosen.map(c => [c.piece.id, c.source])).toEqual([
      ['c', 'Cuaderno Navidad'], ['a', 'Cuaderno Navidad'], ['b', 'Nivel 1'], ['d', ''],
    ])
  })

  it('takes the pieces of a level from the ones shown', () => {
    const chosen = selectedPieces({ notebookIds: [], levels: [1], pieceIds: [] }, pieces, notebooks, [pieces[0]])
    expect(chosen.map(c => c.piece.id)).toEqual(['a'])
  })

  it('skips pieces that are no longer in the library', () => {
    expect(selectedPieces({ notebookIds: ['n1'], levels: [], pieceIds: ['zzz'] }, pieces, notebooks)).toHaveLength(2)
  })
})

describe('sortNotebooks', () => {
  it('puts school notebooks first, each group alphabetical', () => {
    const sorted = sortNotebooks([
      { id: '1', name: 'Zorro', pieceIds: [] }, { id: '2', name: 'Navidad', pieceIds: [], school: true },
      { id: '3', name: 'árbol', pieceIds: [] }, { id: '4', name: 'Escalas', pieceIds: [], school: true },
    ])
    expect(sorted.map(n => n.name)).toEqual(['Escalas', 'Navidad', 'árbol', 'Zorro'])
  })
})
