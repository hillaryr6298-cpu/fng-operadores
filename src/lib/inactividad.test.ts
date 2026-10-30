import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { iniciarTemporizadorInactividad } from './inactividad'

describe('iniciarTemporizadorInactividad', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('expira tras 30 min sin actividad', () => {
    const cb = vi.fn()
    iniciarTemporizadorInactividad(30, cb, new EventTarget())
    vi.advanceTimersByTime(29 * 60_000)
    expect(cb).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000 + 1)
    expect(cb).toHaveBeenCalledTimes(1)
  })
  it('la actividad reinicia la cuenta', () => {
    const cb = vi.fn(); const t = new EventTarget()
    iniciarTemporizadorInactividad(30, cb, t)
    vi.advanceTimersByTime(29 * 60_000)
    t.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(29 * 60_000)
    expect(cb).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000 + 1)
    expect(cb).toHaveBeenCalledTimes(1)
  })
  it('la función devuelta cancela el temporizador y los oyentes', () => {
    const cb = vi.fn(); const t = new EventTarget()
    const parar = iniciarTemporizadorInactividad(30, cb, t)
    parar()
    vi.advanceTimersByTime(60 * 60_000)
    expect(cb).not.toHaveBeenCalled()
  })
})
