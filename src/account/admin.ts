import { fullName, server, type Profile } from './account'

// The administrator's view of the school: every account and which students each
// teacher has.

export interface TeacherStudent {
  teacher_id: string
  student_id: string
}

export interface School {
  profiles: Profile[]
  links: TeacherStudent[]
}

export async function loadSchool(): Promise<School> {
  const supabase = server()
  const [profiles, links] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('teacher_students').select('teacher_id, student_id'),
  ])
  if (profiles.error) throw profiles.error
  if (links.error) throw links.error
  return { profiles: profiles.data as Profile[], links: links.data as TeacherStudent[] }
}

export async function setTeacherStudent(link: TeacherStudent, linked: boolean): Promise<void> {
  const table = server().from('teacher_students')
  const { error } = linked
    ? await table.upsert(link, { ignoreDuplicates: true })
    : await table.delete().eq('teacher_id', link.teacher_id).eq('student_id', link.student_id)
  if (error) throw error
}

/** Alphabetical by name and surnames, the way the school lists people. */
export function byName(a: Profile, b: Profile): number {
  return fullName(a).localeCompare(fullName(b), 'es', { sensitivity: 'base' })
}

/** Accepted accounts of one role, in alphabetical order. */
export function members(school: School, role: 'teacher' | 'student'): Profile[] {
  return school.profiles.filter(p => p.role === role && p.status === 'approved').sort(byName)
}

export function isLinked(school: School, teacherId: string, studentId: string): boolean {
  return school.links.some(l => l.teacher_id === teacherId && l.student_id === studentId)
}

/** The school after linking or unlinking a teacher and a student. */
export function withLink(school: School, link: TeacherStudent, linked: boolean): School {
  const others = school.links.filter(l => l.teacher_id !== link.teacher_id || l.student_id !== link.student_id)
  return { ...school, links: linked ? [...others, link] : others }
}

/** Matches a person by name, surnames, email or phone, ignoring accents and capitals. */
export function matchesPerson(profile: Profile, query: string): boolean {
  const plain = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const words = plain(query).split(/\s+/).filter(Boolean)
  const text = plain(`${fullName(profile)} ${profile.email} ${profile.telefono.replace(/\s/g, '')}`)
  return words.every(word => text.includes(word))
}

/** Removes every teacher–student pair of one person, when they change between student and teacher. */
export async function unlinkEveryone(id: string): Promise<void> {
  const { error } = await server().from('teacher_students').delete().or(`teacher_id.eq.${id},student_id.eq.${id}`)
  if (error) throw error
}
