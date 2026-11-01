import { useMemo, useState } from 'react'
import { accountNotebooks } from './account/sharedNotebooks'
import { useAccount } from './account/useAccount'
import { exerciseToMusicXml, generateExercise, type ExerciseOptions } from './core/exercises/generator'
import type { Piece } from './library/catalog'
import { deviceNotebooks } from './library/notebooks'
import { saveExerciseOptions, savedExerciseOptions } from './core/exercises/savedOptions'
import type { Harmony } from './core/exercises/accompaniment'
import { AccountBar } from './ui/components/AccountBar'
import { LoggedPractice } from './ui/components/LoggedPractice'
import { AdminScreen } from './ui/screens/AdminScreen'
import { ExercisesScreen } from './ui/screens/ExercisesScreen'
import { LibraryScreen } from './ui/screens/LibraryScreen'
import { LoginScreen, WaitingScreen } from './ui/screens/LoginScreen'
import { PhotoScreen } from './ui/screens/PhotoScreen'
import { StudentScreen } from './ui/screens/StudentScreen'
import { TeacherScreen } from './ui/screens/TeacherScreen'
import { ReviewScreen } from './ui/screens/ReviewScreen'

type View =
  | { name: 'library' }
  | { name: 'practice'; piece: Piece }
  | { name: 'review' }
  | { name: 'exercises' }
  | { name: 'photo'; photos: File[] }
  | { name: 'exercise'; piece: Piece; harmony: Harmony }
  | { name: 'admin' }
  | { name: 'teacher' }

function newExercise(options: ExerciseOptions): { piece: Piece; harmony: Harmony } {
  const seed = Math.floor(Math.random() * 2 ** 31)
  const exercise = generateExercise(options, seed)
  const piece = { id: `exercise:${seed}`, title: exercise.title, instrument: exercise.options.instrument, file: null, content: exerciseToMusicXml(exercise) }
  return { piece, harmony: exercise.harmony }
}

export default function App() {
  const [view, setView] = useState<View>({ name: 'library' })
  const [exerciseOptions, setExerciseOptions] = useState(savedExerciseOptions)
  // Kept here so coming back from a piece shows the same notebook.
  const [notebookId, setNotebookId] = useState<string | null>(null)
  const account = useAccount()
  // Requests waiting for the administrator; null until counted.
  const [pending, setPending] = useState<number | null>(null)
  const profile = account.state === 'signedIn' && account.profile?.status === 'approved' ? account.profile : null
  // Teachers and the administrator keep their notebooks on the server; students, on the device.
  const staff = profile && profile.role !== 'student' ? profile : null
  // Only students' practice is saved, so their teacher can follow it.
  const student = profile?.role === 'student' ? profile : null
  const notebookStore = useMemo(() => (staff ? accountNotebooks(staff) : deviceNotebooks), [staff])
  const toLibrary = () => setView({ name: 'library' })
  const startExercise = (options: ExerciseOptions) => {
    setExerciseOptions(options)
    setView({ name: 'exercise', ...newExercise(options) })
  }
  // The accompaniment chosen while practising is kept for the next exercises.
  const chooseAccompaniment = (accompaniment: ExerciseOptions['accompaniment']) => {
    const options = { ...exerciseOptions, accompaniment }
    saveExerciseOptions(options)
    setExerciseOptions(options)
  }
  if (account.state === 'loading') return <p className="score-message">Cargando…</p>
  if (account.state === 'signedOut') return <LoginScreen />
  if (account.state === 'signedIn' && account.profile?.status !== 'approved') {
    return <WaitingScreen profile={account.profile} onCheck={account.reload} />
  }
  switch (view.name) {
    case 'teacher':
      return profile ? <TeacherScreen me={profile} notebookStore={notebookStore} onBack={toLibrary} /> : null
    case 'admin':
      return <AdminScreen onBack={toLibrary} onPending={setPending} />
    case 'practice':
      return <LoggedPractice log={!!student} kind="piece" piece={view.piece} onBack={toLibrary} />
    case 'review':
      return <ReviewScreen onBack={toLibrary} />
    case 'photo':
      return <PhotoScreen photos={view.photos} onBack={toLibrary} />
    case 'exercises':
      return <ExercisesScreen options={exerciseOptions} onCreate={startExercise} onBack={toLibrary} />
    case 'exercise':
      return (
        <LoggedPractice key={view.piece.id} log={!!student} kind="exercise" piece={view.piece} backLabel="Ejercicios"
          onBack={() => setView({ name: 'exercises' })} onAnother={() => startExercise(exerciseOptions)}
          accompaniment={view.harmony.slots.length ? { harmony: view.harmony, style: exerciseOptions.accompaniment ?? 'off', onChange: chooseAccompaniment } : undefined} />
      )
    default: {
      const accountBar = profile && (
        <AccountBar profile={profile} pending={pending} onPending={setPending} onAdmin={() => setView({ name: 'admin' })} onTeacher={() => setView({ name: 'teacher' })} />
      )
      if (student) {
        return <StudentScreen me={student} onOpen={piece => setView({ name: 'practice', piece })} onExercises={() => setView({ name: 'exercises' })} accountBar={accountBar} />
      }
      return (
        <LibraryScreen onOpen={piece => setView({ name: 'practice', piece })} onReview={() => setView({ name: 'review' })}
          onExercises={() => setView({ name: 'exercises' })} onPhotos={photos => setView({ name: 'photo', photos })}
          notebookId={notebookId} onNotebook={setNotebookId} notebookStore={notebookStore}
          accountBar={accountBar} />
      )
    }
  }
}
