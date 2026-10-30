import { signal } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import { cerrarSesion, iniciarTemporizadorInactividad, sesion, sesionActual } from '../lib/auth'
import { cargarTodo, suscribir } from '../lib/store'
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

  useEffect(() => {
    if (!logueado || sesion.value?.debeCambiar) return
    void cargarTodo()
    return suscribir()
  }, [logueado, sesion.value?.debeCambiar])

  const s = sesion.value
  const pedida = hash.value.replace(/^#\/?/, '').split('?')[0]
  const ruta = s ? RUTAS.filter((r) => r.roles.includes(s.rol)).find((r) => r.ruta === pedida) : undefined

  // La redirección va en un efecto: avisar() escribe una señal y, dentro del render, provocaría un bucle.
  useEffect(() => {
    if (!s || s.debeCambiar || ruta) return
    if (pedida && RUTAS.some((r) => r.ruta === pedida)) avisar('bad', 'No tiene permiso para esa sección.')
    location.hash = '#/panel'
  }, [s?.id, s?.debeCambiar, pedida, !!ruta])

  let cuerpo
  if (s === undefined) cuerpo = <div class="cargando" role="status" aria-label="Cargando"><span class="pulso" /></div>
  else if (!s) cuerpo = <Login />
  else if (s.debeCambiar) cuerpo = <CambiarPassword />
  else if (!ruta) cuerpo = <div class="cargando" role="status" aria-label="Cargando"><span class="pulso" /></div>
  else {
    const Vista = ruta.vista
    cuerpo = <Layout ruta={ruta}><Vista /></Layout>
  }
  return <><a class="sr-only" href="#contenido">Saltar al contenido</a>{cuerpo}<Avisos /></>
}
