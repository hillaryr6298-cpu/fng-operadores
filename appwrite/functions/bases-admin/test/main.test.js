import test from 'node:test'
import assert from 'node:assert/strict'
import { manejar } from '../src/main.js'
import { crearFake } from '../../_comun/fake.js'

const AHORA = new Date('2026-10-30T12:00:00Z')
const montar = () => crearFake({
  perfiles: { admin1: { nombre: 'Ana', rol: 'admin', activo: true }, ger1: { nombre: 'Gina', rol: 'gerente_rh', activo: true } },
  bases: { slp: { nombre: 'SLP', activa: true } },
})
const llamar = (tdb, uid, cuerpo) => manejar({ tdb, ahora: AHORA, uid, cuerpo })

test('solo admin → 403 para gerente', async () => {
  assert.equal((await llamar(montar(), 'ger1', { accion: 'crear', nombre: 'MONTERREY' })).status, 403)
})
test('crear normaliza nombre, usa id slug y audita', async () => {
  const tdb = montar()
  const r = await llamar(tdb, 'admin1', { accion: 'crear', nombre: '  Monterréy  Norte ' })
  assert.equal(r.status, 200)
  const b = await tdb.getRow({ tableId: 'bases', rowId: 'monterrey_norte' })
  assert.equal(b.nombre, 'MONTERREY NORTE'); assert.equal(b.activa, true)
  assert.equal((await tdb.listRows({ tableId: 'auditoria' })).rows[0].entidad, 'bases')
})
test('nombre repetido → 409; nombre vacío o largo → 400', async () => {
  const tdb = montar()
  assert.equal((await llamar(tdb, 'admin1', { accion: 'crear', nombre: 'slp' })).status, 409)
  assert.equal((await llamar(tdb, 'admin1', { accion: 'crear', nombre: '  ' })).status, 400)
  assert.equal((await llamar(tdb, 'admin1', { accion: 'crear', nombre: 'x'.repeat(61) })).status, 400)
})
test('desactivar y activar', async () => {
  const tdb = montar()
  await llamar(tdb, 'admin1', { accion: 'desactivar', id: 'slp' })
  assert.equal((await tdb.getRow({ tableId: 'bases', rowId: 'slp' })).activa, false)
  await llamar(tdb, 'admin1', { accion: 'activar', id: 'slp' })
  assert.equal((await tdb.getRow({ tableId: 'bases', rowId: 'slp' })).activa, true)
  assert.equal((await llamar(tdb, 'admin1', { accion: 'activar', id: 'nada' })).status, 404)
})
