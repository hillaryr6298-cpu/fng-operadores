import { describe, it, expect } from 'vitest'
import { resumenPor, atrasados, conteoPorEstatus, conteoPorEtapa, etapaActual, porReclutador, promedioDias } from './metricas'
import { ETAPAS } from '../../shared/dominio'
import type { Op } from './datos'

const HOY = new Date('2026-10-30T00:00:00Z')
const op = (id: string, over: Partial<Op> = {}, etapas: Record<string, { fecha: string | null; res: any }> = {}): Op => ({
  id, version: 1, nombre: id, base: 'SLP', reclutador_id: 'r1', reclutador_nombre: 'REC A', modalidad: 'FULL', estatus: 'PREMEDICO_INTERNO',
  fecha_inicio: null, etapas: { ...Object.fromEntries(ETAPAS.map((e) => [e.clave, { fecha: null, res: null }])), ...etapas } as any, ...over,
})
const f = (d: string) => ({ fecha: d, res: 'FECHA' as const })

describe('etapaActual', () => {
  it('es la última etapa con registro', () => {
    expect(etapaActual(op('a', {}, { quimica_sanguinea: f('2026-10-01'), solicitud_examen_cryo: f('2026-10-03') }))).toBe('solicitud_examen_cryo')
  })
  it('cuenta resultados sin fecha como registro', () => {
    expect(etapaActual(op('a', {}, { quimica_sanguinea: { fecha: null, res: 'NA_LOCAL' } }))).toBe('quimica_sanguinea')
  })
  it('sin nada es "sin_iniciar"', () => { expect(etapaActual(op('a'))).toBe('sin_iniciar') })
})

describe('conteos', () => {
  const ops = [
    op('a', {}, { quimica_sanguinea: f('2026-10-01') }),
    op('b', {}, { quimica_sanguinea: f('2026-10-01') }),
    op('c', { estatus: 'DESCARTADO' }, { quimica_sanguinea: f('2026-10-01') }),
    op('d', { estatus: 'CONTRATADO', reclutador_nombre: 'REC B' }, { contratacion: f('2026-10-20') }),
  ]
  it('por etapa solo cuenta operadores en proceso', () => { expect(conteoPorEtapa(ops)).toEqual({ quimica_sanguinea: 2 }) })
  it('por estatus cuenta todos', () => { expect(conteoPorEstatus(ops)).toMatchObject({ PREMEDICO_INTERNO: 2, DESCARTADO: 1, CONTRATADO: 1 }) })
  it('por reclutador solo en proceso', () => { expect(porReclutador(ops)).toEqual([{ nombre: 'REC A', total: 2 }]) })
})

describe('promedioDias', () => {
  it('promedia solo en proceso con fechas', () => {
    const ops = [op('a', {}, { quimica_sanguinea: f('2026-10-20') }), op('b', {}, { quimica_sanguinea: f('2026-10-10') }), op('c')]
    expect(promedioDias(ops, HOY)).toBe(15)
  })
  it('sin datos devuelve null', () => { expect(promedioDias([op('a')], HOY)).toBeNull() })
})

describe('atrasados', () => {
  it('lista los que llevan más de N días sin avance, del más atrasado al menos', () => {
    const ops = [
      op('reciente', {}, { quimica_sanguinea: f('2026-10-28') }),
      op('viejo', {}, { quimica_sanguinea: f('2026-09-01') }),
      op('medio', {}, { quimica_sanguinea: f('2026-10-05') }),
      op('sinfechas', {}, { quimica_sanguinea: { fecha: null, res: 'OP_VIAJE' } }),
      op('cerrado', { estatus: 'CONTRATADO' }, { quimica_sanguinea: f('2026-08-01') }),
    ]
    expect(atrasados(ops, HOY, 15).map((x) => [x.op.id, x.dias])).toEqual([['viejo', 59], ['medio', 25]])
  })
})

describe('resumenPor', () => {
  it('agrupa por base con conteos y promedio de días de los que siguen en proceso', () => {
    const ops = [
      op('a', { base: 'SLP' }, { quimica_sanguinea: f('2026-10-20') }),
      op('b', { base: 'SLP' }, { quimica_sanguinea: f('2026-10-10') }),
      op('c', { base: 'SLP', estatus: 'CONTRATADO' }, { quimica_sanguinea: f('2026-10-01'), contratacion: f('2026-10-11') }),
      op('d', { base: 'TEX', estatus: 'DESCARTADO' }),
    ]
    expect(resumenPor(ops, 'base', HOY)).toEqual([
      { clave: 'SLP', enProceso: 2, contratados: 1, descartados: 0, promedioDias: 15 },
      { clave: 'TEX', enProceso: 0, contratados: 0, descartados: 1, promedioDias: null },
    ])
  })
})

describe('atrasados con operadores sin fechas de etapa', () => {
  it('usa la fecha de inicio (alta) como respaldo', () => {
    const ops = [op('viaje', { fecha_inicio: '2026-09-30' }, { quimica_sanguinea: { fecha: null, res: 'OP_VIAJE' } })]
    expect(atrasados(ops, HOY, 15).map((x) => [x.op.id, x.dias])).toEqual([['viaje', 30]])
  })
})
