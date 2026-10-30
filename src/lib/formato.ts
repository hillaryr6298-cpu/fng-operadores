import type { EtapaValor, Estatus } from '../../shared/dominio'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a.slice(2)}`
}

export function textoEtapa(v: EtapaValor | undefined): string {
  if (!v) return '—'
  if (v.fecha) return fmtFecha(v.fecha)
  switch (v.res) {
    case 'NA_LOCAL': return 'N/A LOCAL'
    case 'OP_VIAJE': return 'OP. VIAJE'
    case 'OK': return 'OK'
    case 'NO_APTO': return 'NO APTO'
    default: return '—'
  }
}

export function etiquetaMes(ym: string): string {
  const [a, m] = ym.split('-')
  return `${MESES[Number(m) - 1]} ${a}`
}

/** La fecha de "hoy" según el calendario local, expresada como medianoche UTC (lo que espera `dominio`). */
export function hoyLocal(ahora = new Date()): Date {
  return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()))
}
export const hoyISO = (ahora = new Date()) => hoyLocal(ahora).toISOString().slice(0, 10)

export const ETIQUETA_ESTATUS: Record<Estatus, string> = {
  PREMEDICO_INTERNO: 'Premédico interno', VALIDACION_CARTAS: 'Validación de cartas', PREMEDICO_CRYO: 'Premédico Cryo',
  LABORATORIOS: 'Laboratorios', DICTAMEN: 'Dictamen', CONTRATADO: 'Contratado', DESCARTADO: 'Descartado',
}
export const CLASE_ESTATUS: Record<Estatus, string> = {
  PREMEDICO_INTERNO: '', VALIDACION_CARTAS: '', PREMEDICO_CRYO: 'acento', LABORATORIOS: 'acento',
  DICTAMEN: 'warn', CONTRATADO: 'ok', DESCARTADO: 'bad',
}
export const ETIQUETA_MODALIDAD = { FULL: 'Full', SENCILLO: 'Sencillo', MOVEDOR: 'Movedor' } as const
export const ETIQUETA_RESULTADO = { FECHA: 'Fecha', NA_LOCAL: 'N/A local', OP_VIAJE: 'Op. viaje', OK: 'OK', NO_APTO: 'No apto' } as const
