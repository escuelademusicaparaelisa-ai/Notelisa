import { describe, expect, it } from 'vitest'
import { errorMessage, fullName, newPasswordProblem, registrationProblem, type Registration } from './account'

const form: Registration = { nombre: 'Lucía', apellidos: 'Pérez Gil', telefono: '600 123 456', email: 'lucia@example.com', password: 'flauta1', role: 'student' }

describe('registrationProblem', () => {
  it('accepts a complete form', () => {
    expect(registrationProblem(form)).toBeNull()
  })

  it('asks for every field', () => {
    expect(registrationProblem({ ...form, apellidos: ' ' })).toMatch(/apellidos/)
    expect(registrationProblem({ ...form, telefono: '600' })).toMatch(/teléfono/)
    expect(registrationProblem({ ...form, email: 'lucia@' })).toMatch(/email/)
    expect(registrationProblem({ ...form, password: '123' })).toMatch(/contraseña/)
  })
})

describe('errorMessage', () => {
  it('explains known errors in Spanish', () => {
    expect(errorMessage({ code: 'invalid_credentials', message: '' })).toMatch(/no son correctos/)
    expect(errorMessage({ code: 'user_already_exists', message: '' })).toMatch(/Ya hay una cuenta/)
  })

  it('falls back to a connection message', () => {
    expect(errorMessage({ code: 'something_new', message: 'x' })).toMatch(/conectar/)
  })
})

it('joins name and surnames', () => {
  expect(fullName(form)).toBe('Lucía Pérez Gil')
})

describe('newPasswordProblem', () => {
  it('lets the password stay as it is when left empty', () => {
    expect(newPasswordProblem('')).toBeNull()
  })
  it('asks for at least the minimum length', () => {
    expect(newPasswordProblem('abc')).toMatch(/al menos/)
    expect(newPasswordProblem('abcdef')).toBeNull()
  })
})
