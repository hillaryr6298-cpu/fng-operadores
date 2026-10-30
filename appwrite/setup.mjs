// Crea (de forma idempotente) la base de datos, colecciones, atributos, índices, permisos y bases semilla.
// Uso: APPWRITE_API_KEY=... node appwrite/setup.mjs [--admin-email x --admin-pass y --admin-nombre z]
import { Permission, Role, ID, Query } from 'node-appwrite'
import { cliente, DB } from './cliente.mjs'
import { ETAPAS, ESTATUS, MODALIDADES, RESULTADOS, ROLES, etiquetaDeRol } from '../shared/dominio.ts'

const { tdb, users } = cliente()
const LECTORES = ROLES.map(etiquetaDeRol)
const leer = (labels) => labels.map((l) => Permission.read(Role.label(l)))

const str = (key, size, required = false) => ({ key, type: 'varchar', size, required })
const attrsOperadores = [
  str('nombre', 160, true), str('nombre_norm', 160, true), str('base', 60, true),
  str('reclutador_id', 36, true), str('reclutador_nombre', 100, true),
  { key: 'modalidad', type: 'enum', elements: [...MODALIDADES], required: true },
  { key: 'estatus', type: 'enum', elements: [...ESTATUS], required: true },
  { key: 'observaciones', type: 'text', required: false },
  str('motivo_descarte', 500),
  { key: 'version', type: 'integer', required: true, min: 0, max: 1000000 },
  { key: 'fecha_inicio', type: 'datetime', required: false },
  ...ETAPAS.flatMap((e) => [
    { key: `${e.clave}_fecha`, type: 'datetime', required: false },
    { key: `${e.clave}_res`, type: 'enum', elements: [...RESULTADOS], required: false },
  ]),
]

const colecciones = [
  {
    id: 'perfiles', nombre: 'Perfiles', permisos: leer(LECTORES),
    attrs: [str('nombre', 100, true), { key: 'rol', type: 'enum', elements: ['admin', 'gerente_rh', 'reclutador', 'consulta'], required: true },
      { key: 'activo', type: 'boolean', required: true }, str('email', 255, true),
      { key: 'debe_cambiar', type: 'boolean', required: false, default: false }],
    indices: [],
  },
  {
    id: 'bases', nombre: 'Bases', permisos: leer(LECTORES),
    attrs: [str('nombre', 60, true), { key: 'activa', type: 'boolean', required: true }],
    indices: [{ key: 'u_nombre', type: 'unique', attributes: ['nombre'] }],
  },
  {
    id: 'operadores', nombre: 'Operadores', permisos: leer(LECTORES), attrs: attrsOperadores,
    indices: [
      { key: 'u_nombre_norm', type: 'unique', attributes: ['nombre_norm'] },
      { key: 'i_estatus', type: 'key', attributes: ['estatus'] },
      { key: 'i_base', type: 'key', attributes: ['base'] },
      { key: 'i_reclutador', type: 'key', attributes: ['reclutador_id'] },
      { key: 'i_inicio', type: 'key', attributes: ['fecha_inicio'] },
    ],
  },
  {
    id: 'auditoria', nombre: 'Auditoría', permisos: leer(['admin', 'gerenterh']),
    attrs: [
      { key: 'ts', type: 'datetime', required: true }, str('usuario_id', 36, true), str('usuario_nombre', 100, true),
      str('entidad', 40, true), str('registro_id', 36, true), str('accion', 40, true),
      { key: 'antes', type: 'text', required: false }, { key: 'despues', type: 'text', required: false },
    ],
    indices: [
      { key: 'i_ts', type: 'key', attributes: ['ts'], orders: ['DESC'] },
      { key: 'i_entidad', type: 'key', attributes: ['entidad'] },
      { key: 'i_registro', type: 'key', attributes: ['registro_id'] },
      { key: 'i_usuario', type: 'key', attributes: ['usuario_id'] },
    ],
  },
]

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
async function existe(fn) { try { await fn(); return true } catch (e) { if (e.code === 404) return false; throw e } }

