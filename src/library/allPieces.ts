import { isPlayable, loadLibrary, type Piece } from './catalog'
import { loadSchoolLibrary, type SchoolLibrary } from './school'

/** Every piece this device can show: the shipped library plus the school library when unlocked. */
export async function loadAllPieces(): Promise<{ pieces: Piece[]; all: Piece[]; school: SchoolLibrary }> {
  const [all, school] = await Promise.all([loadLibrary(), loadSchoolLibrary()])
  const playable = all.filter(isPlayable)
  // On the teacher's computer the same pieces exist unencrypted too.
  const schoolPieces = school.state === 'open' ? school.pieces.filter(p => !playable.some(l => l.id === p.id)) : []
  return { pieces: [...playable, ...schoolPieces], all, school }
}
