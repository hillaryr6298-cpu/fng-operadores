import { describe, it, expect } from 'vitest'
import { clasificarError } from './errores'

describe('clasificarError', () => {
  it('401/403 = sesión inválida', () => { expect(clasificarError({ code: 401 })).toBe('invalida'); expect(clasificarError({ code: 403 })).toBe('invalida') })
  it('sin código, 0 o 5xx = problema de red/servidor (no cerrar sesión)', () => {
    expect(clasificarError(new TypeError('Failed to fetch'))).toBe('red'); expect(clasificarError({ code: 0 })).toBe('red'); expect(clasificarError({ code: 503 })).toBe('red')
  })
  it('429 = demasiados intentos', () => { expect(clasificarError({ code: 429 })).toBe('limite') })
})
