import { usePracticeLog } from '../../account/usePracticeLog'
import { PracticeScreen, type PracticeProps } from '../screens/PracticeScreen'

/** The practice screen, saving the student's time and results when log is on. */
export function LoggedPractice({ log, kind, ...props }: PracticeProps & { log: boolean; kind: 'piece' | 'exercise' }) {
  const onSummary = usePracticeLog(props.piece, kind, log)
  return <PracticeScreen {...props} onSummary={onSummary} />
}
