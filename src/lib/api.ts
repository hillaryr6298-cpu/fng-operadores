import type { ErrorValidacion, OperadorInput } from '../../shared/dominio'
import { ExecutionMethod, functions } from './appwrite'

export type RespuestaApi<T = any> =
  | ({ ok: true } & T)
  | { ok: false; status: number; mensaje: string; errores: ErrorValidacion[]; actual?: any }

/** Llama a la Function única `api`. Nunca lanza por errores de negocio: devuelve ok:false. */
export async function ejecutar<T = any>(modulo: string, cuerpo: Record<string, unknown>): Promise<RespuestaApi<T>> {
  try {
    const e = await functions.createExecution({
      functionId: 'api', body: JSON.stringify({ modulo, ...cuerpo }), async: false,
      xpath: '/', method: ExecutionMethod.POST, headers: { 'content-type': 'application/json' },
    })
    const body = JSON.parse(e.responseBody || '{}')
    if (e.responseStatusCode >= 400 || body.ok === false)
      return { ok: false, status: e.responseStatusCode, mensaje: body.mensaje ?? 'Error del servidor.', errores: body.errores ?? [], actual: body.actual }
    return body
  } catch (e: any) {
    return { ok: false, status: e?.code ?? 0, mensaje: e?.code === 401 ? 'Su sesión expiró. Inicie sesión de nuevo.' : 'No se pudo conectar con el servidor.', errores: [] }
  }
}

export type OperadorConId = OperadorInput & { id: string; version: number }

export const guardarOperador = (
  accion: 'crear' | 'actualizar' | 'descartar' | 'contratar',
  datos?: Partial<OperadorInput>, id?: string, version?: number,
) => ejecutar<{ doc: OperadorConId }>('operadores', { accion, datos, id, version })
