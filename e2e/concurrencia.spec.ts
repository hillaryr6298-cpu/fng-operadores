import { expect, test } from '@playwright/test'
import { entrar, usuarios } from './util'

test('cambios en vivo y conflicto de versión entre dos sesiones', async ({ browser }) => {
  const u = usuarios()
  const A = await (await browser.newContext()).newPage()
  const B = await (await browser.newContext()).newPage()
  await entrar(A, u.admin); await entrar(B, u.admin)
  for (const p of [A, B]) { await p.goto('./#/operadores'); await expect(p.locator('table.tabla tbody tr').first()).toBeVisible({ timeout: 30_000 }) }

  // A abre el detalle del primer operador y se queda con esa versión.
  const nombre = (await A.locator('td.nom').first().textContent())!
  await A.locator('td.nom').first().click()
  await expect(A.locator('.drawer')).toBeVisible()

  // B edita la misma persona (observaciones) y guarda.
  await B.getByPlaceholder('Nombre del operador').fill(nombre)
  await B.locator('td.nom', { hasText: nombre }).first().click()
  const nota = `nota-${Date.now()}`
  await B.locator('#obs').fill(nota)
  await B.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(B.locator('.aviso')).toContainText('Cambios guardados')

  // A (sin recargar) edita otra cosa y guarda → debe avisar del conflicto en lugar de pisar.
  await A.locator('#obs').fill('texto de A')
  await A.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(A.locator('.drawer .alerta.warn')).toContainText('modificado por otra persona')
  // El texto de A se conserva y, al volver a guardar, se aplica sobre la versión nueva.
  await expect(A.locator('#obs')).toHaveValue('texto de A')
  await A.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(A.locator('.aviso').last()).toContainText('Cambios guardados')

  // B ve el cambio de A sin recargar (Realtime o respaldo): la fila de B refleja la nueva versión.
  await B.locator('td.nom', { hasText: nombre }).first().click()
  await expect(B.locator('#obs')).toHaveValue('texto de A', { timeout: 15_000 })
})
