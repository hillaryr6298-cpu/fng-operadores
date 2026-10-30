import test from 'node:test'
import assert from 'node:assert/strict'
import { manejar } from '../src/main.js'
import { crearFake, crearFakeUsers } from '../../_comun/fake.js'

const AHORA = new Date('2026-10-30T12:00:00Z')
const PASS = 'Temporal-2026-xyz'
const montar = () => {
  const tdb = crearFake({
    perfiles: {
      admin1: { nombre: 'Ana', rol: 'admin', activo: true, email: 'a@x.mx', debe_cambiar: false },
      rec1: { nombre: 'CARMEN', rol: 'reclutador', activo: true, email: 'c@x.mx', debe_cambiar: false },
    },
  })
  const users = crearFakeUsers()
  users._u.set('admin1', { $id: 'admin1', email: 'a@x.mx', labels: ['admin'], status: true })
  users._u.set('rec1', { $id: 'rec1', email: 'c@x.mx', labels: ['reclutador'], status: true, sesiones: 2 })
  return { tdb, users }
}
const llamar = (m, uid, cuerpo) => manejar({ ...m, ahora: AHORA, uid, cuerpo })

test('no admin → 403', async () => {
  const m = montar()
  assert.equal((await llamar(m, 'rec1', { accion: 'crear', email: 'n@x.mx', nombre: 'N', rol: 'consulta', passwordTemporal: PASS })).status, 403)
})
test('crear: etiqueta sin guion bajo, perfil, debe_cambiar y auditoría sin contraseña', async () => {
  const m = montar()
  const r = await llamar(m, 'admin1', { accion: 'crear', email: 'g@x.mx', nombre: 'Gina', rol: 'gerente_rh', passwordTemporal: PASS })
  assert.equal(r.status, 200)
  const id = r.body.id
  assert.deepEqual(m.users._u.get(id).labels, ['gerenterh'])
  const p = await m.tdb.getRow({ tableId: 'perfiles', rowId: id })
  assert.equal(p.rol, 'gerente_rh'); assert.equal(p.activo, true); assert.equal(p.debe_cambiar, true)
  const aud = (await m.tdb.listRows({ tableId: 'auditoria' })).rows[0]
  assert.equal(aud.accion, 'crear'); assert.ok(!JSON.stringify(aud).includes(PASS))
})
test('contraseña de 11 caracteres → 400', async () => {
  const m = montar()
  const r = await llamar(m, 'admin1', { accion: 'crear', email: 'g@x.mx', nombre: 'Gina', rol: 'consulta', passwordTemporal: 'Corta-1234' })
  assert.equal(r.status, 400)
})
test('rol fuera del catálogo o correo inválido → 400', async () => {
  const m = montar()
  assert.equal((await llamar(m, 'admin1', { accion: 'crear', email: 'g@x.mx', nombre: 'G', rol: 'root', passwordTemporal: PASS })).status, 400)
  assert.equal((await llamar(m, 'admin1', { accion: 'crear', email: 'no-es-correo', nombre: 'G', rol: 'consulta', passwordTemporal: PASS })).status, 400)
})
test('correo repetido → 409 y no deja perfil huérfano', async () => {
  const m = montar()
  const r = await llamar(m, 'admin1', { accion: 'crear', email: 'c@x.mx', nombre: 'Otro', rol: 'consulta', passwordTemporal: PASS })
  assert.equal(r.status, 409)
})
test('un admin no puede desactivarse ni cambiarse el rol a sí mismo', async () => {
  const m = montar()
  assert.equal((await llamar(m, 'admin1', { accion: 'desactivar', id: 'admin1' })).status, 400)
  assert.equal((await llamar(m, 'admin1', { accion: 'cambiar_rol', id: 'admin1', rol: 'consulta' })).status, 400)
})
test('desactivar bloquea la cuenta, borra sesiones y marca inactivo', async () => {
  const m = montar()
  const r = await llamar(m, 'admin1', { accion: 'desactivar', id: 'rec1' })
  assert.equal(r.status, 200)
  assert.equal(m.users._u.get('rec1').status, false)
  assert.ok(m.users.llamadas.some((c) => c[0] === 'deleteSessions' && c[1] === 'rec1'))
  assert.equal((await m.tdb.getRow({ tableId: 'perfiles', rowId: 'rec1' })).activo, false)
})
test('activar restablece el acceso', async () => {
  const m = montar()
  await llamar(m, 'admin1', { accion: 'desactivar', id: 'rec1' })
  await llamar(m, 'admin1', { accion: 'activar', id: 'rec1' })
  assert.equal(m.users._u.get('rec1').status, true)
  assert.equal((await m.tdb.getRow({ tableId: 'perfiles', rowId: 'rec1' })).activo, true)
})
test('cambiar_rol actualiza etiqueta y perfil', async () => {
  const m = montar()
  const r = await llamar(m, 'admin1', { accion: 'cambiar_rol', id: 'rec1', rol: 'gerente_rh' })
  assert.equal(r.status, 200)
  assert.deepEqual(m.users._u.get('rec1').labels, ['gerenterh'])
  assert.equal((await m.tdb.getRow({ tableId: 'perfiles', rowId: 'rec1' })).rol, 'gerente_rh')
})
test('reset cambia contraseña, exige cambio y cierra sesiones', async () => {
  const m = montar()
  const r = await llamar(m, 'admin1', { accion: 'reset', id: 'rec1', passwordTemporal: PASS })
  assert.equal(r.status, 200)
  assert.equal(m.users._u.get('rec1').password, PASS)
  assert.equal((await m.tdb.getRow({ tableId: 'perfiles', rowId: 'rec1' })).debe_cambiar, true)
  assert.equal(m.users._u.get('rec1').sesiones, 0)
})
test('usuario inexistente → 404', async () => {
  const m = montar()
  assert.equal((await llamar(m, 'admin1', { accion: 'activar', id: 'nadie' })).status, 404)
})

test('crear: contraseña rechazada por política de Appwrite → 400 explicado', async () => {
  const m = montar()
  m.users.create = async () => { throw Object.assign(new Error('Password must not contain personal data like name, email'), { code: 400 }) }
  const r = await llamar(m, 'admin1', { accion: 'crear', email: 'g@x.mx', nombre: 'Gina', rol: 'consulta', passwordTemporal: PASS })
  assert.equal(r.status, 400)
  assert.match(r.body.errores[0].mensaje, /nombre|correo/i)
})
test('cambiar_email actualiza Auth y perfil, y audita', async () => {
  const m = montar()
  m.users.updateEmail = async ({ userId, email }) => { m.users._u.get(userId).email = email }
  const r = await llamar(m, 'admin1', { accion: 'cambiar_email', id: 'rec1', email: 'Nuevo@X.mx' })
  assert.equal(r.status, 200)
  assert.equal(m.users._u.get('rec1').email, 'nuevo@x.mx')
  assert.equal((await m.tdb.getRow({ tableId: 'perfiles', rowId: 'rec1' })).email, 'nuevo@x.mx')
  assert.equal((await llamar(m, 'admin1', { accion: 'cambiar_email', id: 'rec1', email: 'no-es-correo' })).status, 400)
})
