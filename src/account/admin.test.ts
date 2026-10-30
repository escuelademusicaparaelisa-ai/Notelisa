import { describe, expect, it } from 'vitest'
import type { Profile } from './account'
import { isLinked, matchesPerson, members, withLink, type School } from './admin'

const person = (id: string, nombre: string, role: Profile['role'], status: Profile['status'] = 'approved'): Profile =>
  ({ id, nombre, apellidos: 'Gil', email: `${id}@example.com`, telefono: '600 123 456', role, status, created_at: '' })

const school: School = {
  profiles: [person('s2', 'Óscar', 'student'), person('s1', 'Ana', 'student'), person('s3', 'Pía', 'student', 'pending'), person('t1', 'Marta', 'teacher')],
  links: [{ teacher_id: 't1', student_id: 's1' }],
}

describe('members', () => {
  it('lists accepted accounts of a role in alphabetical order', () => {
    expect(members(school, 'student').map(p => p.id)).toEqual(['s1', 's2'])
    expect(members(school, 'teacher').map(p => p.id)).toEqual(['t1'])
  })
})

describe('withLink', () => {
  it('links and unlinks without duplicates', () => {
    const link = { teacher_id: 't1', student_id: 's2' }
    const linked = withLink(withLink(school, link, true), link, true)
    expect(linked.links).toHaveLength(2)
    expect(isLinked(linked, 't1', 's2')).toBe(true)
    expect(isLinked(withLink(linked, link, false), 't1', 's2')).toBe(false)
  })
})

describe('matchesPerson', () => {
  it('finds people by name without accents, email or phone', () => {
    const oscar = school.profiles[0]
    expect(matchesPerson(oscar, 'oscar gil')).toBe(true)
    expect(matchesPerson(oscar, 's2@example')).toBe(true)
    expect(matchesPerson(oscar, '600123')).toBe(true)
    expect(matchesPerson(oscar, 'ana')).toBe(false)
  })
})
