import { expect, test } from '@playwright/test'
import { entrar, usuarios } from './util'

// Ejecutar con E2E_BASE_URL apuntando al sitio publicado (o al preview local con su plataforma registrada).
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('móvil: el menú se abre, navega y las pantallas no desbordan', async ({ page }) => {
  await entrar(page, usuarios().admin)
  const desborda = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  expect(await desborda()).toBe(false)
  await page.getByRole('button', { name: 'Abrir menú' }).click()
  await page.locator('.nav a[href="#/operadores"]').click()      // antes la capa oscura tapaba el menú
  await expect(page).toHaveURL(/#\/operadores$/)
  await expect(page.locator('.nav.abierto')).toHaveCount(0)
  await expect(page.locator('table.tabla tbody tr').first()).toBeVisible({ timeout: 30_000 })
  expect(await desborda()).toBe(false)                             // la tabla desplaza dentro de su marco, no la página
  await page.locator('.enlace-nombre').first().click()
  const ancho = await page.locator('.drawer').evaluate((e) => e.getBoundingClientRect().width)
  expect(ancho).toBeLessThanOrEqual(390)
})
