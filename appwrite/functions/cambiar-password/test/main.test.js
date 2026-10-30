import test from 'node:test'
import assert from 'node:assert/strict'
import { manejar } from '../src/main.js'
import { crearFake, crearFakeUsers } from '../../_comun/fake.js'

const AHORA = new Date('2026-10-30T12:00:00Z')
const montar = () => {
  const tdb = crearFake({ perfiles: { rec1: { nombre: 'CARMEN', rol: 'reclutador', activo: true, email: 'c@x.mx', debe_cambiar: true } } })
  const users = crearFakeUsers()
  users._u.set('rec1', { $id: 'rec1', email: 'c@x.mx', password: 'Actual-Temporal-1', sesiones: 1 })
  const verificarPassword = async (email, pass) => users._u.get('rec1').email === email && users._u.get('rec1').password === pass
  return { tdb, users, verificarPassword }
}
const llamar = (m, uid, cuerpo) => manejar({ ...m, ahora: AHORA, uid, cuerpo })

test('sin sesión → 401', async () => {
  assert.equal((await llamar(montar(), undefined, { actual: 'a', nueva: 'b' })).status, 401)
})
test('contraseña actual incorrecta → 403 y no cambia nada', async () => {
  const m = montar()
  const r = await llamar(m, 'rec1', { actual: 'incorrecta-123456', nueva: 'Nueva-Contraseña-9' })
  assert.equal(r.status, 403)
  assert.equal(m.users._u.get('rec1').password, 'Actual-Temporal-1')
})
test('nueva de menos de 12 → 400', async () => {
  assert.equal((await llamar(montar(), 'rec1', { actual: 'Actual-Temporal-1', nueva: 'Corta-123' })).status, 400)
})
test('nueva igual a la actual → 400', async () => {
  assert.equal((await llamar(montar(), 'rec1', { actual: 'Actual-Temporal-1', nueva: 'Actual-Temporal-1' })).status, 400)
})
test('éxito: cambia contraseña, limpia debe_cambiar, cierra sesiones y audita', async () => {
  const m = montar()
  const r = await llamar(m, 'rec1', { actual: 'Actual-Temporal-1', nueva: 'Nueva-Contraseña-9' })
  assert.equal(r.status, 200)
  assert.equal(m.users._u.get('rec1').password, 'Nueva-Contraseña-9')
  assert.equal((await m.tdb.getRow({ tableId: 'perfiles', rowId: 'rec1' })).debe_cambiar, false)
  assert.equal(m.users._u.get('rec1').sesiones, 0)
  const aud = (await m.tdb.listRows({ tableId: 'auditoria' })).rows[0]
  assert.equal(aud.accion, 'cambiar_password'); assert.ok(!JSON.stringify(aud).includes('Nueva-Contraseña-9'))
})
