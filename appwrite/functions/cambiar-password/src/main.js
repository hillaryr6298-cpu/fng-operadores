import { validarPassword } from '../../../../shared/dominio.ts'
import { DB, autenticar, auditar, envolver, err, errorPolitica, respuesta } from '../../_comun/comun.js'

export async function manejar({ tdb, users, ahora, uid, cuerpo, verificarPassword }) {
  const { yo, fallo } = await autenticar(tdb, uid)
  if (fallo) return fallo
  const { actual, nueva } = cuerpo ?? {}
  if (typeof actual !== 'string' || typeof nueva !== 'string') return err(400, 'Faltan datos.')
  const pe = validarPassword(nueva)
  if (pe) return err(400, pe, [{ campo: 'nueva', mensaje: pe }])
  if (nueva === actual) return err(400, 'La nueva contraseña debe ser distinta.', [{ campo: 'nueva', mensaje: 'Debe ser distinta de la actual.' }])
  const perfil = await tdb.getRow({ databaseId: DB, tableId: 'perfiles', rowId: yo.uid })
  if (!(await verificarPassword(perfil.email, actual))) return err(403, 'La contraseña actual no es correcta.')
  try {
    await users.updatePassword({ userId: yo.uid, password: nueva })
  } catch (e) {
    const r = errorPolitica(e, 'nueva')
    if (r) return r
    throw e
  }
  await tdb.updateRow({ databaseId: DB, tableId: 'perfiles', rowId: yo.uid, data: { debe_cambiar: false } })
  await users.deleteSessions({ userId: yo.uid })
  await auditar(tdb, yo, { entidad: 'perfiles', registro_id: yo.uid, accion: 'cambiar_password', antes: null, despues: null }, ahora)
  return respuesta(200, { ok: true })
}

export default envolver(manejar)