async function asegurarBD() {
  if (!(await existe(() => tdb.get({ databaseId: DB })))) {
    await tdb.create({ databaseId: DB, name: 'FNG' })
    console.log('+ base de datos', DB)
  }
}

async function columnasFaltantes(c) {
  const { columns } = await tdb.listColumns({ databaseId: DB, tableId: c.id, queries: [Query.limit(100)] })
  const tiene = new Set(columns.map((x) => x.key))
  for (const a of c.attrs.filter((x) => !tiene.has(x.key))) {
    if (a.type !== 'boolean') throw new Error(`Columna faltante ${c.id}.${a.key}: tipo ${a.type} no soportado por setup`)
    await tdb.createBooleanColumn({ databaseId: DB, tableId: c.id, key: a.key, required: a.required, xdefault: a.default })
    console.log('  + columna', a.key)
  }
}

async function asegurarColeccion(c) {
  if (await existe(() => tdb.getTable({ databaseId: DB, tableId: c.id }))) {
    console.log('= colección', c.id)
    // Los permisos se reafirman siempre (fuente de verdad: este archivo).
    await tdb.updateTable({ databaseId: DB, tableId: c.id, name: c.nombre, permissions: c.permisos, rowSecurity: false, enabled: true })
    await columnasFaltantes(c)
    return
  }
  await tdb.createTable({ databaseId: DB, tableId: c.id, name: c.nombre, permissions: c.permisos, rowSecurity: false, columns: c.attrs, indexes: [] })
  console.log('+ colección', c.id)
  for (let i = 0; i < 90; i++) {
    const { columns: attributes } = await tdb.listColumns({ databaseId: DB, tableId: c.id, queries: [Query.limit(100)] })
    if (attributes.length >= c.attrs.length && attributes.every((a) => a.status === 'available')) break
    if (attributes.some((a) => a.status === 'failed')) throw new Error(`Atributo fallido en ${c.id}`)
    await dormir(1500)
  }
  for (const ix of c.indices) {
    await tdb.createIndex({ databaseId: DB, tableId: c.id, key: ix.key, type: ix.type, columns: ix.attributes, orders: ix.orders })
    console.log('  + índice', ix.key)
  }
}

async function semillaBases() {
  for (const nombre of ['SLP', 'TEX', 'ALTAMIRA', 'PUEBLA', 'TIJUANA', 'CUAUHTEMOC']) {
    const id = nombre.toLowerCase()
    if (!(await existe(() => tdb.getRow({ databaseId: DB, tableId: 'bases', rowId: id })))) {
      await tdb.createRow({ databaseId: DB, tableId: 'bases', rowId: id, data: { nombre, activa: true } })
      console.log('+ base', nombre)
    }
  }
}

async function adminInicial(email, pass, nombre) {
  if (pass.length < 12) throw new Error('La contraseña del admin debe tener al menos 12 caracteres')
  const lista = await users.list({ queries: [`equal("email", ["${email}"])`] })
  let u = lista.users[0]
  if (!u) u = await users.create({ userId: ID.unique(), email, password: pass, name: nombre })
  await users.updateLabels({ userId: u.$id, labels: [etiquetaDeRol('admin')] })
  if (!(await existe(() => tdb.getRow({ databaseId: DB, tableId: 'perfiles', rowId: u.$id })))) {
    await tdb.createRow({ databaseId: DB, tableId: 'perfiles', rowId: u.$id, data: { nombre, rol: 'admin', activo: true, email } })
  }
  console.log('+ admin', email)
}

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined }

await asegurarBD()
for (const c of colecciones) await asegurarColeccion(c)
await semillaBases()
if (arg('admin-email')) await adminInicial(arg('admin-email'), arg('admin-pass') ?? '', arg('admin-nombre') ?? 'Administrador')
console.log('Listo.')
