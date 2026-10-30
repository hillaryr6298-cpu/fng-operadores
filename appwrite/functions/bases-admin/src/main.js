import { normalizarNombre } from '../../../../shared/dominio.ts'
import { DB, autenticar, auditar, envolver, err, respuesta } from '../../_comun/comun.js'

const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 36)

export async function manejar({ tdb, ahora, uid, cuerpo }) {
  const { yo, fallo } = await autenticar(tdb, uid)
  if (fallo) return fallo
  if (yo.rol !== 'admin') return err(403, 'Solo el administrador gestiona bases.')
  const { accion, nombre, id } = cuerpo ?? {}
  const aud = (rid, a, antes, despues) => auditar(tdb, yo, { entidad: 'bases', registro_id: rid, accion: a, antes, despues }, ahora)

  if (accion === 'crear') {
    const n = normalizarNombre(nombre ?? '')
    if (!n || n.length > 60) return err(400, 'El nombre es obligatorio (máx. 60 caracteres).')
    const rowId = slug(n)
    if (!rowId) return err(400, 'Nombre no válido.')
    try {
      await tdb.createRow({ databaseId: DB, tableId: 'bases', rowId, data: { nombre: n, activa: true } })
    } catch (e) {
      if (e.code === 409) return err(409, 'Ya existe una base con ese nombre.')
      throw e
    }
    await aud(rowId, 'crear', null, { nombre: n, activa: true })
    return respuesta(200, { ok: true, id: rowId })
  }
  if (accion === 'activar' || accion === 'desactivar') {
    let b
    try { b = await tdb.getRow({ databaseId: DB, tableId: 'bases', rowId: id ?? '' }) } catch { return err(404, 'Base no encontrada.') }
    const activa = accion === 'activar'
    await tdb.updateRow({ databaseId: DB, tableId: 'bases', rowId: id, data: { activa } })
    await aud(id, accion, { nombre: b.nombre, activa: b.activa }, { nombre: b.nombre, activa })
    return respuesta(200, { ok: true })
  }
  return err(400, 'Acción no válida.')
}

export default envolver(manejar)
