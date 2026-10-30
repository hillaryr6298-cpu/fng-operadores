// Punto de entrada único (el plan gratuito de Appwrite limita a 2 Functions por proyecto).
// Cuerpo: { modulo, ...resto }; cada módulo valida su propio cuerpo y su rol.
import { manejar as operadores } from '../../operador-guardar/src/main.js'
import { manejar as usuarios } from '../../usuarios-admin/src/main.js'
import { manejar as password } from '../../cambiar-password/src/main.js'
import { manejar as importar } from '../../importar-excel/src/main.js'
import { manejar as bases } from '../../bases-admin/src/main.js'
import { autenticar, envolver, err } from '../../_comun/comun.js'

const MODULOS = { operadores, usuarios, password, importar, bases }

export async function manejar(ctx) {
  const modulo = ctx.cuerpo?.modulo
  const m = Object.hasOwn(MODULOS, modulo) ? MODULOS[modulo] : null
  if (!m) return err(400, 'Módulo no válido.')
  const { yo, fallo } = await autenticar(ctx.tdb, ctx.uid)
  if (fallo) return fallo
  if (yo.debeCambiar && modulo !== 'password') return err(403, 'Debe cambiar su contraseña antes de continuar.')
  return m(ctx)
}

export default envolver(manejar)
