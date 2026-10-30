// Pruebas de seguridad contra Appwrite REAL: un usuario temporal por rol, matriz de permisos del spec §5.
// Uso: APPWRITE_API_KEY=... node appwrite/test-permisos.mjs   (crea y borra sus propios datos de prueba)
import { Account, Client, ID, Query, TablesDB, Functions } from 'node-appwrite'
import { randomBytes } from 'node:crypto'
import { cliente, DB, ENDPOINT, PROJECT } from './cliente.mjs'
import { ETAPAS, etiquetaDeRol } from '../shared/dominio.ts'

const { tdb: admin, users } = cliente()
const sufijo = randomBytes(3).toString('hex')
const creados = { users: [], operadores: [], bases: [] }
let pasadas = 0, falladas = 0

const ok = (cond, nombre, detalle = '') => {
  if (cond) { pasadas++; console.log('  ✔', nombre) } else { falladas++; console.log('  ✘', nombre, detalle) }
}
const vacias = () => Object.fromEntries(ETAPAS.map((e) => [e.clave, { fecha: null, res: null }]))
const datos = (rec, nombre, o = {}) => ({
  nombre, base: 'SLP', reclutador_id: rec, modalidad: 'FULL', estatus: 'PREMEDICO_INTERNO',
  etapas: { ...vacias(), quimica_sanguinea: { fecha: '2026-10-15', res: 'FECHA' } }, ...o,
})

async function crearUsuario(rol, tag = '') {
  const email = `t-${rol.replace('_', '')}${tag}-${sufijo}@fng-test.invalid`
  const password = `Prueba-${randomBytes(8).toString('hex')}`
  const u = await users.create({ userId: ID.unique(), email, password, name: `Prueba ${rol}` })
  creados.users.push(u.$id)
  await users.updateLabels({ userId: u.$id, labels: [etiquetaDeRol(rol)] })
  await admin.createRow({ databaseId: DB, tableId: 'perfiles', rowId: u.$id, data: { nombre: `PRUEBA ${rol.toUpperCase()}`, rol, activo: true, email, debe_cambiar: false } })
  return { id: u.$id, email, password, rol }
}

async function sesion(u) {
  const anon = new Client().setEndpoint(ENDPOINT).setProject(PROJECT)
  const s = await new Account(anon).createEmailPasswordSession({ email: u.email, password: u.password })
  // Appwrite oculta el secreto de la sesión en clientes de servidor: se actúa como el usuario con un JWT.
  const { jwt } = await users.createJWT({ userId: u.id, sessionId: s.$id, duration: 900 })
  const c = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setJWT(jwt)
  const yo = await new Account(c).get()
  if (yo.$id !== u.id) throw new Error('El cliente de prueba no quedó autenticado')
  return { tdb: new TablesDB(c), fn: new Functions(c), sessionId: s.$id, client: c }
}

async function api(s, cuerpo, cabeceras = {}) {
  const e = await s.fn.createExecution({ functionId: 'api', body: JSON.stringify(cuerpo), async: false, xpath: '/', method: 'POST', headers: { 'content-type': 'application/json', ...cabeceras } })
  let body = {}
  try { body = JSON.parse(e.responseBody) } catch { /* vacío */ }
  return { status: e.responseStatusCode, body }
}
const rechaza = async (fn) => { try { await fn(); return false } catch (e) { return e.code === 401 || e.code === 403 } }

