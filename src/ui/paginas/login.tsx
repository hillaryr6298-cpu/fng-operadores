import { signal } from '@preact/signals'
import { useState } from 'preact/hooks'
import { ejecutar } from '../../lib/api'
import { cerrarSesion, iniciarSesion, sesion } from '../../lib/auth'

export const mensajeLogin = signal('')

export function Login() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: Event) {
    e.preventDefault()
    setError(''); mensajeLogin.value = ''; setEnviando(true)
    try { await iniciarSesion(email, pass) } catch (x: any) { setError(x.message); setPass('') } finally { setEnviando(false) }
  }

  return (
    <div class="login">
      <aside class="login-lado">
        <div class="marca"><b>FNG</b><span>Recursos Humanos</span></div>
        <blockquote>Cada operador, cada etapa, con trazabilidad completa.</blockquote>
        <small>Acceso restringido a personal autorizado.<br />Toda actividad queda registrada en la bitácora de auditoría.</small>
      </aside>
      <div class="login-form">
        <form onSubmit={enviar} autocomplete="on">
          <div><h1>Iniciar sesión</h1><p class="dim">Use su correo corporativo.</p></div>
          {mensajeLogin.value && <div class="alerta info" role="status">{mensajeLogin.value}</div>}
          {error && <div class="alerta bad" role="alert">{error}</div>}
          <div class="campo">
            <label for="email">Correo electrónico</label>
            <input id="email" class="input" type="email" autocomplete="username" required value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
          </div>
          <div class="campo">
            <label for="pass">Contraseña</label>
            <input id="pass" class="input" type="password" autocomplete="current-password" required value={pass} onInput={(e) => setPass(e.currentTarget.value)} />
          </div>
          <button class="btn primario" type="submit" disabled={enviando} style="height:38px">{enviando ? 'Verificando…' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  )
}

export function CambiarPassword() {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repite, setRepite] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: Event) {
    e.preventDefault()
    if (nueva !== repite) return setError('Las contraseñas nuevas no coinciden.')
    setError(''); setEnviando(true)
    const r = await ejecutar('password', { actual, nueva })
    setEnviando(false)
    if (!r.ok) return setError(r.errores[0]?.mensaje ?? r.mensaje)
    mensajeLogin.value = 'Contraseña actualizada. Inicie sesión con la nueva contraseña.'
    await cerrarSesion()
  }

  return (
    <div class="login">
      <aside class="login-lado">
        <div class="marca"><b>FNG</b><span>Recursos Humanos</span></div>
        <blockquote>Defina una contraseña personal antes de continuar.</blockquote>
        <small>Mínimo 12 caracteres. Al cambiarla se cerrarán sus otras sesiones.</small>
      </aside>
      <div class="login-form">
        <form onSubmit={enviar}>
          <div><h1>Cambiar contraseña</h1><p class="dim">{sesion.value?.nombre}, su contraseña temporal debe reemplazarse.</p></div>
          {error && <div class="alerta bad" role="alert">{error}</div>}
          <div class="campo"><label for="a">Contraseña actual</label><input id="a" class="input" type="password" autocomplete="current-password" required value={actual} onInput={(e) => setActual(e.currentTarget.value)} /></div>
          <div class="campo"><label for="n">Contraseña nueva</label><input id="n" class="input" type="password" autocomplete="new-password" minLength={12} required value={nueva} onInput={(e) => setNueva(e.currentTarget.value)} /><span class="ayuda">Al menos 12 caracteres.</span></div>
          <div class="campo"><label for="r">Repita la nueva</label><input id="r" class="input" type="password" autocomplete="new-password" required value={repite} onInput={(e) => setRepite(e.currentTarget.value)} /></div>
          <button class="btn primario" type="submit" disabled={enviando} style="height:38px">{enviando ? 'Guardando…' : 'Guardar y continuar'}</button>
          <button class="btn fantasma" type="button" onClick={() => cerrarSesion()}>Cancelar</button>
        </form>
      </div>
    </div>
  )
}
