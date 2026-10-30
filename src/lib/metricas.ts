import { ETAPAS, totalDias, type EtapaClave } from '../../shared/dominio'
import type { Op } from './datos'

const MS_DIA = 86_400_000
export const enProceso = (o: Op) => o.estatus !== 'DESCARTADO' && o.estatus !== 'CONTRATADO'

export function etapaActual(o: Op): EtapaClave | 'sin_iniciar' {
  for (let i = ETAPAS.length - 1; i >= 0; i--) {
    const v = o.etapas[ETAPAS[i].clave]
    if (v?.fecha || v?.res) return ETAPAS[i].clave
  }
  return 'sin_iniciar'
}

export function conteoPorEtapa(ops: Op[]): Partial<Record<EtapaClave | 'sin_iniciar', number>> {
  const r: Partial<Record<EtapaClave | 'sin_iniciar', number>> = {}
  for (const o of ops.filter(enProceso)) { const e = etapaActual(o); r[e] = (r[e] ?? 0) + 1 }
  return r
}

export function conteoPorEstatus(ops: Op[]): Record<string, number> {
  const r: Record<string, number> = {}
  for (const o of ops) r[o.estatus] = (r[o.estatus] ?? 0) + 1
  return r
}

export function porReclutador(ops: Op[]): { nombre: string; total: number }[] {
  const m = new Map<string, number>()
  for (const o of ops.filter(enProceso)) m.set(o.reclutador_nombre, (m.get(o.reclutador_nombre) ?? 0) + 1)
  return [...m].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total)
}

export function promedioDias(ops: Op[], hoy: Date): number | null {
  const d = ops.filter(enProceso).map((o) => totalDias(o.etapas, hoy)).filter((x): x is number => x !== null)
  return d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : null
}

/** Días desde la última fecha registrada (null si no hay ninguna fecha). */
export function diasSinAvance(o: Op, hoy: Date): number | null {
  const fechas = ETAPAS.map((e) => o.etapas[e.clave]?.fecha).filter((f): f is string => !!f).sort()
  if (!fechas.length) return null
  return Math.round((hoy.getTime() - Date.parse(fechas[fechas.length - 1] + 'T00:00:00Z')) / MS_DIA)
}

export function atrasados(ops: Op[], hoy: Date, umbral = 15): { op: Op; dias: number }[] {
  return ops.filter(enProceso)
    .map((op) => ({ op, dias: diasSinAvance(op, hoy) }))
    .filter((x): x is { op: Op; dias: number } => x.dias !== null && x.dias > umbral)
    .sort((a, b) => b.dias - a.dias)
}
