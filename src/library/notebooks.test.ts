// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { removeNotebook, savedNotebooks, saveNotebooks, togglePiece, upsertNotebook, type Notebook } from './notebooks'

const level1: Notebook = { id: 'a', name: 'Nivel 1', pieceIds: ['cumple', 'osito'] }
const christmas: Notebook = { id: 'b', name: 'Navidad', pieceIds: ['noche-de-paz', 'cumple'] }

describe('notebooks', () => {
  beforeEach(() => localStorage.clear())

  it('lets a piece be in several notebooks', () => {
    const notebooks = upsertNotebook(upsertNotebook([], level1), christmas)
    expect(notebooks.filter(n => n.pieceIds.includes('cumple'))).toHaveLength(2)
  })

  it('replaces a notebook when it is edited', () => {
    const notebooks = upsertNotebook([level1, christmas], { ...level1, name: '  Nivel uno ', pieceIds: ['osito', 'osito'] })
    expect(notebooks).toEqual([{ id: 'a', name: 'Nivel uno', pieceIds: ['osito'] }, christmas])
  })

  it('removes a notebook', () => {
    expect(removeNotebook([level1, christmas], 'a')).toEqual([christmas])
  })

  it('adds pieces at the end and takes them out again', () => {
    expect(togglePiece(['x'], 'y')).toEqual(['x', 'y'])
    expect(togglePiece(['x', 'y'], 'x')).toEqual(['y'])
  })

  it('remembers the notebooks on the device', () => {
    saveNotebooks([level1, christmas])
    expect(savedNotebooks()).toEqual([level1, christmas])
  })

  it('ignores broken saved data', () => {
    localStorage.setItem('notelisa.notebooks', '{not json')
    expect(savedNotebooks()).toEqual([])
  })
})
