// The piece library. Pieces are listed in public/library/index.json (shipped with
// the app) and optionally public/library/index.local.json (the teacher's own scores,
// kept out of version control). Later this can come from a server without changing
// the screens.

export interface Piece {
  id: string
  title: string
  composer?: string
  /** 1 (easiest) to 5. */
  level?: number
  instrument: string
  /** MusicXML (.musicxml/.xml) or compressed MusicXML (.mxl), relative to public/library/. */
  file: string
  notes?: string
}

async function loadIndex(name: string): Promise<Piece[]> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}library/${name}`)
    if (!response.ok) return []
    const data = (await response.json()) as { pieces?: Piece[] }
    return data.pieces ?? []
  } catch {
    return []
  }
}

export async function loadLibrary(): Promise<Piece[]> {
  const [shipped, local] = await Promise.all([loadIndex('index.json'), loadIndex('index.local.json')])
  return [...shipped, ...local]
}

export function pieceUrl(piece: Piece): string {
  return `${import.meta.env.BASE_URL}library/${piece.file}`
}
