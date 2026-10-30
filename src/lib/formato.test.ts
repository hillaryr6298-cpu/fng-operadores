import { describe, it, expect } from 'vitest'
import { valorAlEnter, fmtFecha, textoEtapa, etiquetaMes, hoyLocal, hoyISO } from './formato'

describe('formato', () => {
  it('fmtFecha pasa AAAA-MM-DD a dd/mm/aa', () => {
    expect(fmtFecha('2026-10-05')).toBe('05/10/26')
    expect(fmtFecha(null)).toBe('')
  })
  it('textoEtapa muestra fecha o resultado', () => {
    expect(textoEtapa({ fecha: '2026-10-05', res: 'FECHA' })).toBe('05/10/26')
    expect(textoEtapa({ fecha: null, res: 'NA_LOCAL' })).toBe('N/A LOCAL')
    expect(textoEtapa({ fecha: null, res: 'OP_VIAJE' })).toBe('OP. VIAJE')
    expect(textoEtapa({ fecha: null, res: 'NO_APTO' })).toBe('NO APTO')
    expect(textoEtapa({ fecha: null, res: null })).toBe('—')
  })
  it('etiquetaMes en español', () => {
    expect(etiquetaMes('2026-10')).toBe('octubre 2026')
    expect(etiquetaMes('2026-01')).toBe('enero 2026')
  })
  it('hoyLocal usa la fecha local, no la UTC', () => {
    const d = hoyLocal(new Date(2026, 9, 30, 22, 30))   // 30-oct 22:30 hora local
    expect(d.toISOString().slice(0, 10)).toBe('2026-10-30')
    expect(hoyISO(new Date(2026, 9, 30, 22, 30))).toBe('2026-10-30')
  })
})

describe('valorAlEnter', () => {
  it('con fecha guarda esa fecha', () => { expect(valorAlEnter('2026-10-05')).toEqual({ fecha: '2026-10-05', res: 'FECHA' }) })
  it('sin fecha no borra nada (null = no hacer nada)', () => { expect(valorAlEnter('')).toBeNull() })
})
