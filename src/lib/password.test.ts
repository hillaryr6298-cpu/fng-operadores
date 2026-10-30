import { describe, it, expect } from 'vitest'
import { generarPassword } from './password'
import { validarPassword } from '../../shared/dominio'

describe('generarPassword', () => {
  it('genera 16 caracteres que cumplen la política', () => {
    for (let i = 0; i < 50; i++) {
      const p = generarPassword()
      expect(p).toHaveLength(16)
      expect(validarPassword(p)).toBeNull()
    }
  })
  it('evita caracteres ambiguos (0 O o 1 l I)', () => {
    for (let i = 0; i < 50; i++) expect(generarPassword()).not.toMatch(/[0Oo1lI]/)
  })
  it('es distinta cada vez', () => {
    expect(new Set(Array.from({ length: 30 }, generarPassword)).size).toBe(30)
  })
})
