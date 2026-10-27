// The piece library. Pieces are listed in public/library/index.json (shipped with
// the app) and optionally public/library/index.local.json (the teacher's own scores,
// kept out of version control). Later this can come from a server without changing
// the screens.

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'failed'

/** Present on pieces imported with optical recognition, which the teacher must check. */
export interface PieceReview {
  status: ReviewStatus
  /** Images of the original score, relative to public/library/. */
  originals?: string[]
  importedFrom?: string
  importedAt?: string
}

export interface Piece {
  id: string
  title: string
  composer?: string
  arranger?: string
  /** 1 (easiest) to 5. */
  level?: number
  instrument: string
  /** MusicXML (.musicxml/.xml) or compressed MusicXML (.mxl), relative to public/library/. Null when recognition failed. */
  file: string | null
  notes?: string
  /** Score content opened from the device (MusicXML text or MXL binary string). */
  content?: string
  review?: PieceReview
  /** Pieces of the school library: the file is encrypted and decrypted when opened. */
  encrypted?: { format: 'xml' | 'mxl' }
}

/** Pieces students can practise: everything except recognised scores not yet approved. */
export function isPlayable(piece: Piece): boolean {
  return !!(piece.file || piece.content) && (!piece.review || piece.review.status === 'approved')
}

export function libraryUrl(path: string): string {
  return `${import.meta.env.BASE_URL}library/${path}`
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

/** What to hand to the score renderer: the file's URL or its in-memory content. */
export function pieceSource(piece: Piece): string {
  return piece.content ?? libraryUrl(piece.file ?? '')
}

/** Reads a MusicXML (.musicxml/.xml) or MXL file chosen by the user. */
export async function pieceFromFile(file: File): Promise<Piece> {
  const isMxl = file.name.toLowerCase().endsWith('.mxl')
  const content = isMxl ? await readBinaryString(file) : await file.text()
  const title = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ')
  return { id: `file:${file.name}`, title, instrument: 'piano', file: file.name, content }
}

function readBinaryString(file: File): Promise<string> {
  // OSMD recognises MXL (zip) content when given as a binary string.
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsBinaryString(file)
  })
}
