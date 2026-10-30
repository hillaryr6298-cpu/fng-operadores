export type ClaseError = 'invalida' | 'limite' | 'red'

/** Distingue una sesión inválida (401/403) de un fallo transitorio de red/servidor. */
export function clasificarError(e: unknown): ClaseError {
  const code = (e as { code?: number } | null)?.code
  if (code === 401 || code === 403) return 'invalida'
  if (code === 429) return 'limite'
  return 'red'
}
