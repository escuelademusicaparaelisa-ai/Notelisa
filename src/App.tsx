import { useState } from 'react'
import { exerciseToMusicXml, generateExercise, type ExerciseOptions } from './core/exercises/generator'
import type { Piece } from './library/catalog'
import { savedExerciseOptions } from './core/exercises/savedOptions'
import { ExercisesScreen } from './ui/screens/ExercisesScreen'
import { LibraryScreen } from './ui/screens/LibraryScreen'
import { PhotoScreen } from './ui/screens/PhotoScreen'
import { PracticeScreen } from './ui/screens/PracticeScreen'
import { ReviewScreen } from './ui/screens/ReviewScreen'

type View =
  | { name: 'library' }
  | { name: 'practice'; piece: Piece }
  | { name: 'review' }
  | { name: 'exercises' }
  | { name: 'photo'; photos: File[] }
  | { name: 'exercise'; piece: Piece; options: ExerciseOptions }

function newExercise(options: ExerciseOptions): Piece {
  const seed = Math.floor(Math.random() * 2 ** 31)
  const exercise = generateExercise(options, seed)
  return { id: `exercise:${seed}`, title: exercise.title, instrument: exercise.options.instrument, file: null, content: exerciseToMusicXml(exercise) }
}

export default function App() {
  const [view, setView] = useState<View>({ name: 'library' })
  const [exerciseOptions, setExerciseOptions] = useState(savedExerciseOptions)
  const toLibrary = () => setView({ name: 'library' })
  const startExercise = (options: ExerciseOptions) => {
    setExerciseOptions(options)
    setView({ name: 'exercise', piece: newExercise(options), options })
  }
  switch (view.name) {
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
          onExercises={() => setView({ name: 'exercises' })} onPhotos={photos => setView({ name: 'photo', photos })} />
      )
  }
}
