import test from 'node:test'
import assert from 'node:assert/strict'
import { manejar } from '../src/main.js'
import { crearFake } from '../../_comun/fake.js'
import { ETAPAS } from '../../../../shared/dominio.ts'

const AHORA = new Date('2026-10-30T12:00:00Z')
const etapasVacias = () => Object.fromEntries(ETAPAS.map((e) => [e.clave, { fecha: null, res: null }]))
const datos = (o = {}) => ({
  nombre: 'Pedro Prueba Álvarez', base: 'SLP', reclutador_id: 'rec1', modalidad: 'SENCILLO',
  estatus: 'LABORATORIOS', etapas: etapasVacias(), ...o,
})
const perfiles = () => ({
  admin1: { nombre: 'Ana', rol: 'admin', activo: true, email: 'a@x.mx' },
  ger1: { nombre: 'Gina', rol: 'gerente_rh', activo: true, email: 'g@x.mx' },
  rec1: { nombre: 'CARMEN', rol: 'reclutador', activo: true, email: 'c@x.mx' },
  rec2: { nombre: 'ALEX', rol: 'reclutador', activo: true, email: 'x@x.mx' },
  con1: { nombre: 'Luis', rol: 'consulta', activo: true, email: 'l@x.mx' },
  baja: { nombre: 'Baja', rol: 'reclutador', activo: false, email: 'b@x.mx' },
})
const llamar = (tdb, uid, cuerpo) => manejar({ tdb, ahora: AHORA, uid, cuerpo })
const nuevo = async (tdb, uid = 'rec1', d = datos()) => (await llamar(tdb, uid, { accion: 'crear', datos: d })).body.doc

