import { normalizarNombre, validarOperador } from '../../../../shared/dominio.ts'
import { aFila } from '../../_comun/operadores.js'
import { DB, ID, Query, autenticar, auditar, envolver, err, esAdminOGerente, respuesta } from '../../_comun/comun.js'

const MAX_FILAS = 150
const PARALELO = 10

export async function manejar({ tdb, ahora, uid, cuerpo }) {
  const { yo, fallo } = await autenticar(tdb, uid)
  if (fallo) return fallo
  if (!esAdminOGerente(yo.rol)) return err(403, 'Solo RH gerencial puede importar.')
  const { filas, confirmar } = cuerpo ?? {}
  if (!Array.isArray(filas) || filas.length === 0) return err(400, 'No hay filas para importar.')
  if (filas.length > MAX_FILAS) return err(400, `Máximo ${MAX_FILAS} filas por importación.`)

  const bases = (await tdb.listRows({ databaseId: DB, tableId: 'bases', queries: [Query.limit(200)] })).rows
  const basesActivas = new Set(bases.filter((b) => b.activa).map((b) => normalizarNombre(b.nombre)))
  const reclutadores = new Map()
  for (const id of new Set(filas.map((f) => f?.reclutador_id).filter(Boolean))) {
    try { reclutadores.set(id, await tdb.getRow({ databaseId: DB, tableId: 'perfiles', rowId: id })) } catch { /* inexistente */ }
  }

  const normas = filas.map((f) => normalizarNombre(f?.nombre ?? ''))
  const existentes = new Set()
  const unicas = [...new Set(normas.filter(Boolean))]
  for (let i = 0; i < unicas.length; i += 100) {
    const { rows } = await tdb.listRows({ databaseId: DB, tableId: 'operadores', queries: [Query.equal('nombre_norm', unicas.slice(i, i + 100)), Query.limit(100)] })
    for (const r of rows) existentes.add(r.nombre_norm)
  }

  const errores = []
  const vistos = new Set()
  filas.forEach((f, i) => {
    const n = i + 1
    const e = (m) => errores.push({ fila: n, mensaje: m })
    if (!f || typeof f !== 'object') return e('Fila no válida.')
    const problemas = validarOperador(f, ahora)
    for (const p of problemas) e(p.mensaje)
    if (!basesActivas.has(normalizarNombre(f.base ?? ''))) e(`La base "${f.base}" no existe o está inactiva.`)
    const r = reclutadores.get(f.reclutador_id)
    if (!r || !r.activo || r.rol !== 'reclutador') e('El reclutador no existe o está inactivo.')
    const norm = normas[i]
    if (norm && vistos.has(norm)) e('Nombre duplicado dentro del lote.')
    if (norm && existentes.has(norm)) e('Ya existe un operador con ese nombre.')
    if (norm) vistos.add(norm)
  })

  if (!confirmar) return respuesta(200, { ok: true, validas: filas.length - new Set(errores.map((x) => x.fila)).size, errores })
  if (errores.length) return respuesta(400, { ok: false, status: 400, mensaje: 'Hay filas con errores; no se importó nada.', errores })

  // Escritura en bloques paralelos para caber en el límite de 30 s; si algo falla se revierte todo el lote.
  const creadas = []
  try {
    for (let i = 0; i < filas.length; i += PARALELO) {
      const bloque = filas.slice(i, i + PARALELO)
      const nuevas = await Promise.allSettled(bloque.map((f) =>
        tdb.createRow({ databaseId: DB, tableId: 'operadores', rowId: ID.unique(), data: aFila(f, reclutadores.get(f.reclutador_id).nombre, 1, { ahora }) })))
      for (const r of nuevas) if (r.status === 'fulfilled') creadas.push(r.value)
      const fallo = nuevas.find((r) => r.status === 'rejected')
      if (fallo) throw fallo.reason
    }
    await Promise.all(creadas.map((fila) => auditar(tdb, yo, { entidad: 'operadores', registro_id: fila.$id, accion: 'importar', antes: null, despues: { nombre: fila.nombre } }, ahora)))
  } catch (e) {
    await Promise.allSettled(creadas.map((fila) => tdb.deleteRow({ databaseId: DB, tableId: 'operadores', rowId: fila.$id })))
    throw e
  }
  return respuesta(200, { ok: true, creadas: filas.length })
}

export default envolver(manejar)
