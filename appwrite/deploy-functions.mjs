// Empaqueta (esbuild) y despliega las Functions en Appwrite. Uso: APPWRITE_API_KEY=... node appwrite/deploy-functions.mjs [nombre...]
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { InputFile } from 'node-appwrite/file'
import { cliente } from './cliente.mjs'

const { fn } = cliente()
const RAIZ = resolve(import.meta.dirname, 'functions')
const TMP = resolve(import.meta.dirname, '.build')
const SCOPES = ['rows.read', 'rows.write', 'users.read', 'users.write', 'sessions.write']
const nombres = ['api']  // única Function desplegable; los demás directorios son módulos que ella enruta
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

const runtime = process.env.APPWRITE_RUNTIME ?? 'node-22'
console.log('runtime:', runtime)

// Limpia Functions de versiones anteriores (plan gratuito: máx. 2 por proyecto).
for (const viejo of ['bases-admin', 'cambiar-password', 'operador-guardar', 'usuarios-admin', 'importar-excel']) {
  try { await fn.delete({ functionId: viejo }); console.log('- eliminada', viejo) } catch (e) { if (e.code !== 404) throw e }
}

rmSync(TMP, { recursive: true, force: true })
for (const nombre of nombres) {
  const dir = join(TMP, nombre)
  mkdirSync(dir, { recursive: true })
  await build({
    entryPoints: [join(RAIZ, nombre, 'src/main.js')], outfile: join(dir, 'main.js'), bundle: true, platform: 'node',
    format: 'esm', target: 'node22', minify: false, legalComments: 'none',
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: nombre, type: 'module', main: 'main.js' }))
  const tar = join(TMP, `${nombre}.tar.gz`)
  execFileSync('tar', ['-czf', tar, '-C', dir, '.'])

  const base = { functionId: nombre, name: nombre, runtime, execute: ['users'], entrypoint: 'main.js', commands: '', scopes: SCOPES, timeout: 30, enabled: true, logging: true }
  try {
    await fn.get({ functionId: nombre })
    await fn.update(base)
  } catch (e) {
    if (e.code !== 404) throw e
    await fn.create(base)
  }
  const dep = await fn.createDeployment({ functionId: nombre, code: InputFile.fromPath(tar, `${nombre}.tar.gz`), activate: true, entrypoint: 'main.js' })
  for (let i = 0; i < 120; i++) {
    const d = await fn.getDeployment({ functionId: nombre, deploymentId: dep.$id })
    if (d.status === 'ready') { console.log('✔', nombre, 'ready'); break }
    if (d.status === 'failed') throw new Error(`Deployment fallido: ${nombre}\n${d.buildLogs}`)
    await dormir(2000)
  }
}
rmSync(TMP, { recursive: true, force: true })
