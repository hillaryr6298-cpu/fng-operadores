import { ESTATUS, normalizarNombre, validarOperador } from '../../../../shared/dominio.ts'
import { aFila, filaADominio, salida } from '../../_comun/operadores.js'
import { DB, ID, Query, autenticar, auditar, envolver, err, esAdminOGerente, puedeEditar, respuesta } from '../../_comun/comun.js'

const ACCIONES = ['crear', 'actualizar', 'descartar', 'contratar']
const conflicto = (fila) =>
  respuesta(409, { ok: false, status: 409, mensaje: 'El registro cambió.', errores: [{ campo: '', mensaje: 'El registro cambió.' }], actual: salida(fila) })
const nombreRepetido = () => err(400, 'Datos no válidos.', [{ campo: 'nombre', mensaje: 'Ya existe un operador con ese nombre.' }])

export async function manejar({ tdb, ahora, uid, cuerpo }) {
  const { yo, fallo } = await autenticar(tdb, uid)
  if (fallo) return fallo
  const { accion, id, version, datos } = cuerpo ?? {}
  if (!ACCIONES.includes(accion)) return err(400, 'Acción no válida.')
  if (yo.rol === 'consulta') return err(403, 'Sin permiso para modificar.')

  let previa = null
  if (accion !== 'crear') {
    if (!id) return err(400, 'Falta el id.')
    try {
      previa = await tdb.getRow({ databaseId: DB, tableId: 'operadores', rowId: id })
    } catch {
      return err(404, 'Operador no encontrado.')
    }
    if (!puedeEditar(yo.rol, yo.uid, previa.reclutador_id)) return err(403, 'No puede editar este operador.')
    if (previa.version !== version) return conflicto(previa)
  }

  // Construye el estado final del operador según la acción.
  let nuevo
  if (accion === 'crear' || accion === 'actualizar') {
    nuevo = datos
    if (!nuevo || typeof nuevo !== 'object') return err(400, 'Faltan los datos.')
    if (accion === 'actualizar') {
      if (nuevo.reclutador_id !== previa.reclutador_id && !esAdminOGerente(yo.rol)) return err(403, 'Solo RH gerencial reasigna reclutadores.')
      if (previa.estatus === 'DESCARTADO' && nuevo.estatus !== 'DESCARTADO' && !esAdminOGerente(yo.rol)) return err(403, 'Solo RH gerencial restaura descartados.')
      for (const cerrado of ['DESCARTADO', 'CONTRATADO'])
        if (nuevo.estatus === cerrado && previa.estatus !== cerrado) return err(400, `Use la acción "${cerrado === 'DESCARTADO' ? 'descartar' : 'contratar'}".`)
    }
  } else {
    nuevo = { ...filaADominio(previa) }
    if (accion === 'descartar') {
      nuevo.estatus = 'DESCARTADO'
      nuevo.motivo_descarte = datos?.motivo_descarte ?? ''
    } else nuevo.estatus = 'CONTRATADO'
  }

  const errores = validarOperador(nuevo, ahora)
  if (!ESTATUS.includes(nuevo.estatus)) errores.push({ campo: 'estatus', mensaje: 'Estatus no válido.' })

  // Reclutador asignado: debe existir y estar activo.
  let reclutador = null
  if (nuevo.reclutador_id) {
    try {
      reclutador = await tdb.getRow({ databaseId: DB, tableId: 'perfiles', rowId: nuevo.reclutador_id })
    } catch { /* se reporta abajo */ }
    if (!reclutador || !reclutador.activo || reclutador.rol !== 'reclutador')
      errores.push({ campo: 'reclutador_id', mensaje: 'El reclutador no existe o está inactivo.' })
    else if (accion === 'crear' && !puedeEditar(yo.rol, yo.uid, nuevo.reclutador_id)) return err(403, 'No puede crear operadores para otro reclutador.')
  }

  const norm = normalizarNombre(nuevo.nombre ?? '')
  if (norm && (accion === 'crear' || norm !== previa.nombre_norm)) {
    const { total } = await tdb.listRows({ databaseId: DB, tableId: 'operadores', queries: [Query.equal('nombre_norm', [norm]), Query.limit(1)] })
    if (total > 0) errores.push({ campo: 'nombre', mensaje: 'Ya existe un operador con ese nombre.' })
  }
  if (errores.length) return err(400, 'Datos no válidos.', errores)

  const nombreRec = reclutador.nombre
  if (accion === 'crear') {
    let fila
    try {
      fila = await tdb.createRow({ databaseId: DB, tableId: 'operadores', rowId: ID.unique(), data: aFila(nuevo, nombreRec, 1) })
    } catch (e) {
      if (e.code === 409) return nombreRepetido() // la restricción única cubre altas simultáneas
      throw e
    }
    await auditar(tdb, yo, { entidad: 'operadores', registro_id: fila.$id, accion: 'crear', antes: null, despues: filaADominio(fila) }, ahora)
    return respuesta(200, { ok: true, doc: salida(fila) })
  }

  // Compare-and-swap atómico: el incremento acotado solo prospera si nadie avanzó la versión desde que se leyó.
  try {
    await tdb.incrementRowColumn({ databaseId: DB, tableId: 'operadores', rowId: id, column: 'version', value: 1, max: previa.version + 1 })
  } catch (e) {
    if (e.code === 400 || e.code === 409) return conflicto(await tdb.getRow({ databaseId: DB, tableId: 'operadores', rowId: id }))
    throw e
  }
  const data = aFila(nuevo, nombreRec, previa.version + 1)
  delete data.version // ya incrementada de forma atómica
  let fila
  try {
    fila = await tdb.updateRow({ databaseId: DB, tableId: 'operadores', rowId: id, data })
  } catch (e) {
    if (e.code === 409) return nombreRepetido()
    throw e
  }
  await auditar(tdb, yo, { entidad: 'operadores', registro_id: id, accion, antes: filaADominio(previa), despues: filaADominio(fila) }, ahora)
  return respuesta(200, { ok: true, doc: salida(fila) })
}

export default envolver(manejar)
