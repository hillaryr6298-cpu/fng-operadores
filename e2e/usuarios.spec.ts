import { expect, test } from '@playwright/test'
import { entrar, menu, usuarios } from './util'

test('alta de usuario, cambio forzado de contraseña, auditoría y desactivación', async ({ browser }) => {
  const u = usuarios()
  const admin = await (await browser.newContext()).newPage()
  await entrar(admin, u.admin)
  await admin.goto('./#/usuarios')
  const correo = `e2e-${Date.now()}@fng-test.invalid`
  await admin.getByRole('button', { name: 'Nuevo usuario' }).click()
  await admin.fill('#un', 'E2E Reclutador'); await admin.fill('#ue', correo); await admin.selectOption('#ur', 'reclutador')
  const temporal = await admin.inputValue('#up')
  await admin.getByRole('button', { name: 'Crear usuario' }).click()
  await expect(admin.getByText('Usuario creado')).toBeVisible({ timeout: 30_000 })
  await admin.getByRole('button', { name: 'Listo' }).click()
  await expect(admin.locator('tr', { hasText: correo })).toBeVisible()

  // El nuevo usuario entra con la temporal y debe cambiarla.
  const nuevo = await (await browser.newContext()).newPage()
  await nuevo.goto('./'); await nuevo.fill('#email', correo); await nuevo.fill('#pass', temporal); await nuevo.click('button[type=submit]')
  await expect(nuevo.getByRole('heading', { name: 'Cambiar contraseña' })).toBeVisible({ timeout: 30_000 })
  await nuevo.fill('#a', temporal); await nuevo.fill('#n', 'corta'); await nuevo.fill('#r', 'corta')
  await nuevo.getByRole('button', { name: 'Guardar y continuar' }).click()
  const definitiva = `Definitiva-${Date.now()}-x`
  await nuevo.fill('#n', definitiva); await nuevo.fill('#r', definitiva)
  await nuevo.getByRole('button', { name: 'Guardar y continuar' }).click()
  await expect(nuevo.locator('.alerta.info')).toContainText('Contraseña actualizada', { timeout: 30_000 })
  await nuevo.fill('#email', correo); await nuevo.fill('#pass', definitiva); await nuevo.click('button[type=submit]')
  await expect(nuevo.locator('.nav')).toBeVisible({ timeout: 30_000 })
  expect(await menu(nuevo)).not.toContain('Usuarios')

  // El administrador ve el alta en la bitácora con el detalle.
  await admin.goto('./#/auditoria')
  const fila = admin.locator('tr', { hasText: 'Usuarios' }).filter({ hasText: 'Alta' }).first()
  await expect(fila).toBeVisible({ timeout: 30_000 })
  await fila.getByRole('button', { name: 'Detalle' }).click()
  await expect(admin.getByText('Reclutador', { exact: true }).first()).toBeVisible()

  // Desactivar: la sesión del usuario cae y no puede volver a entrar.
  await admin.goto('./#/usuarios')
  await admin.locator('tr', { hasText: correo }).getByRole('button', { name: 'Desactivar' }).click()
  await admin.getByRole('dialog').getByRole('button', { name: 'Desactivar' }).click()
  await expect(admin.locator('tr', { hasText: correo }).getByText('Desactivado')).toBeVisible({ timeout: 30_000 })
  await nuevo.goto('./')
  await expect(nuevo.locator('.login-form')).toBeVisible({ timeout: 30_000 })
  await nuevo.fill('#email', correo); await nuevo.fill('#pass', definitiva); await nuevo.click('button[type=submit]')
  await expect(nuevo.locator('.alerta.bad')).toBeVisible({ timeout: 30_000 })
})
