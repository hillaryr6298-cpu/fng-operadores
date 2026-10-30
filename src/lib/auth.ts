import { signal } from '@preact/signals'
import type { Rol } from '../../shared/dominio'
import { account, tdb } from './appwrite'
import { DB_ID } from './config'

export { iniciarTemporizadorInactividad } from './inactividad'

export type Sesion = { id: string; nombre: string; rol: Rol; email: string; debeCambiar: boolean }

/** undefined = aún comprobando; null = sin sesión. */
export const sesion = signal<Sesion | null | undefined>(undefined)

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: 'Administrador', gerente_rh: 'Gerente de RH', reclutador: 'Reclutador', consulta: 'Consulta',
}

/** Lee el perfil del usuario autenticado. Un perfil inactivo cierra la sesión. */
export async function sesionActual(): Promise<Sesion | null> {
  try {
    const u = await account.get()
    const p = await tdb.getRow({ databaseId: DB_ID, tableId: 'perfiles', rowId: u.$id })
    if (!p.activo) {
      await account.deleteSession({ sessionId: 'current' }).catch(() => {})
      return null
    }
    return { id: u.$id, nombre: p.nombre, rol: p.rol, email: p.email, debeCambiar: !!p.debe_cambiar }
  } catch {
    return null
  }
}

export async function iniciarSesion(email: string, password: string): Promise<Sesion> {
  await account.deleteSession({ sessionId: 'current' }).catch(() => {})
  try {
    await account.createEmailPasswordSession({ email: email.trim().toLowerCase(), password })
  } catch (e: any) {
    if (e?.code === 429) throw new Error('Demasiados intentos. Espere unos minutos e intente de nuevo.')
    throw new Error('Correo o contraseña incorrectos.')
  }
  const s = await sesionActual()
  if (!s) throw new Error('Su cuenta no tiene acceso. Contacte al administrador.')
  sesion.value = s
  return s
}

export async function cerrarSesion(): Promise<void> {
  await account.deleteSession({ sessionId: 'current' }).catch(() => {})
  sesion.value = null
}
