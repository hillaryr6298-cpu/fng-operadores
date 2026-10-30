import { describe, it, expect } from 'vitest'
import { aplicarEvento, cargarTodasLasFilas, deFila, type Op } from './datos'
import { ETAPAS } from '../../shared/dominio'

const fila = (id: string, version: number, extra: Record<string, unknown> = {}) => {
  const f: Record<string, unknown> = {
    $id: id, nombre: `OP ${id}`, base: 'SLP', reclutador_id: 'r1', reclutador_nombre: 'REC A', modalidad: 'FULL',
    estatus: 'PREMEDICO_INTERNO', observaciones: '', motivo_descarte: '', version, fecha_inicio: '2026-10-12T00:00:00.000+00:00',
  }
  for (const e of ETAPAS) { f[`${e.clave}_fecha`] = null; f[`${e.clave}_res`] = null }
  return { ...f, ...extra }
}

describe('deFila', () => {
  it('convierte una fila de Appwrite al modelo de la app', () => {
    const op = deFila(fila('a', 3, { quimica_sanguinea_fecha: '2026-10-15T00:00:00.000+00:00', quimica_sanguinea_res: 'FECHA' }))
    expect(op.id).toBe('a'); expect(op.version).toBe(3)
    expect(op.fecha_inicio).toBe('2026-10-12')
    expect(op.etapas.quimica_sanguinea).toEqual({ fecha: '2026-10-15', res: 'FECHA' })
  })
})

describe('aplicarEvento', () => {
  const base: Op[] = [deFila(fila('a', 1)), deFila(fila('b', 1))]
  it('create agrega', () => {
    expect(aplicarEvento(base, 'create', fila('c', 1)).map((o) => o.id)).toEqual(['a', 'b', 'c'])
  })
  it('update reemplaza si la versión es mayor', () => {
    const r = aplicarEvento(base, 'update', fila('a', 2, { observaciones: 'x' }))
    expect(r.find((o) => o.id === 'a')!.observaciones).toBe('x')
  })
  it('update con versión menor se ignora', () => {
    const lista = aplicarEvento(base, 'update', fila('a', 3, { observaciones: 'nuevo' }))
    const r = aplicarEvento(lista, 'update', fila('a', 2, { observaciones: 'viejo' }))
    expect(r.find((o) => o.id === 'a')!.observaciones).toBe('nuevo')
  })
  it('update con la MISMA versión reemplaza: un guardado emite dos eventos con la misma versión (incremento y luego datos)', () => {
    const tras1 = aplicarEvento(base, 'update', fila('a', 2, { observaciones: '' }))     // evento del incremento atómico
    const tras2 = aplicarEvento(tras1, 'update', fila('a', 2, { observaciones: 'datos finales' }))
    expect(tras2.find((o) => o.id === 'a')!.observaciones).toBe('datos finales')
  })
  it('update de un id desconocido lo agrega', () => {
    expect(aplicarEvento(base, 'update', fila('z', 5)).map((o) => o.id)).toContain('z')
  })
  it('delete quita', () => {
    expect(aplicarEvento(base, 'delete', fila('a', 1)).map((o) => o.id)).toEqual(['b'])
  })
  it('create duplicado no duplica', () => {
    expect(aplicarEvento(base, 'create', fila('a', 1))).toHaveLength(2)
  })
})

describe('cargarTodasLasFilas', () => {
  it('carga en varias páginas hasta agotar (250 filas, lote 100)', async () => {
    const todas = Array.from({ length: 250 }, (_, i) => fila(`id${i}`, 1))
    const llamadas: (string | undefined)[] = []
    const listar = async (cursor?: string) => {
      llamadas.push(cursor)
      const ini = cursor ? todas.findIndex((f) => f.$id === cursor) + 1 : 0
      return { rows: todas.slice(ini, ini + 100) }
    }
    const r = await cargarTodasLasFilas(listar, 100)
    expect(r).toHaveLength(250)
    expect(llamadas).toEqual([undefined, 'id99', 'id199'])
  })
  it('lista vacía devuelve []', async () => {
    expect(await cargarTodasLasFilas(async () => ({ rows: [] }), 100)).toEqual([])
  })
})