test('sin identidad → 401', async () => {
  const tdb = crearFake({ perfiles: perfiles() })
  assert.equal((await llamar(tdb, undefined, { accion: 'crear', datos: datos() })).status, 401)
})
test('rol consulta → 403', async () => {
  const tdb = crearFake({ perfiles: perfiles() })
  assert.equal((await llamar(tdb, 'con1', { accion: 'crear', datos: datos() })).status, 403)
})
test('perfil desactivado → 403', async () => {
  const tdb = crearFake({ perfiles: perfiles() })
  assert.equal((await llamar(tdb, 'baja', { accion: 'crear', datos: datos({ reclutador_id: 'baja' }) })).status, 403)
})
test('reclutador no puede crear para otro reclutador → 403', async () => {
  const tdb = crearFake({ perfiles: perfiles() })
  assert.equal((await llamar(tdb, 'rec2', { accion: 'crear', datos: datos({ reclutador_id: 'rec1' }) })).status, 403)
})
test('crear guarda nombre normalizado, version 1, fecha_inicio y auditoría', async () => {
  const tdb = crearFake({ perfiles: perfiles() })
  const r = await llamar(tdb, 'rec1', {
    accion: 'crear',
    datos: datos({ etapas: { ...etapasVacias(), revision_medica_interna: { fecha: '2026-10-12', res: 'FECHA' } } }),
  })
  assert.equal(r.status, 200)
  const fila = await tdb.getRow({ tableId: 'operadores', rowId: r.body.doc.id })
  assert.equal(fila.nombre_norm, 'PEDRO PRUEBA ALVAREZ')
  assert.equal(fila.reclutador_nombre, 'CARMEN')
  assert.equal(fila.version, 1)
  assert.match(fila.fecha_inicio, /^2026-10-12/)
  const aud = (await tdb.listRows({ tableId: 'auditoria' })).rows
  assert.equal(aud.length, 1)
  assert.equal(aud[0].accion, 'crear')
  assert.equal(aud[0].usuario_id, 'rec1')
  assert.equal(aud[0].antes, null)
})
test('nombre duplicado con otros acentos/espacios → 400 en nombre', async () => {
  const tdb = crearFake({ perfiles: perfiles() })
  await nuevo(tdb)
  const r = await llamar(tdb, 'rec1', { accion: 'crear', datos: datos({ nombre: ' PEDRO  PRUEBA ALVAREZ ' }) })
  assert.equal(r.status, 400)
  assert.ok(r.body.errores.some((e) => e.campo === 'nombre'))
})
test('datos inválidos → 400 con errores y sin escribir', async () => {
  const tdb = crearFake({ perfiles: perfiles() })
  const r = await llamar(tdb, 'rec1', { accion: 'crear', datos: datos({ estatus: 'CONTRATADO' }) })
  assert.equal(r.status, 400)
  assert.equal((await tdb.listRows({ tableId: 'operadores' })).total, 0)
})
test('reclutador no dueño no puede actualizar → 403', async () => {
  const tdb = crearFake({ perfiles: perfiles() })
  const doc = await nuevo(tdb)
  const r = await llamar(tdb, 'rec2', { accion: 'actualizar', id: doc.id, version: doc.version, datos: datos({ observaciones: 'x' }) })
  assert.equal(r.status, 403)
})
test('versión vieja → 409 sin escribir', async () => {
  const tdb = crearFake({ perfiles: perfiles() })
  const doc = await nuevo(tdb)
  await llamar(tdb, 'rec1', { accion: 'actualizar', id: doc.id, version: 1, datos: datos({ observaciones: 'a' }) })
  const r = await llamar(tdb, 'ger1', { accion: 'actualizar', id: doc.id, version: 1, datos: datos({ observaciones: 'b' }) })
  assert.equal(r.status, 409)
  assert.equal((await tdb.getRow({ tableId: 'operadores', rowId: doc.id })).observaciones, 'a')
})
test('actualizar incrementa versión y audita antes/después', async () => {
  const tdb = crearFake({ perfiles: perfiles() })
  const doc = await nuevo(tdb)
  const r = await llamar(tdb, 'rec1', { accion: 'actualizar', id: doc.id, version: 1, datos: datos({ observaciones: 'nota' }) })
  assert.equal(r.status, 200)
  assert.equal(r.body.doc.version, 2)
  const aud = (await tdb.listRows({ tableId: 'auditoria' })).rows.find((a) => a.accion === 'actualizar')
  assert.match(aud.antes, /"observaciones":""/)
  assert.match(aud.despues, /"observaciones":"nota"/)
})
test('reclutador no puede reasignar el operador → 403', async () => {
  const tdb = crearFake({ perfiles: perfiles() })
  const doc = await nuevo(tdb)
  const r = await llamar(tdb, 'rec1', { accion: 'actualizar', id: doc.id, version: 1, datos: datos({ reclutador_id: 'rec2' }) })
  assert.equal(r.status, 403)
})
test('gerente sí puede reasignar', async () => {
  const tdb = crearFake({ perfiles: perfiles() })
  const doc = await nuevo(tdb)
  const r = await llamar(tdb, 'ger1', { accion: 'actualizar', id: doc.id, version: 1, datos: datos({ reclutador_id: 'rec2' }) })
  assert.equal(r.status, 200)
  assert.equal((await tdb.getRow({ tableId: 'operadores', rowId: doc.id })).reclutador_nombre, 'ALEX')
})
test('actualizar no permite pasar a DESCARTADO ni CONTRATADO (usar acciones propias)', async () => {
  const tdb = crearFake({ perfiles: perfiles() })
  const doc = await nuevo(tdb)
  const r = await llamar(tdb, 'rec1', { accion: 'actualizar', id: doc.id, version: 1, datos: datos({ estatus: 'DESCARTADO', motivo_descarte: 'x' }) })
  assert.equal(r.status, 400)
})
test('descartar exige motivo', async () => {
  const tdb = crearFake({ perfiles: perfiles() })
  const doc = await nuevo(tdb)
  const r = await llamar(tdb, 'rec1', { accion: 'descartar', id: doc.id, version: 1, datos: { motivo_descarte: ' ' } })
  assert.equal(r.status, 400)
  const ok = await llamar(tdb, 'rec1', { accion: 'descartar', id: doc.id, version: 1, datos: { motivo_descarte: 'NO APROBÓ EL ESE' } })
  assert.equal(ok.status, 200)
  assert.equal((await tdb.getRow({ tableId: 'operadores', rowId: doc.id })).estatus, 'DESCARTADO')
})
test('contratar exige dictamen OK', async () => {
  const tdb = crearFake({ perfiles: perfiles() })
  const doc = await nuevo(tdb)
  assert.equal((await llamar(tdb, 'rec1', { accion: 'contratar', id: doc.id, version: 1 })).status, 400)
  const conDictamen = datos({ etapas: { ...etapasVacias(), dictamen_cryo: { fecha: '2026-10-29', res: 'OK' } } })
  await llamar(tdb, 'rec1', { accion: 'actualizar', id: doc.id, version: 1, datos: conDictamen })
  const ok = await llamar(tdb, 'rec1', { accion: 'contratar', id: doc.id, version: 2 })
  assert.equal(ok.status, 200)
})
test('solo admin/gerente restauran un descartado', async () => {
  const tdb = crearFake({ perfiles: perfiles() })
  const doc = await nuevo(tdb)
  await llamar(tdb, 'rec1', { accion: 'descartar', id: doc.id, version: 1, datos: { motivo_descarte: 'x' } })
  const d = datos({ estatus: 'PREMEDICO_CRYO' })
  assert.equal((await llamar(tdb, 'rec1', { accion: 'actualizar', id: doc.id, version: 2, datos: d })).status, 403)
  assert.equal((await llamar(tdb, 'ger1', { accion: 'actualizar', id: doc.id, version: 2, datos: d })).status, 200)
})
test('acción desconocida → 400', async () => {
  const tdb = crearFake({ perfiles: perfiles() })
  assert.equal((await llamar(tdb, 'admin1', { accion: 'borrar' })).status, 400)
})
