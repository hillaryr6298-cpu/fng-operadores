import { Client, TablesDB, Users, Account, ID, Query } from 'node-appwrite'
import { puedeEditar } from '../../../shared/dominio.ts'

export const DB = 'fng'
export { ID, Query }

/** Cliente de servidor con la API key dinámica que Appwrite inyecta en cada ejecución. */
export function clientes(req) {
  const c = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'])
  return { tdb: new TablesDB(c), users: new Users(c) }
}

/** Comprueba correo+contraseña abriendo una sesión efímera con un cliente sin credenciales. */
export async function verificarPasswordReal(users, email, password) {
  const anon = new Client().setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT).setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
  try {
    const s = await new Account(anon).createEmailPasswordSession({ email, password })
    await users.deleteSession({ userId: s.userId, sessionId: s.$id })
    return true
  } catch {
    return false
  }
}

export const respuesta = (status, body) => ({ status, body })
export const err = (status, mensaje, errores) =>
  respuesta(status, { ok: false, status, mensaje, errores: errores ?? [{ campo: '', mensaje }] })

/** Identifica al llamador: el perfil (no las etiquetas del JWT) es la fuente de verdad. */
export async function autenticar(tdb, uid) {
  if (!uid) return { fallo: err(401, 'Sesión requerida.') }
  let p
  try {
    p = await tdb.getRow({ databaseId: DB, tableId: 'perfiles', rowId: uid })
  } catch {
    return { fallo: err(403, 'Perfil no encontrado.') }
  }
  if (!p.activo) return { fallo: err(403, 'Usuario desactivado.') }
  return { yo: { uid, nombre: p.nombre, rol: p.rol } }
}

export async function auditar(tdb, yo, { entidad, registro_id, accion, antes, despues }, ahora) {
  await tdb.createRow({
    databaseId: DB, tableId: 'auditoria', rowId: ID.unique(),
    data: {
      ts: ahora.toISOString(), usuario_id: yo.uid, usuario_nombre: yo.nombre, entidad, registro_id, accion,
      antes: antes == null ? null : JSON.stringify(antes).slice(0, 15000),
      despues: despues == null ? null : JSON.stringify(despues).slice(0, 15000),
    },
  })
}

export const esAdminOGerente = (rol) => rol === 'admin' || rol === 'gerente_rh'
export { puedeEditar }

/** Adaptador de entrada de Appwrite: construye clientes y delega en `manejar`. */
export function envolver(manejar) {
  return async ({ req, res, error }) => {
    try {
      const { tdb, users } = clientes(req)
      const r = await manejar({
        tdb, users, ahora: new Date(), uid: req.headers['x-appwrite-user-id'],
        verificarPassword: (email, pass) => verificarPasswordReal(users, email, pass),
        cuerpo: req.bodyJson ?? {},
      })
      return res.json(r.body, r.status)
    } catch (e) {
      error(String(e?.stack ?? e))
      return res.json({ ok: false, status: 500, mensaje: 'Error interno.', errores: [] }, 500)
    }
  }
}
