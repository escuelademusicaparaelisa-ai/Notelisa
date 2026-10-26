import { useState } from 'react'
import type { Piece } from './library/catalog'
import { LibraryScreen } from './ui/screens/LibraryScreen'
import { PracticeScreen } from './ui/screens/PracticeScreen'

export default function App() {
  const [piece, setPiece] = useState<Piece | null>(null)
  return piece
    ? <PracticeScreen piece={piece} onBack={() => setPiece(null)} />
    : <LibraryScreen onOpen={setPiece} />
}
