import { ROLES, etiquetaDeRol, validarPassword } from '../../../../shared/dominio.ts'
import { DB, ID, autenticar, auditar, envolver, err, respuesta } from '../../_comun/comun.js'

const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const ok = (extra = {}) => respuesta(200, { ok: true, ...extra })

async function cargarPerfil(tdb, id) {
  try {
    return await tdb.getRow({ databaseId: DB, tableId: 'perfiles', rowId: id })
  } catch {
    return null
  }
}
const publico = (p) => ({ nombre: p.nombre, rol: p.rol, activo: p.activo, email: p.email })

export async function manejar({ tdb, users, ahora, uid, cuerpo }) {
  const { yo, fallo } = await autenticar(tdb, uid)
  if (fallo) return fallo
  if (yo.rol !== 'admin') return err(403, 'Solo el administrador puede gestionar usuarios.')
  const { accion, id, email, nombre, rol, passwordTemporal } = cuerpo ?? {}
  const aud = (registro_id, a, antes, despues) => auditar(tdb, yo, { entidad: 'perfiles', registro_id, accion: a, antes, despues }, ahora)

  if (accion === 'crear') {
    const e = []
    if (!reEmail.test(email ?? '')) e.push({ campo: 'email', mensaje: 'Correo no válido.' })
    if (!nombre?.trim() || nombre.length > 100) e.push({ campo: 'nombre', mensaje: 'Nombre obligatorio (máx. 100).' })
    if (!ROLES.includes(rol)) e.push({ campo: 'rol', mensaje: 'Rol no válido.' })
    const pe = validarPassword(passwordTemporal)
    if (pe) e.push({ campo: 'passwordTemporal', mensaje: pe })
    if (e.length) return err(400, 'Datos no válidos.', e)
    let u
    try {
      u = await users.create({ userId: ID.unique(), email: email.trim().toLowerCase(), password: passwordTemporal, name: nombre.trim() })
    } catch (x) {
      if (x.code === 409) return err(409, 'Ya existe un usuario con ese correo.')
      throw x
    }
    try {
      await users.updateLabels({ userId: u.$id, labels: [etiquetaDeRol(rol)] })
      const data = { nombre: nombre.trim(), rol, activo: true, email: email.trim().toLowerCase(), debe_cambiar: true }
      await tdb.createRow({ databaseId: DB, tableId: 'perfiles', rowId: u.$id, data })
      await aud(u.$id, 'crear', null, data)
    } catch (x) {
      await users.delete({ userId: u.$id }).catch(() => {})
      throw x
    }
    return ok({ id: u.$id })
  }

  const p = id ? await cargarPerfil(tdb, id) : null
  if (!p) return err(404, 'Usuario no encontrado.')
  const propio = id === yo.uid

  switch (accion) {
    case 'cambiar_rol': {
      if (propio) return err(400, 'No puede cambiar su propio rol.')
      if (!ROLES.includes(rol)) return err(400, 'Rol no válido.')
      await users.updateLabels({ userId: id, labels: [etiquetaDeRol(rol)] })
      await tdb.updateRow({ databaseId: DB, tableId: 'perfiles', rowId: id, data: { rol } })
      await aud(id, 'cambiar_rol', publico(p), publico({ ...p, rol }))
      return ok()
    }
    case 'desactivar': {
      if (propio) return err(400, 'No puede desactivarse a sí mismo.')
      await users.updateStatus({ userId: id, status: false })
      await users.deleteSessions({ userId: id })
      await tdb.updateRow({ databaseId: DB, tableId: 'perfiles', rowId: id, data: { activo: false } })
      await aud(id, 'desactivar', publico(p), publico({ ...p, activo: false }))
      return ok()
    }
    case 'activar': {
      await users.updateStatus({ userId: id, status: true })
      await tdb.updateRow({ databaseId: DB, tableId: 'perfiles', rowId: id, data: { activo: true } })
      await aud(id, 'activar', publico(p), publico({ ...p, activo: true }))
      return ok()
    }
    case 'reset': {
      const pe = validarPassword(passwordTemporal)
      if (pe) return err(400, pe, [{ campo: 'passwordTemporal', mensaje: pe }])
      await users.updatePassword({ userId: id, password: passwordTemporal })
      await users.deleteSessions({ userId: id })
      await tdb.updateRow({ databaseId: DB, tableId: 'perfiles', rowId: id, data: { debe_cambiar: true } })
      await aud(id, 'reset_password', null, null)
      return ok()
    }
    default:
      return err(400, 'Acción no válida.')
  }
}

export default envolver(manejar)
