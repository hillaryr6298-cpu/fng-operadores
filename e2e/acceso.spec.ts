import { expect, test } from '@playwright/test'
import { entrar, menu, usuarios } from './util'

test('credenciales incorrectas muestran un mensaje genérico', async ({ page }) => {
  await page.goto('./')
  await page.fill('#email', 'nadie@fng-test.invalid'); await page.fill('#pass', 'incorrecta-123456')
  await page.click('button[type=submit]')
  await expect(page.locator('.alerta.bad')).toHaveText('Correo o contraseña incorrectos.')
})

test('menú y permisos por rol', async ({ browser }) => {
  const u = usuarios()
  const caso = async (c: typeof u.admin) => { const ctx = await browser.newContext(); const p = await ctx.newPage(); await entrar(p, c); return { ctx, p } }

  const a = await caso(u.admin)
  expect(await menu(a.p)).toEqual(expect.arrayContaining(['Importar Excel', 'Auditoría', 'Usuarios', 'Bases']))
  await a.ctx.close()

  const r = await caso(u.reclutador)
  const mr = await menu(r.p)
  for (const x of ['Importar Excel', 'Auditoría', 'Usuarios', 'Bases']) expect(mr).not.toContain(x)
  await r.p.goto('./#/usuarios')                       // acceso directo por URL
  await expect(r.p).toHaveURL(/#\/panel$/)
  await r.ctx.close()

  const c = await caso(u.consulta)
  await c.p.goto('./#/operadores')
  await expect(c.p.locator('table.tabla tbody tr').first()).toBeVisible({ timeout: 30_000 })
  await expect(c.p.getByRole('button', { name: 'Nuevo operador' })).toHaveCount(0)
  expect(await c.p.locator('button.celda-etapa:not([disabled])').count()).toBe(0)
  await c.ctx.close()
})

test('la sesión se cierra tras 30 minutos de inactividad', async ({ page }) => {
  await page.clock.install()
  await entrar(page, usuarios().consulta)
  await page.clock.fastForward('31:00')
  await expect(page.locator('.login-form')).toBeVisible()
  await expect(page.locator('.alerta.info')).toContainText('inactividad')
})