try {
  const U = {}
  for (const rol of ['admin', 'gerente_rh', 'reclutador', 'consulta']) U[rol] = await crearUsuario(rol)
  U.rec2 = await crearUsuario('reclutador', '2')
  const S = {}
  for (const [k, u] of Object.entries(U)) S[k] = await sesion(u)
  console.log('Usuarios y sesiones de prueba listos')

  console.log('\n[Lectura]')
  for (const k of ['admin', 'gerente_rh', 'reclutador', 'consulta']) {
    for (const t of ['operadores', 'perfiles', 'bases']) {
      let bien = true; try { await S[k].tdb.listRows({ databaseId: DB, tableId: t, queries: [Query.limit(1)] }) } catch { bien = false }
      ok(bien, `${k} lee ${t}`)
    }
    let puede = true; try { await S[k].tdb.listRows({ databaseId: DB, tableId: 'auditoria', queries: [Query.limit(1)] }) } catch { puede = false }
    ok(puede === (k === 'admin' || k === 'gerente_rh'), `${k} ${k === 'admin' || k === 'gerente_rh' ? 'lee' : 'NO lee'} auditoria`)
  }

  console.log('\n[Escritura directa a tablas desde el cliente = prohibida para todos]')
  for (const k of ['admin', 'gerente_rh', 'reclutador', 'consulta']) {
    for (const t of ['operadores', 'perfiles', 'bases', 'auditoria']) {
      ok(await rechaza(() => S[k].tdb.createRow({ databaseId: DB, tableId: t, rowId: ID.unique(), data: { nombre: 'X' } })), `${k} no puede crear en ${t}`)
    }
  }
  ok(await rechaza(() => S.admin.tdb.updateRow({ databaseId: DB, tableId: 'perfiles', rowId: U.consulta.id, data: { rol: 'admin' } })), 'admin no puede cambiar roles por la tabla (solo por función)')
  ok(await rechaza(() => S.reclutador.tdb.updateRow({ databaseId: DB, tableId: 'perfiles', rowId: U.reclutador.id, data: { rol: 'admin' } })), 'reclutador no puede autopromoverse')

  console.log('\n[Function api — operadores]')
  let r = await api(S.consulta, { modulo: 'operadores', accion: 'crear', datos: datos(U.reclutador.id, `PRUEBA ${sufijo} CONSULTA`) })
  ok(r.status === 403, 'consulta no puede crear (403)', JSON.stringify(r))
  r = await api(S.reclutador, { modulo: 'operadores', accion: 'crear', datos: datos(U.rec2.id, `PRUEBA ${sufijo} AJENO`) })
  ok(r.status === 403, 'reclutador no puede crear para otro (403)', JSON.stringify(r))
  r = await api(S.reclutador, { modulo: 'operadores', accion: 'crear', datos: datos(U.reclutador.id, `Prueba ${sufijo} Uno`) })
  ok(r.status === 200 && r.body.doc?.version === 1, 'reclutador crea operador propio (200, versión 1)', JSON.stringify(r))
  const doc = r.body.doc; if (doc) creados.operadores.push(doc.id)
  r = await api(S.gerente_rh, { modulo: 'operadores', accion: 'crear', datos: datos(U.reclutador.id, ` PRUEBA  ${sufijo}  UNO `) })
  ok(r.status === 400 && r.body.errores?.some((e) => e.campo === 'nombre'), 'nombre duplicado con otro formato → 400')
  r = await api(S.rec2, { modulo: 'operadores', accion: 'actualizar', id: doc.id, version: 1, datos: datos(U.reclutador.id, `Prueba ${sufijo} Uno`, { observaciones: 'x' }) })
  ok(r.status === 403, 'otro reclutador no edita lo ajeno (403)', JSON.stringify(r))
  r = await api(S.reclutador, { modulo: 'operadores', accion: 'actualizar', id: doc.id, version: 1, datos: datos(U.reclutador.id, `Prueba ${sufijo} Uno`, { observaciones: 'a' }) })
  ok(r.status === 200 && r.body.doc?.version === 2, 'dueño actualiza (versión 2)', JSON.stringify(r))
  r = await api(S.gerente_rh, { modulo: 'operadores', accion: 'actualizar', id: doc.id, version: 1, datos: datos(U.reclutador.id, `Prueba ${sufijo} Uno`, { observaciones: 'b' }) })
  ok(r.status === 409, 'versión vieja → 409 (conflicto)', JSON.stringify(r))
  r = await api(S.reclutador, { modulo: 'operadores', accion: 'actualizar', id: doc.id, version: 2, datos: datos(U.rec2.id, `Prueba ${sufijo} Uno`) })
  ok(r.status === 403, 'reclutador no reasigna (403)')
  r = await api(S.gerente_rh, { modulo: 'operadores', accion: 'actualizar', id: doc.id, version: 2, datos: datos(U.rec2.id, `Prueba ${sufijo} Uno`) })
  ok(r.status === 200, 'gerente sí reasigna (200)', JSON.stringify(r))
  r = await api(S.admin, { modulo: 'operadores', accion: 'contratar', id: doc.id, version: 3 })
  ok(r.status === 400, 'contratar sin dictamen OK → 400')
  r = await api(S.admin, { modulo: 'operadores', accion: 'actualizar', id: doc.id, version: 3, datos: datos(U.rec2.id, `Prueba ${sufijo} Uno`, { observaciones: 'v4' }) })
  ok(r.status === 200 && r.body.doc?.version === 4, 'admin actualiza (versión 4)', JSON.stringify(r))

  console.log('\n[Suplantación y carreras]')
  // Un usuario "consulta" intenta hacerse pasar por el admin enviando la cabecera de identidad.
  let suplantado = null
  try {
    suplantado = await api(S.consulta, { modulo: 'operadores', accion: 'crear', datos: datos(U.reclutador.id, `Prueba ${sufijo} Suplanta`) }, { 'x-appwrite-user-id': U.admin.id })
  } catch (e) { suplantado = { status: e.code } }
  ok(suplantado.status === 400 || suplantado.status === 403, `Appwrite rechaza cabeceras x-appwrite-* enviadas por el cliente o la API las deniega (${suplantado.status})`)
  const ver = 4
  const [c1, c2] = await Promise.all([
    api(S.admin, { modulo: 'operadores', accion: 'actualizar', id: doc.id, version: ver, datos: datos(U.rec2.id, `Prueba ${sufijo} Uno`, { observaciones: 'A' }) }),
    api(S.gerente_rh, { modulo: 'operadores', accion: 'actualizar', id: doc.id, version: ver, datos: datos(U.rec2.id, `Prueba ${sufijo} Uno`, { observaciones: 'B' }) }),
  ])
  ok([c1.status, c2.status].sort().join() === '200,409', `dos ediciones simultáneas con la misma versión: una gana, otra 409 (${c1.status},${c2.status})`)
  const [d1, d2] = await Promise.all([
    api(S.admin, { modulo: 'operadores', accion: 'crear', datos: datos(U.rec2.id, `Prueba ${sufijo} Gemelo`) }),
    api(S.gerente_rh, { modulo: 'operadores', accion: 'crear', datos: datos(U.rec2.id, `PRUEBA ${sufijo} GEMELO`) }),
  ])
  for (const x of [d1, d2]) if (x.body.doc) creados.operadores.push(x.body.doc.id)
  ok([d1.status, d2.status].sort().join() === '200,400', `dos altas simultáneas del mismo nombre: solo una (${d1.status},${d2.status})`)

  console.log('\n[Auditoría]')
  const aud = await S.gerente_rh.tdb.listRows({ databaseId: DB, tableId: 'auditoria', queries: [Query.equal('registro_id', [doc.id]), Query.limit(20)] })
  ok(aud.total >= 3, `la auditoría registró los cambios (${aud.total} filas)`)
  ok(aud.rows.every((a) => a.usuario_id && a.ts), 'cada fila indica quién y cuándo')

  console.log('\n[Function api — módulos de administración]')
  for (const k of ['gerente_rh', 'reclutador', 'consulta']) {
    r = await api(S[k], { modulo: 'usuarios', accion: 'crear', email: `x-${sufijo}@fng-test.invalid`, nombre: 'X', rol: 'consulta', passwordTemporal: 'Temporal-Larga-123' })
    ok(r.status === 403, `${k} no administra usuarios (403)`)
    r = await api(S[k], { modulo: 'bases', accion: 'crear', nombre: 'NO DEBE EXISTIR' })
    ok(r.status === 403, `${k} no administra bases (403)`)
  }
  r = await api(S.reclutador, { modulo: 'importar', filas: [], confirmar: false })
  ok(r.status === 403, 'reclutador no importa (403)')
  r = await api(S.admin, { modulo: 'usuarios', accion: 'crear', email: `n-${sufijo}@fng-test.invalid`, nombre: 'Nuevo', rol: 'reclutador', passwordTemporal: 'corta' })
  ok(r.status === 400, 'contraseña temporal débil → 400')
  r = await api(S.admin, { modulo: 'usuarios', accion: 'crear', email: `n-${sufijo}@fng-test.invalid`, nombre: 'Nuevo', rol: 'gerente_rh', passwordTemporal: 'Temporal-Larga-123' })
  ok(r.status === 200 && r.body.id, 'admin crea usuario', JSON.stringify(r))
  const nuevoId = r.body.id; if (nuevoId) creados.users.push(nuevoId)
  const lab = (await users.get({ userId: nuevoId })).labels
  ok(lab.length === 1 && lab[0] === 'gerenterh', `etiqueta asignada por el servidor (${lab})`)
  const nuevo = { id: nuevoId, email: `n-${sufijo}@fng-test.invalid`, password: 'Temporal-Larga-123' }
  let sn = await sesion(nuevo)
  r = await api(sn, { modulo: 'operadores', accion: 'crear', datos: datos(U.reclutador.id, `Prueba ${sufijo} Pendiente`) })
  ok(r.status === 403 && /contraseña/i.test(r.body.mensaje ?? ''), 'con cambio de contraseña pendiente el servidor bloquea el resto de acciones (403)', JSON.stringify(r))
  r = await api(sn, { modulo: 'password', actual: 'Temporal-Larga-123', nueva: 'corta' })
  ok(r.status === 400, 'cambio de contraseña débil → 400')
  r = await api(sn, { modulo: 'password', actual: 'equivocada-xxxxx', nueva: 'Otra-Contraseña-456' })
  ok(r.status === 403, 'contraseña actual incorrecta → 403')
  r = await api(sn, { modulo: 'password', actual: 'Temporal-Larga-123', nueva: 'Otra-Contraseña-456' })
  ok(r.status === 200, 'cambio de contraseña correcto (200)', JSON.stringify(r))
  ok(await rechaza(() => sn.tdb.listRows({ databaseId: DB, tableId: 'bases' })), 'la sesión anterior queda cerrada tras cambiar contraseña')
  sn = await sesion({ ...nuevo, password: 'Otra-Contraseña-456' })
  ok(!!sn.sessionId, 'inicia sesión con la nueva contraseña')

  console.log('\n[Usuario desactivado]')
  r = await api(S.admin, { modulo: 'usuarios', accion: 'desactivar', id: nuevoId })
  ok(r.status === 200, 'admin desactiva usuario')
  ok(await rechaza(() => sn.tdb.listRows({ databaseId: DB, tableId: 'bases' })), 'su sesión activa deja de funcionar')
  ok(await rechaza(() => sesion({ ...nuevo, password: 'Otra-Contraseña-456' })), 'no puede iniciar sesión de nuevo')
  r = await api(S.admin, { modulo: 'usuarios', accion: 'desactivar', id: U.admin.id })
  ok(r.status === 400, 'un admin no puede desactivarse a sí mismo')

  console.log('\n[Sin sesión]')
  const anonFn = new Functions(new Client().setEndpoint(ENDPOINT).setProject(PROJECT))
  let bloqueado = false
  try {
    const e = await anonFn.createExecution({ functionId: 'api', body: '{}', async: false, xpath: '/', method: 'POST', headers: { 'content-type': 'application/json' } })
    bloqueado = e.responseStatusCode >= 400
  } catch (e) { bloqueado = e.code === 401 || e.code === 403 }
  ok(bloqueado, 'invitado (sin sesión) no puede ejecutar la API')
  ok(await rechaza(() => new TablesDB(new Client().setEndpoint(ENDPOINT).setProject(PROJECT)).listRows({ databaseId: DB, tableId: 'operadores' })), 'invitado no lee operadores')
} catch (e) {
  falladas++
  console.log('✘ Error inesperado:', e.message, e.response ?? '')
} finally {
  console.log('\n[Limpieza]')
  for (const id of creados.operadores) await admin.deleteRow({ databaseId: DB, tableId: 'operadores', rowId: id }).catch(() => {})
  for (const id of creados.users) {
    await admin.deleteRow({ databaseId: DB, tableId: 'perfiles', rowId: id }).catch(() => {})
    const { rows } = await admin.listRows({ databaseId: DB, tableId: 'auditoria', queries: [Query.equal('usuario_id', [id]), Query.limit(100)] }).catch(() => ({ rows: [] }))
    for (const a of rows) await admin.deleteRow({ databaseId: DB, tableId: 'auditoria', rowId: a.$id }).catch(() => {})
    await users.delete({ userId: id }).catch(() => {})
  }
  const resto = await admin.listRows({ databaseId: DB, tableId: 'perfiles', queries: [Query.contains('email', [`-${sufijo}@fng-test.invalid`]), Query.limit(50)] }).catch(() => ({ rows: [] }))
  console.log(`  usuarios de prueba restantes: ${resto.rows.length}`)
  console.log(`\nResultado: ${pasadas} pasaron, ${falladas} fallaron`)
  process.exit(falladas ? 1 : 0)
}
