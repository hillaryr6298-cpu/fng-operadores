export const ETAPAS = [
  { clave: 'quimica_sanguinea', nombre: 'Química sanguínea' },
  { clave: 'revision_medica_interna', nombre: 'Revisión médica interna' },
  { clave: 'solicitud_examen_cryo', nombre: 'Solicitud de examen Cryo' },
  { clave: 'revaloracion', nombre: 'Revaloración' },
  { clave: 'resultado_premedicos_cryo', nombre: 'Resultado premédicos Cryo' },
  { clave: 'prueba_manejo', nombre: 'Prueba de manejo' },
  { clave: 'envio_laboratorios', nombre: 'Envío laboratorios' },
  { clave: 'envio_resultados_cliente', nombre: 'Envío resultados cliente' },
  { clave: 'dictamen_cryo', nombre: 'Dictamen Cryo' },
  { clave: 'contratacion', nombre: 'Contratación' },
] as const

export type EtapaClave = (typeof ETAPAS)[number]['clave']
export const ROLES = ['admin', 'gerente_rh', 'reclutador', 'consulta'] as const
export type Rol = (typeof ROLES)[number]
export const MODALIDADES = ['FULL', 'SENCILLO', 'MOVEDOR'] as const
export type Modalidad = (typeof MODALIDADES)[number]
export const ESTATUS = [
  'PREMEDICO_INTERNO', 'VALIDACION_CARTAS', 'PREMEDICO_CRYO', 'LABORATORIOS',
  'DICTAMEN', 'CONTRATADO', 'DESCARTADO',
] as const
export type Estatus = (typeof ESTATUS)[number]
export const RESULTADOS = ['FECHA', 'NA_LOCAL', 'OP_VIAJE', 'OK', 'NO_APTO'] as const
export type Resultado = (typeof RESULTADOS)[number]

export type EtapaValor = { fecha: string | null; res: Resultado | null }
export type OperadorInput = {
  nombre: string
  base: string
  reclutador_id: string
  modalidad: Modalidad
  estatus: Estatus
  observaciones?: string
  motivo_descarte?: string
  etapas: Record<EtapaClave, EtapaValor>
}
export type ErrorValidacion = { campo: string; mensaje: string }

/** Etapas que siguen el orden cronológico estricto. Revaloración y prueba de manejo
 *  pueden ocurrir en cualquier momento (hay casos reales en el Excel). */
const ETAPAS_ORDENADAS: EtapaClave[] = [
  'quimica_sanguinea', 'revision_medica_interna', 'solicitud_examen_cryo',
  'resultado_premedicos_cryo', 'envio_laboratorios', 'envio_resultados_cliente',
  'dictamen_cryo', 'contratacion',
]
const DIAS_FUTURO_MAX = 30
const MS_DIA = 86_400_000

export function normalizarNombre(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const reFecha = /^\d{4}-\d{2}-\d{2}$/
function aMs(fecha: string): number {
  return Date.parse(fecha + 'T00:00:00Z')
}
function fechaValida(f: string): boolean {
  if (!reFecha.test(f)) return false
  const ms = aMs(f)
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === f
}
function hoyMs(hoy: Date): number {
  return Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())
}

