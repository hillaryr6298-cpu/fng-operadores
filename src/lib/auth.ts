import { signal } from '@preact/signals'
import type { Rol } from '../../shared/dominio'
import { account, tdb } from './appwrite'
import { DB_ID } from './config'
import { clasificarError } from './errores'

export { iniciarTemporizadorInactividad } from './inactividad'

export type Sesion = { id: string; nombre: string; rol: Rol; email: string; debeCambiar: boolean }

/** undefined = aún comprobando; null = sin sesión. */
export const sesion = signal<Sesion | null | undefined>(undefined)

export { ETIQUETA_ROL } from './formato'

export type Comprobacion = { estado: 'ok'; sesion: Sesion } | { estado: 'invalida' } | { estado: 'red' }

/** Lee el perfil del usuario autenticado. Un perfil inactivo cierra la sesión; un fallo de red no. */
export async function comprobarSesion(): Promise<Comprobacion> {
  try {
    const u = await account.get()
    const p = await tdb.getRow({ databaseId: DB_ID, tableId: 'perfiles', rowId: u.$id })
    if (!p.activo) {
      await account.deleteSession({ sessionId: 'current' }).catch(() => {})
      return { estado: 'invalida' }
    }
    return { estado: 'ok', sesion: { id: u.$id, nombre: p.nombre, rol: p.rol, email: p.email, debeCambiar: !!p.debe_cambiar } }
  } catch (e) {
    return { estado: clasificarError(e) === 'invalida' || (e as any)?.code === 404 ? 'invalida' : 'red' }
  }
}

export async function sesionActual(): Promise<Sesion | null> {
  const c = await comprobarSesion()
  return c.estado === 'ok' ? c.sesion : null
}

export async function iniciarSesion(email: string, password: string): Promise<Sesion> {
  await account.deleteSession({ sessionId: 'current' }).catch(() => {})
  try {
    await account.createEmailPasswordSession({ email: email.trim().toLowerCase(), password })
  } catch (e: any) {
    const c = clasificarError(e)
    if (c === 'limite') throw new Error('Demasiados intentos. Espere unos minutos e intente de nuevo.')
    if (c === 'red') throw new Error('No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.')
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
