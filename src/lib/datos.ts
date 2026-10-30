import { deDocumento, type OperadorInput } from '../../shared/dominio'

export type Op = OperadorInput & {
  id: string; version: number; reclutador_nombre: string; fecha_inicio: string | null
}
export type Perfil = { id: string; nombre: string; rol: string; activo: boolean; email: string }
export type Base = { id: string; nombre: string; activa: boolean }

export function deFila(f: Record<string, any>): Op {
  return {
    ...deDocumento(f),
    id: f.$id,
    version: f.version,
    reclutador_nombre: f.reclutador_nombre ?? '',
    fecha_inicio: f.fecha_inicio ? String(f.fecha_inicio).slice(0, 10) : null,
  }
}

/** Aplica un evento Realtime a la lista local. Un evento más viejo que lo que ya tenemos se ignora. */
export function aplicarEvento(lista: Op[], tipo: 'create' | 'update' | 'delete', fila: Record<string, any>): Op[] {
  if (tipo === 'delete') return lista.filter((o) => o.id !== fila.$id)
  const nuevo = deFila(fila)
  const i = lista.findIndex((o) => o.id === nuevo.id)
  if (i < 0) return [...lista, nuevo]
  if (nuevo.version <= lista[i].version) return lista
  const copia = lista.slice()
  copia[i] = nuevo
  return copia
}

/** Pagina por cursor hasta agotar los resultados. */
export async function cargarTodasLasFilas(
  listar: (cursor?: string) => Promise<{ rows: Record<string, any>[] }>,
  lote = 100,
): Promise<Record<string, any>[]> {
  const todas: Record<string, any>[] = []
  let cursor: string | undefined
  for (;;) {
    const { rows } = await listar(cursor)
    todas.push(...rows)
    if (rows.length < lote) return todas
    cursor = rows[rows.length - 1].$id
  }
}

export function opAEntrada(o: Op): OperadorInput {
  const { id: _i, version: _v, reclutador_nombre: _r, fecha_inicio: _f, ...resto } = o
  return resto
}