export function validarOperador(o: OperadorInput, hoy: Date): ErrorValidacion[] {
  const err: ErrorValidacion[] = []
  const add = (campo: string, mensaje: string) => err.push({ campo, mensaje })

  if (!o.nombre || !normalizarNombre(o.nombre)) add('nombre', 'El nombre es obligatorio.')
  else if (o.nombre.length > 150) add('nombre', 'El nombre es demasiado largo.')
  if (!o.base?.trim()) add('base', 'La base es obligatoria.')
  if (!o.reclutador_id) add('reclutador_id', 'El reclutador es obligatorio.')
  if (!MODALIDADES.includes(o.modalidad)) add('modalidad', 'Modalidad no válida.')
  if (!ESTATUS.includes(o.estatus)) add('estatus', 'Estatus no válido.')
  if ((o.observaciones ?? '').length > 2000) add('observaciones', 'Observaciones demasiado largas.')

  const limite = hoyMs(hoy) + DIAS_FUTURO_MAX * MS_DIA
  for (const { clave, nombre } of ETAPAS) {
    const v = o.etapas?.[clave]
    if (!v) continue
    if (v.res !== null && !RESULTADOS.includes(v.res)) add(clave, `${nombre}: resultado no válido.`)
    if (v.res === 'FECHA' && !v.fecha) add(clave, `${nombre}: falta la fecha.`)
    if (v.fecha) {
      if (!fechaValida(v.fecha)) add(clave, `${nombre}: fecha no válida (use AAAA-MM-DD).`)
      else if (aMs(v.fecha) > limite) add(clave, `${nombre}: la fecha está demasiado en el futuro.`)
    }
  }

  let previa: { clave: EtapaClave; ms: number } | null = null
  for (const clave of ETAPAS_ORDENADAS) {
    const f = o.etapas?.[clave]?.fecha
    if (!f || !fechaValida(f)) continue
    const ms = aMs(f)
    if (previa && ms < previa.ms) {
      const n = ETAPAS.find((e) => e.clave === clave)!.nombre
      const np = ETAPAS.find((e) => e.clave === previa!.clave)!.nombre
      add(clave, `${n}: no puede ser anterior a "${np}".`)
    }
    previa = { clave, ms }
  }

  if (o.estatus === 'CONTRATADO' && o.etapas?.dictamen_cryo?.res !== 'OK')
    add('estatus', 'No se puede contratar sin dictamen Cryo en OK.')
  if (o.estatus === 'DESCARTADO' && !o.motivo_descarte?.trim())
    add('motivo_descarte', 'El descarte requiere un motivo.')

  return err
}

export function fechaInicio(e: OperadorInput['etapas']): string | null {
  const fechas = ETAPAS.map((x) => e[x.clave]?.fecha).filter((f): f is string => !!f && fechaValida(f))
  return fechas.length ? fechas.sort()[0] : null
}

export function totalDias(e: OperadorInput['etapas'], hoy: Date): number | null {
  const ini = fechaInicio(e)
  if (!ini) return null
  const fin = e.contratacion?.fecha && fechaValida(e.contratacion.fecha) ? aMs(e.contratacion.fecha) : hoyMs(hoy)
  return Math.max(0, Math.round((fin - aMs(ini)) / MS_DIA))
}

export function aDocumento(o: OperadorInput): Record<string, unknown> {
  const d: Record<string, unknown> = {
    nombre: o.nombre, base: o.base, reclutador_id: o.reclutador_id, modalidad: o.modalidad,
    estatus: o.estatus, observaciones: o.observaciones ?? '', motivo_descarte: o.motivo_descarte ?? '',
  }
  for (const { clave } of ETAPAS) {
    d[`${clave}_fecha`] = o.etapas[clave]?.fecha ?? null
    d[`${clave}_res`] = o.etapas[clave]?.res ?? null
  }
  return d
}

export function deDocumento(d: Record<string, any>): OperadorInput {
  const etapas = {} as OperadorInput['etapas']
  for (const { clave } of ETAPAS) {
    const f = d[`${clave}_fecha`]
    etapas[clave] = { fecha: f ? String(f).slice(0, 10) : null, res: d[`${clave}_res`] ?? null }
  }
  return {
    nombre: d.nombre, base: d.base, reclutador_id: d.reclutador_id, modalidad: d.modalidad,
    estatus: d.estatus, observaciones: d.observaciones || '', motivo_descarte: d.motivo_descarte || undefined,
    etapas,
  }
}

export function puedeEditar(rol: Rol, uid: string, reclutadorId: string): boolean {
  if (rol === 'admin' || rol === 'gerente_rh') return true
  if (rol === 'reclutador') return uid === reclutadorId
  return false
}

/** Appwrite solo admite etiquetas (labels) alfanuméricas. */
export function etiquetaDeRol(rol: Rol): string {
  return rol.replace(/_/g, '')
}

/** Devuelve un mensaje de error, o null si la contraseña es aceptable. */
export function validarPassword(p: string): string | null {
  if (typeof p !== 'string' || p.length < 12) return 'La contraseña debe tener al menos 12 caracteres.'
  if (p.length > 128) return 'La contraseña es demasiado larga.'
  if (new Set(p).size < 5) return 'La contraseña es demasiado simple.'
  return null
}

/** Nombre para mostrar: conserva acentos y Ñ; solo recorta, colapsa espacios y pasa a mayúsculas. */
export function limpiarNombre(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLocaleUpperCase('es-MX')
}
