import { signal } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import { cerrarSesion, iniciarTemporizadorInactividad, sesion, sesionActual } from '../lib/auth'
import { Avisos, avisar } from './componentes/toast'
import { Layout } from './layout'
import { CambiarPassword, Login, mensajeLogin } from './paginas/login'
import { RUTAS } from './rutas'

const hash = signal(location.hash)
const MINUTOS_INACTIVIDAD = 30
const REVALIDAR_MS = 5 * 60_000

export function App() {
  useEffect(() => {
    const alHash = () => (hash.value = location.hash)
    addEventListener('hashchange', alHash)
    sesionActual().then((s) => (sesion.value = s))
    return () => removeEventListener('hashchange', alHash)
  }, [])

  const logueado = !!sesion.value
  useEffect(() => {
    if (!logueado) return
    const parar = iniciarTemporizadorInactividad(MINUTOS_INACTIVIDAD, async () => {
      mensajeLogin.value = 'Su sesión se cerró por inactividad.'
      await cerrarSesion()
    })
    // Detecta usuarios desactivados o con sesión revocada sin esperar a la siguiente acción.
    const rev = setInterval(async () => {
      if (!(await sesionActual())) { mensajeLogin.value = 'Su sesión ya no es válida. Inicie sesión de nuevo.'; await cerrarSesion() }
    }, REVALIDAR_MS)
    return () => { parar(); clearInterval(rev) }
  }, [logueado])

  const s = sesion.value
  let cuerpo
  if (s === undefined) cuerpo = <div class="cargando" role="status" aria-label="Cargando"><span class="pulso" /></div>
  else if (!s) cuerpo = <Login />
  else if (s.debeCambiar) cuerpo = <CambiarPassword />
  else {
    const visibles = RUTAS.filter((r) => r.roles.includes(s.rol))
    const pedida = hash.value.replace(/^#\/?/, '').split('?')[0]
    const ruta = visibles.find((r) => r.ruta === pedida)
    if (!ruta) { if (pedida && RUTAS.some((r) => r.ruta === pedida)) avisar('bad', 'No tiene permiso para esa sección.'); location.hash = '#/panel'; return null }
    const Vista = ruta.vista
    cuerpo = <Layout ruta={ruta}><Vista /></Layout>
  }
  return <><a class="sr-only" href="#contenido">Saltar al contenido</a>{cuerpo}<Avisos /></>
}
