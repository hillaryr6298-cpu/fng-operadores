import { describe, it, expect } from 'vitest'
import { parsearHojaOperadores } from './excel'
import hojas from './__fixtures__/hojas.json'

const HOY = new Date('2026-10-30T12:00:00Z')
const REC = ['A', 'B', 'C', 'D'].map((x) => ({ id: `id${x}`, nombre: `RECLUTADOR ${x}` }))
const cab = hojas.octubre[0]

describe('parsearHojaOperadores — hoja de octubre (datos reales anonimizados)', () => {
  const r = parsearHojaOperadores(hojas.octubre as any[][], REC, HOY)
  it('importa los 20 activos sin errores', () => {
    expect(r.errores).toEqual([])
    expect(r.filas).toHaveLength(20)
  })
  it('recorta espacios del nombre y mapea reclutador', () => {
    expect(r.filas.every((f) => f.nombre === f.nombre.trim())).toBe(true)
    expect(r.filas[0].reclutador_id).toBe('idA')
  })
  it('mapea estatus del Excel al catálogo', () => {
    const estatus = new Set(r.filas.map((f) => f.estatus))
    expect(estatus).toEqual(new Set(['LABORATORIOS', 'PREMEDICO_CRYO', 'PREMEDICO_INTERNO', 'VALIDACION_CARTAS']))
  })
  it('"N|A (LOCAL)" y "OP. VIAJE" son resultados, no fechas', () => {
    expect(r.filas[0].etapas.quimica_sanguinea).toEqual({ fecha: null, res: 'NA_LOCAL' })
    const viaje = r.filas.find((f) => f.etapas.quimica_sanguinea.res === 'OP_VIAJE')
    expect(viaje).toBeTruthy()
  })
  it('"OK" en prueba de manejo y fechas reales se conservan', () => {
    const ok = r.filas.find((f) => f.etapas.prueba_manejo.res === 'OK')
    expect(ok).toBeTruthy()
    expect(r.filas[0].etapas.revision_medica_interna).toEqual({ fecha: '2026-08-31', res: 'FECHA' })
  })
})

describe('hoja DESCARTADOS', () => {
  it('2 descartados con motivo tomado de observaciones', () => {
    const r = parsearHojaOperadores(hojas.descartados as any[][], REC, HOY, { descartados: true })
    expect(r.errores).toEqual([])
    expect(r.filas).toHaveLength(2)
    expect(r.filas.every((f) => f.estatus === 'DESCARTADO' && !!f.motivo_descarte)).toBe(true)
  })
})

describe('errores', () => {
  const fila = (o: Record<number, any>) => {
    const f: any[] = new Array(cab.length).fill(null)
    Object.assign(f, { 0: 'PERSONA UNO', 1: 'SLP', 2: 'RECLUTADOR A', 3: 'FULL', 4: 'PREMEDICO INTERNO' }, o)
    return f
  }
  it('ignora filas vacías', () => {
    const r = parsearHojaOperadores([cab, new Array(cab.length).fill(null), fila({})] as any[][], REC, HOY)
    expect(r.errores).toEqual([]); expect(r.filas).toHaveLength(1)
  })
  it('duplicado dentro del archivo → error con número de fila', () => {
    const r = parsearHojaOperadores([cab, fila({}), fila({ 0: ' persona  uno ' })] as any[][], REC, HOY)
    expect(r.errores).toEqual([{ fila: 3, mensaje: expect.stringMatching(/duplicad/i) }])
  })
  it('reclutador inexistente → error', () => {
    const r = parsearHojaOperadores([cab, fila({ 2: 'NADIE' })] as any[][], REC, HOY)
    expect(r.errores[0].fila).toBe(2); expect(r.errores[0].mensaje).toMatch(/reclutador/i)
  })
  it('texto desconocido en una celda de fecha → error con la columna', () => {
    const r = parsearHojaOperadores([cab, fila({ 5: 'quién sabe' })] as any[][], REC, HOY)
    expect(r.errores[0].mensaje).toMatch(/Química sanguínea/i)
  })
  it('acepta fechas como objeto Date', () => {
    const r = parsearHojaOperadores([cab, fila({ 6: new Date(2026, 9, 12) })] as any[][], REC, HOY)
    expect(r.filas[0].etapas.revision_medica_interna.fecha).toBe('2026-10-12')
  })
  it('estatus desconocido → error', () => {
    const r = parsearHojaOperadores([cab, fila({ 4: 'INVENTADO' })] as any[][], REC, HOY)
    expect(r.errores[0].mensaje).toMatch(/estatus/i)
  })
  it('falta la columna de nombre → error general en fila 1', () => {
    const r = parsearHojaOperadores([['FOO', 'BAR'], ['x', 'y']] as any[][], REC, HOY)
    expect(r.errores[0].fila).toBe(1)
  })
  it('valida reglas de dominio (CONTRATADO sin dictamen)', () => {
    const r = parsearHojaOperadores([cab, fila({ 4: 'CONTRATADO' })] as any[][], REC, HOY)
    expect(r.errores[0].mensaje).toMatch(/dictamen/i)
  })
})

import { exportarLibro } from './excel'
import { deFila } from './datos'
import * as XLSX from 'xlsx'
import { leerLibro } from './excel'
import { aDocumento } from '../../shared/dominio'

describe('exportarLibro', () => {
  const ops = [
    ...parsearHojaOperadores(hojas.octubre as any[][], REC, HOY).filas.map((f, i) => ({ ...f, id: `a${i}`, version: 1, reclutador_nombre: REC.find((r) => r.id === f.reclutador_id)!.nombre, fecha_inicio: null })),
    ...parsearHojaOperadores(hojas.descartados as any[][], REC, HOY, { descartados: true }).filas.map((f, i) => ({ ...f, id: `d${i}`, version: 1, reclutador_nombre: 'RECLUTADOR A', fecha_inicio: null })),
  ]
  it('ida y vuelta: exportar y volver a importar conserva nombres, etapas y motivos', () => {
    const libro = leerLibro(exportarLibro(ops as any, HOY))
    expect(libro.map((h) => h.nombre)).toEqual(expect.arrayContaining(['OPERADORES', 'DESCARTADOS', 'RESUMEN']))
    const act = parsearHojaOperadores(libro.find((h) => h.nombre === 'OPERADORES')!.filas, REC, HOY)
    const des = parsearHojaOperadores(libro.find((h) => h.nombre === 'DESCARTADOS')!.filas, REC, HOY, { descartados: true })
    expect(act.errores).toEqual([]); expect(des.errores).toEqual([])
    const esperado = ops.filter((o) => o.estatus !== 'DESCARTADO')
    expect(act.filas).toHaveLength(esperado.length)
    expect(act.filas.map((f) => aDocumento(f))).toEqual(esperado.map((f) => aDocumento(f)).map((d, i) => ({ ...d, reclutador_id: act.filas[i].reclutador_id })))
    expect(des.filas.map((f) => f.motivo_descarte)).toEqual(ops.filter((o) => o.estatus === 'DESCARTADO').map((o) => o.motivo_descarte))
  })
  it('la hoja RESUMEN lista conteos por estatus', () => {
    const resumen = leerLibro(exportarLibro(ops as any, HOY)).find((h) => h.nombre === 'RESUMEN')!.filas
    expect(JSON.stringify(resumen)).toContain('Laboratorios')
  })
})
