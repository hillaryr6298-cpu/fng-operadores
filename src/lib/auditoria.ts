import { ETAPAS } from '../../shared/dominio'
import { ETIQUETA_ESTATUS, ETIQUETA_MODALIDAD, ETIQUETA_ROL, textoEtapa } from './formato'

const ETQ: Record<string, string> = {
  nombre: 'Nombre', base: 'Base', reclutador_id: 'Reclutador', modalidad: 'Modalidad', estatus: 'Estatus',
  observaciones: 'Observaciones', motivo_descarte: 'Motivo de descarte', rol: 'Rol', activo: 'Activo', email: 'Correo', activa: 'Activa',
}

function parse(s: string | null): Record<string, any> | null {
  if (!s) return null
  try { const v = JSON.parse(s); return v && typeof v === 'object' ? v : null } catch { return null }
}

function aplanar(o: Record<string, any> | null, nombreDe?: (id: string) => string): Record<string, string> {
  const r: Record<string, string> = {}
  if (!o) return r
  for (const [k, v] of Object.entries(o)) {
    if (k === 'etapas' && v && typeof v === 'object') {
      for (const e of ETAPAS) if (v[e.clave]) r[e.nombre] = textoEtapa(v[e.clave])
    } else if (k === 'rol') r[ETQ[k]] = (ETIQUETA_ROL as any)[v] ?? String(v)
    else if (k === 'reclutador_id') r[ETQ[k]] = v ? (nombreDe?.(String(v)) ?? String(v)) : ''
    else if (k === 'estatus') r[ETQ[k]] = (ETIQUETA_ESTATUS as any)[v] ?? String(v)
    else if (k === 'modalidad') r[ETQ[k]] = (ETIQUETA_MODALIDAD as any)[v] ?? String(v)
    else if (ETQ[k]) r[ETQ[k]] = v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v)
  }
  return r
}

/** Campos que cambiaron entre dos instantáneas JSON de la bitácora, con etiquetas legibles. */
export function diffAuditoria(antes: string | null, despues: string | null, nombreDe?: (id: string) => string): { campo: string; antes: string; despues: string }[] {
  const a = aplanar(parse(antes), nombreDe), d = aplanar(parse(despues), nombreDe)
  const claves = [...new Set([...Object.keys(a), ...Object.keys(d)])]
  return claves
    .filter((k) => (a[k] ?? '') !== (d[k] ?? '') && !(antes === null && (d[k] ?? '') === '' ))
    .map((k) => ({ campo: k, antes: a[k] === undefined || a[k] === '' && antes === null ? '—' : a[k], despues: d[k] ?? '—' }))
}
