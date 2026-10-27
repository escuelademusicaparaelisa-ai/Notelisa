import { useState } from 'react'
import type { Piece } from './library/catalog'
import { LibraryScreen } from './ui/screens/LibraryScreen'
import { PracticeScreen } from './ui/screens/PracticeScreen'
import { ReviewScreen } from './ui/screens/ReviewScreen'

type View = { name: 'library' } | { name: 'practice'; piece: Piece } | { name: 'review' }

export default function App() {
  const [view, setView] = useState<View>({ name: 'library' })
  const toLibrary = () => setView({ name: 'library' })
  switch (view.name) {
    case 'practice':
      return <PracticeScreen piece={view.piece} onBack={toLibrary} />
    case 'review':
      return <ReviewScreen onBack={toLibrary} />
    default:
      return <LibraryScreen onOpen={piece => setView({ name: 'practice', piece })} onReview={() => setView({ name: 'review' })} />
  }
}
