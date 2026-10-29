import { describe, expect, it } from 'vitest'
import { photoFileName, requestText, type PhotoRequest } from './photoRequest'

const request: PhotoRequest = {
  title: 'Canción de cuna', composer: '', level: 2, instrument: 'flute', keepLyrics: false, keepFingering: true, notes: '',
}

describe('requestText', () => {
  it('lists every choice', () => {
    expect(requestText(request, 1)).toBe([
      'Nueva pieza para Notelisa (1 foto)',
      'Título: Canción de cuna',
      'Nivel: 2',
      'Instrumento: flauta',
      'Letra: quitar',
      'Digitación: mantener',
    ].join('\n'))
  })
  it('adds the composer and notes only when given', () => {
    const text = requestText({ ...request, composer: ' Brahms ', notes: 'Solo la primera página' }, 2)
    expect(text).toContain('(2 fotos)')
    expect(text).toContain('Autor: Brahms')
    expect(text).toContain('Notas: Solo la primera página')
  })
})

describe('photoFileName', () => {
  it('drops accents and spaces', () => expect(photoFileName('Canción de cuna', 0)).toBe('cancion-de-cuna-1.jpg'))
  it('has a name without a title', () => expect(photoFileName('  ', 1)).toBe('partitura-2.jpg'))
})
