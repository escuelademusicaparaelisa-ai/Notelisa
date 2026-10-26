import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { buildTimeline, type MeasureInfo, type RawStep, type ScoreNote, type Timeline } from './timeline'

const DEFAULT_BPM = 100

/**
 * Walks the OSMD cursor through the whole score once and converts every cursor
 * position into a step. Step i always matches cursor position i, so moving the
 * cursor to a step is just "reset + next() i times".
 */
export function extractTimeline(osmd: OpenSheetMusicDisplay): Timeline {
  const sheet = osmd.Sheet
  const cursor = osmd.cursor
  const raw: RawStep[] = []

  cursor.reset()
  while (!cursor.Iterator.EndReached) {
    const notes: ScoreNote[] = []
    for (const note of cursor.NotesUnderCursor()) {
      if (note.isRest() || note.Pitch === undefined) continue
      const tie = note.NoteTie
      notes.push({
        // OSMD half tones are offset by one octave from MIDI numbers.
        midi: note.halfTone + 12,
        staff: note.ParentStaffEntry.ParentStaff.idInMusicSheet,
        voice: note.ParentVoiceEntry.ParentVoice.VoiceId,
        duration: note.Length.RealValue,
        tiedContinuation: !!tie && tie.StartNote !== note,
      })
    }
    raw.push({
      measureIndex: cursor.Iterator.CurrentMeasureIndex,
      scoreTime: cursor.Iterator.currentTimeStamp.RealValue,
      notes,
    })
    cursor.next()
  }
  cursor.reset()

  const measures: MeasureInfo[] = sheet.SourceMeasures.map(m => ({
    start: m.AbsoluteTimestamp.RealValue,
    duration: m.Duration.RealValue,
  }))
  const staffCount = sheet.Staves.length
  const bpm = sheet.DefaultStartTempoInBpm > 0 ? sheet.DefaultStartTempoInBpm : DEFAULT_BPM
  return buildTimeline(raw, measures, bpm, staffCount)
}
