import test from 'node:test'
import assert from 'node:assert/strict'
import { manejar } from '../src/main.js'
import { crearFake } from '../../_comun/fake.js'

const AHORA = new Date('2026-10-30T12:00:00Z')
const montar = () => crearFake({
  perfiles: { admin1: { nombre: 'Ana', rol: 'admin', activo: true } },
  bases: { slp: { nombre: 'SLP', activa: true } },
})
const llamar = (tdb, uid, cuerpo) => manejar({ tdb, ahora: AHORA, uid, cuerpo })

test('módulo desconocido o ausente → 400', async () => {
  assert.equal((await llamar(montar(), 'admin1', { modulo: 'x' })).status, 400)
  assert.equal((await llamar(montar(), 'admin1', {})).status, 400)
})
test('sin sesión → 401 antes de enrutar', async () => {
  assert.equal((await llamar(montar(), undefined, { modulo: 'bases', accion: 'crear', nombre: 'X' })).status, 401)
})
test('enruta a bases', async () => {
  const tdb = montar()
  const r = await llamar(tdb, 'admin1', { modulo: 'bases', accion: 'crear', nombre: 'MONTERREY' })
  assert.equal(r.status, 200)
  assert.equal((await tdb.getRow({ tableId: 'bases', rowId: 'monterrey' })).activa, true)
})
test('enruta a operadores (crear sin datos → 400, no 404 de módulo)', async () => {
  const r = await llamar(montar(), 'admin1', { modulo: 'operadores', accion: 'crear' })
  assert.equal(r.status, 400)
  assert.match(r.body.mensaje, /datos/i)
})

test('con cambio de contraseña pendiente el servidor solo permite el módulo password', async () => {
  const tdb = crearFake({ perfiles: { u1: { nombre: 'Ana', rol: 'admin', activo: true, debe_cambiar: true } }, bases: {} })
  const r = await llamar(tdb, 'u1', { modulo: 'bases', accion: 'crear', nombre: 'X' })
  assert.equal(r.status, 403)
  assert.match(r.body.mensaje, /contraseña/i)
  const p = await llamar(tdb, 'u1', { modulo: 'password', actual: 'a' })        // llega al módulo (faltan datos → 400, no 403)
  assert.equal(p.status, 400)
})
