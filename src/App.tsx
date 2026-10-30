import { useState } from 'react'
import { useAccount } from './account/useAccount'
import { exerciseToMusicXml, generateExercise, type ExerciseOptions } from './core/exercises/generator'
import type { Piece } from './library/catalog'
import { savedExerciseOptions } from './core/exercises/savedOptions'
import { AccountBar } from './ui/components/AccountBar'
import { ExercisesScreen } from './ui/screens/ExercisesScreen'
import { LibraryScreen } from './ui/screens/LibraryScreen'
import { LoginScreen, WaitingScreen } from './ui/screens/LoginScreen'
import { PhotoScreen } from './ui/screens/PhotoScreen'
import { PracticeScreen } from './ui/screens/PracticeScreen'
import { RequestsScreen } from './ui/screens/RequestsScreen'
import { ReviewScreen } from './ui/screens/ReviewScreen'

type View =
  | { name: 'library' }
  | { name: 'practice'; piece: Piece }
  | { name: 'review' }
  | { name: 'exercises' }
  | { name: 'photo'; photos: File[] }
  | { name: 'exercise'; piece: Piece; options: ExerciseOptions }
  | { name: 'requests' }

function newExercise(options: ExerciseOptions): Piece {
  const seed = Math.floor(Math.random() * 2 ** 31)
  const exercise = generateExercise(options, seed)
  return { id: `exercise:${seed}`, title: exercise.title, instrument: exercise.options.instrument, file: null, content: exerciseToMusicXml(exercise) }
}

export default function App() {
  const [view, setView] = useState<View>({ name: 'library' })
  const [exerciseOptions, setExerciseOptions] = useState(savedExerciseOptions)
  // Kept here so coming back from a piece shows the same notebook.
  const [notebookId, setNotebookId] = useState<string | null>(null)
  const account = useAccount()
  // Requests waiting for the administrator; null until counted.
  const [pending, setPending] = useState<number | null>(null)
  const toLibrary = () => setView({ name: 'library' })
  const startExercise = (options: ExerciseOptions) => {
    setExerciseOptions(options)
    setView({ name: 'exercise', piece: newExercise(options), options })
  }
  if (account.state === 'loading') return <p className="score-message">Cargando…</p>
  if (account.state === 'signedOut') return <LoginScreen />
  if (account.state === 'signedIn' && account.profile?.status !== 'approved') {
    return <WaitingScreen profile={account.profile} onCheck={account.reload} />
  }
  const profile = account.state === 'signedIn' ? account.profile : null
  switch (view.name) {
    case 'requests':
      return <RequestsScreen onBack={toLibrary} onChange={setPending} />
    case 'practice':
      return <PracticeScreen piece={view.piece} onBack={toLibrary} />
    case 'review':
      return <ReviewScreen onBack={toLibrary} />
    case 'photo':
      return <PhotoScreen photos={view.photos} onBack={toLibrary} />
    case 'exercises':
      return <ExercisesScreen options={exerciseOptions} onCreate={startExercise} onBack={toLibrary} />
    case 'exercise':
      return (
        <PracticeScreen key={view.piece.id} piece={view.piece} backLabel="Ejercicios"
          onBack={() => setView({ name: 'exercises' })} onAnother={() => startExercise(view.options)} />
      )
    default:
      return (
        <LibraryScreen onOpen={piece => setView({ name: 'practice', piece })} onReview={() => setView({ name: 'review' })}
          onExercises={() => setView({ name: 'exercises' })} onPhotos={photos => setView({ name: 'photo', photos })}
          notebookId={notebookId} onNotebook={setNotebookId}
          accountBar={profile && (
            <AccountBar profile={profile} pending={pending} onPending={setPending} onRequests={() => setView({ name: 'requests' })} />
          )} />
      )
  }
}
