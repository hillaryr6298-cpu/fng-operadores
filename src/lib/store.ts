import { signal } from '@preact/signals'
import { fechaInicio } from '../../shared/dominio'
import type { OperadorConId } from './api'
import { client, Query, tdb } from './appwrite'
import { DB_ID } from './config'
import { aplicarEvento, cargarTodasLasFilas, deFila, type Base, type Op, type Perfil } from './datos'

export const operadores = signal<Op[]>([])
export const perfiles = signal<Perfil[]>([])
export const bases = signal<Base[]>([])
export const cargando = signal(true)
export const errorCarga = signal('')

const LOTE = 100
const listarTabla = (tableId: string) => (cursor?: string) =>
  tdb.listRows({
    databaseId: DB_ID, tableId,
    queries: [Query.limit(LOTE), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
  })

export async function cargarTodo(): Promise<void> {
  try {
    const [ops, ps, bs] = await Promise.all([
      cargarTodasLasFilas(listarTabla('operadores'), LOTE),
      cargarTodasLasFilas(listarTabla('perfiles'), LOTE),
      cargarTodasLasFilas(listarTabla('bases'), LOTE),
    ])
    operadores.value = ops.map(deFila)
    perfiles.value = ps.map((p) => ({ id: p.$id, nombre: p.nombre, rol: p.rol, activo: p.activo, email: p.email }))
    bases.value = bs.map((b) => ({ id: b.$id, nombre: b.nombre, activa: b.activa })).sort((a, b) => a.nombre.localeCompare(b.nombre))
    errorCarga.value = ''
  } catch {
    errorCarga.value = 'No se pudieron cargar los datos. Verifique su conexión.'
  } finally {
    cargando.value = false
  }
}

/** Reemplaza una fila local con la versión que devolvió la API (sin esperar al evento Realtime). */
export function integrar(fila: Record<string, any>) {
  operadores.value = aplicarEvento(operadores.value, 'update', fila)
}
export function integrarOp(op: Op) {
  const i = operadores.value.findIndex((o) => o.id === op.id)
  if (i < 0) operadores.value = [...operadores.value, op]
  else if (op.version >= operadores.value[i].version) {
    const c = operadores.value.slice(); c[i] = op; operadores.value = c
  }
}

/** Suscribe a cambios en vivo. Además refresca al volver a la pestaña y cada 2 min como respaldo. */
export function suscribir(): () => void {
  const canal = `tablesdb.${DB_ID}.tables.operadores.rows`
  const off = client.subscribe<Record<string, any>>(canal, (ev) => {
    const tipo = ev.events.find((e) => /\.(create|update|delete)$/.test(e))?.split('.').pop() as 'create' | 'update' | 'delete' | undefined
    if (tipo) operadores.value = aplicarEvento(operadores.value, tipo, ev.payload)
  })
  const refrescar = () => { if (document.visibilityState === 'visible') void cargarTodo() }
  document.addEventListener('visibilitychange', refrescar)
  const t = setInterval(refrescar, 120_000)
  return () => { off(); document.removeEventListener('visibilitychange', refrescar); clearInterval(t) }
}

/** Convierte la respuesta de la API (sin nombre de reclutador ni fecha de inicio) al modelo local. */
export function opDesdeDoc(doc: OperadorConId): Op {
  const rec = perfiles.value.find((p) => p.id === doc.reclutador_id)
  return { ...doc, reclutador_nombre: rec?.nombre ?? '', fecha_inicio: fechaInicio(doc.etapas) }
}
