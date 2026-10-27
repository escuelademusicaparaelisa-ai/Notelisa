import type { Piece } from './catalog'

/** Lowercase without accents, so "cancion" finds "Canción". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** True when every word of the query is in the piece's title, composer or arranger. */
export function matchesQuery(piece: Piece, query: string): boolean {
  const haystack = normalize([piece.title, piece.composer, piece.arranger].filter(Boolean).join(' '))
  return normalize(query).split(/\s+/).every(word => haystack.includes(word))
}
