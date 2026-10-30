import { aDocumento, deDocumento, fechaInicio, normalizarNombre } from '../../../shared/dominio.ts'

export const aFechaApp = (f) => (f ? `${f}T00:00:00.000+00:00` : null)
export const filaADominio = (fila) => deDocumento(fila)

/** Convierte el dominio a las columnas de la tabla `operadores`. */
export function aFila(datos, reclutadorNombre, version) {
  const d = aDocumento(datos)
  for (const k of Object.keys(d)) if (k.endsWith('_fecha')) d[k] = aFechaApp(d[k])
  return {
    ...d,
    nombre: normalizarNombre(datos.nombre),
    nombre_norm: normalizarNombre(datos.nombre),
    reclutador_nombre: reclutadorNombre,
    version,
    fecha_inicio: aFechaApp(fechaInicio(datos.etapas)),
  }
}

export const salida = (fila) => ({ id: fila.$id, version: fila.version, ...filaADominio(fila) })
