import test from 'node:test'
import assert from 'node:assert/strict'
import { manejar } from '../src/main.js'
import { crearFake } from '../../_comun/fake.js'
import { ETAPAS } from '../../../../shared/dominio.ts'

const AHORA = new Date('2026-10-30T12:00:00Z')
const vacias = () => Object.fromEntries(ETAPAS.map((e) => [e.clave, { fecha: null, res: null }]))
const op = (n, o = {}) => ({
  nombre: `Persona ${n}`, base: 'SLP', reclutador_id: 'rec1', modalidad: 'FULL', estatus: 'PREMEDICO_INTERNO',
  etapas: { ...vacias(), quimica_sanguinea: { fecha: '2026-10-15', res: 'FECHA' } }, ...o,
})
const montar = () => crearFake({
  perfiles: {
    admin1: { nombre: 'Ana', rol: 'admin', activo: true }, ger1: { nombre: 'Gina', rol: 'gerente_rh', activo: true },
    rec1: { nombre: 'REC A', rol: 'reclutador', activo: true },
  },
  bases: { slp: { nombre: 'SLP', activa: true }, tex: { nombre: 'TEX', activa: false } },
})
const llamar = (tdb, uid, cuerpo) => manejar({ tdb, ahora: AHORA, uid, cuerpo })

test('reclutador → 403', async () => {
  assert.equal((await llamar(montar(), 'rec1', { filas: [op(1)], confirmar: false })).status, 403)
})
test('sin confirmar valida y no escribe', async () => {
  const tdb = montar()
  const r = await llamar(tdb, 'ger1', { filas: [op(1), op(2)], confirmar: false })
  assert.equal(r.status, 200); assert.equal(r.body.validas, 2); assert.deepEqual(r.body.errores, [])
  assert.equal((await tdb.listRows({ tableId: 'operadores' })).total, 0)
})
test('con confirmar crea todas, con auditoría "importar" y versión 1', async () => {
  const tdb = montar()
  const r = await llamar(tdb, 'admin1', { filas: [op(1), op(2)], confirmar: true })
  assert.equal(r.status, 200); assert.equal(r.body.creadas, 2)
  const filas = (await tdb.listRows({ tableId: 'operadores' })).rows
  assert.ok(filas.every((f) => f.version === 1 && f.reclutador_nombre === 'REC A'))
  assert.equal((await tdb.listRows({ tableId: 'auditoria' })).rows.filter((a) => a.accion === 'importar').length, 2)
})
test('un error en cualquier fila impide escribir todo (todo o nada)', async () => {
  const tdb = montar()
  const r = await llamar(tdb, 'admin1', { filas: [op(1), op(2, { base: 'NOEXISTE' })], confirmar: true })
  assert.equal(r.status, 400)
  assert.equal(r.body.errores[0].fila, 2)
  assert.equal((await tdb.listRows({ tableId: 'operadores' })).total, 0)
})
test('base desactivada, reclutador inexistente y duplicados dentro del lote → error por fila', async () => {
  const r = await llamar(montar(), 'admin1', { filas: [op(1, { base: 'TEX' }), op(2, { reclutador_id: 'x' }), op(3), op(3, {})], confirmar: false })
  const filas = r.body.errores.map((e) => e.fila)
  assert.deepEqual(filas, [1, 2, 4])
})
test('duplicado contra la base existente → error', async () => {
  const tdb = montar()
  await llamar(tdb, 'admin1', { filas: [op(1)], confirmar: true })
  const r = await llamar(tdb, 'admin1', { filas: [op(1, { nombre: ' PERSONA   1' })], confirmar: false })
  assert.equal(r.body.errores.length, 1)
})
test('más de 500 filas → 400', async () => {
  const filas = Array.from({ length: 501 }, (_, i) => op(i))
  assert.equal((await llamar(montar(), 'admin1', { filas, confirmar: false })).status, 400)
})
