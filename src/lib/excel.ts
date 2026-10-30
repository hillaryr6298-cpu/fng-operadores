import * as XLSX from 'xlsx'
import {
  ETAPAS, ESTATUS, normalizarNombre, validarOperador,
  type EtapaClave, type Estatus, type OperadorInput, type Resultado,
} from '../../shared/dominio'

export type Reclutador = { id: string; nombre: string }
export type ResultadoParseo = { filas: OperadorInput[]; errores: { fila: number; mensaje: string }[] }

const limpiar = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

const ENCABEZADOS: Record<string, string> = {
  'NOMBRE OPERADOR': 'nombre', BASE: 'base', RECLUTADOR: 'reclutador', MODALIDAD: 'modalidad',
  ESTATUS: 'estatus', OBSERVACIONES: 'observaciones',
  'QUIMICA SANGUINEA': 'quimica_sanguinea', 'REVISION MEDICA INTERNA': 'revision_medica_interna',
  'SOLICITUD DE EXAMEN CRYO': 'solicitud_examen_cryo', REVALORACION: 'revaloracion',
  'RESULTADO PREMEDICOS CRYO': 'resultado_premedicos_cryo', 'PRUEBA DE MANEJO': 'prueba_manejo',
  'ENVIO LABORATORIOS': 'envio_laboratorios', 'ENVIO RESULTADOS CLIENTE': 'envio_resultados_cliente',
  'DICTAMEN CRYO': 'dictamen_cryo', CONTRATACION: 'contratacion',
}
const ALIAS_ESTATUS: Record<string, Estatus> = { VALIDACION_DE_CARTAS: 'VALIDACION_CARTAS' }
const nombreEtapa = (c: EtapaClave) => ETAPAS.find((e) => e.clave === c)!.nombre

const iso = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** Devuelve la celda como {fecha}/{res}, o null si no se reconoce. */
function celda(v: unknown): { fecha: string | null; res: Resultado | null } | null | 'vacia' {
  if (v === null || v === undefined || (typeof v === 'string' && !v.trim())) return 'vacia'
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : { fecha: iso(v.getFullYear(), v.getMonth() + 1, v.getDate()), res: 'FECHA' }
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000)
    return { fecha: iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()), res: 'FECHA' }
  }
  const t = limpiar(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return { fecha: t, res: 'FECHA' }
  if (/^N[|/ ]?A\b/.test(t)) return { fecha: null, res: 'NA_LOCAL' }
  if (/^OP\.? ?VIAJE$/.test(t)) return { fecha: null, res: 'OP_VIAJE' }
  if (t === 'OK') return { fecha: null, res: 'OK' }
  if (/^NO APTO/.test(t)) return { fecha: null, res: 'NO_APTO' }
  return null
}

export function parsearHojaOperadores(
  filas: unknown[][],
  reclutadores: Reclutador[],
  hoy: Date,
  opciones: { descartados?: boolean } = {},
): ResultadoParseo {
  const errores: ResultadoParseo['errores'] = []
  const salida: OperadorInput[] = []
  const cab = (filas[0] ?? []).map((h) => ENCABEZADOS[limpiar(h)] ?? null)
  if (!cab.includes('nombre')) {
    return { filas: [], errores: [{ fila: 1, mensaje: 'No se encontró la columna "NOMBRE OPERADOR". ¿Es la hoja correcta?' }] }
  }
  const col = (campo: string) => cab.indexOf(campo)
  const recPorNombre = new Map(reclutadores.map((r) => [limpiar(r.nombre), r]))
  const vistos = new Map<string, number>()

  for (let i = 1; i < filas.length; i++) {
    const f = filas[i] ?? []
    const nFila = i + 1
    if (f.every((c) => c === null || c === undefined || String(c).trim() === '')) continue
    const err = (m: string) => errores.push({ fila: nFila, mensaje: m })
    const v = (campo: string) => f[col(campo)]

    const nombre = String(v('nombre') ?? '').trim()
    const norm = normalizarNombre(nombre)
    if (norm && vistos.has(norm)) { err(`Nombre duplicado en el archivo (también en la fila ${vistos.get(norm)}).`); continue }
    if (norm) vistos.set(norm, nFila)

    const rec = recPorNombre.get(limpiar(v('reclutador')))
    if (!rec) { err(`Reclutador "${String(v('reclutador') ?? '').trim()}" no existe entre los usuarios.`); continue }

    let estatus = limpiar(v('estatus')).replace(/ /g, '_') as Estatus
    estatus = ALIAS_ESTATUS[estatus] ?? estatus
    if (!ESTATUS.includes(estatus)) { err(`Estatus "${String(v('estatus') ?? '').trim()}" no reconocido.`); continue }

    const etapas = {} as OperadorInput['etapas']
    let malo = false
    for (const { clave } of ETAPAS) {
      const idx = col(clave)
      const c = idx < 0 ? 'vacia' : celda(f[idx])
      if (c === null) { err(`${nombreEtapa(clave)}: valor no reconocido "${String(f[idx])}".`); malo = true; break }
      etapas[clave] = c === 'vacia' ? { fecha: null, res: null } : c
    }
    if (malo) continue

    const obs = String(v('observaciones') ?? '').trim()
    const op: OperadorInput = {
      nombre, base: limpiar(v('base')), reclutador_id: rec.id, modalidad: limpiar(v('modalidad')) as any,
      estatus: opciones.descartados ? 'DESCARTADO' : estatus, etapas,
      observaciones: opciones.descartados ? '' : obs,
      motivo_descarte: opciones.descartados ? obs : undefined,
    }
    const problemas = validarOperador(op, hoy)
    if (problemas.length) { err(problemas.map((p) => p.mensaje).join(' ')); continue }
    salida.push(op)
  }
  return { filas: salida, errores }
}

/** Lee un .xlsx y devuelve cada hoja como matriz de filas (fechas como Date). */
export function leerLibro(buf: ArrayBuffer): { nombre: string; filas: unknown[][] }[] {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  return wb.SheetNames.map((nombre) => ({
    nombre,
    filas: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombre], { header: 1, raw: true, defval: null }),
  }))
}
