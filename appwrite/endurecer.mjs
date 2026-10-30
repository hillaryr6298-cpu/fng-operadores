// Aplica las políticas de seguridad del proyecto Appwrite (idempotente).
// Uso: APPWRITE_API_KEY=... node appwrite/endurecer.mjs
import { Project } from 'node-appwrite'
import { cliente } from './cliente.mjs'

const { c } = cliente()
const p = new Project(c)
const paso = async (nombre, fn) => { try { await fn(); console.log('✔', nombre) } catch (e) { console.log('✘', nombre, '→', e.message.slice(0, 140)) } }

// Contraseñas: el servidor las exige también cuando el usuario las cambia por la API directa.
await paso('contraseña mínima 12 caracteres', () => p.updatePasswordStrengthPolicy({ min: 12 }))
await paso('rechazar contraseñas del diccionario común', () => p.updatePasswordDictionaryPolicy({ enabled: true }))
await paso('rechazar contraseñas con datos personales', () => p.updatePasswordPersonalDataPolicy({ enabled: true }))
await paso('rechazar contraseñas filtradas (Have I Been Pwned)', () => p.updatePasswordPwnedPolicy({ enabled: true, users: true, sessions: false }))
// Sesiones.
await paso('sesión máxima de 12 horas', () => p.updateSessionDurationPolicy({ duration: 12 * 3600 }))
await paso('máximo 3 sesiones simultáneas por usuario', () => p.updateSessionLimitPolicy({ total: 3 }))
await paso('cambiar contraseña cierra las demás sesiones', () => p.updateSessionInvalidationPolicy({ enabled: true }))
// Solo correo + contraseña (y JWT, que usa el propio SDK). Se apagan los demás métodos.
for (const methodId of ['anonymous', 'magic-url', 'email-otp', 'phone', 'passkey', 'invites'])
  await paso(`método de acceso desactivado: ${methodId}`, () => p.updateAuthMethod({ methodId, enabled: false }))
// Registro público cerrado: con el límite en 1 (siempre ≤ usuarios existentes) Appwrite rechaza `account.create`
// de cualquiera, pero el administrador sigue creando usuarios por la Function (API de servidor).
await paso('auto-registro cerrado (límite de usuarios = 1)', () => p.updateUserLimitPolicy({ total: 1 }))
