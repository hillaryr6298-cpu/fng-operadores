import { readFileSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'

export type Cred = { email: string; password: string }
export const usuarios = (): Record<'admin' | 'reclutador' | 'consulta', Cred> => {
  const f = process.env.E2E_USERS
  if (!f) throw new Error('Defina E2E_USERS con la ruta del JSON de usuarios de prueba')
  return JSON.parse(readFileSync(f, 'utf8'))
}

export async function entrar(page: Page, c: Cred) {
  await page.goto('./')
  await page.fill('#email', c.email)
  await page.fill('#pass', c.password)
  await page.click('button[type=submit]')
  await expect(page.locator('.nav')).toBeVisible({ timeout: 30_000 })
}
export const menu = (page: Page) => page.locator('.nav a').allTextContents()
