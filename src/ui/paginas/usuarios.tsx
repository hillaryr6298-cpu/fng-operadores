import { useState } from 'preact/hooks'
import { ROLES, validarPassword, type Rol } from '../../../shared/dominio'
import { ejecutar } from '../../lib/api'
import { ETIQUETA_ROL, sesion } from '../../lib/auth'
import { generarPassword } from '../../lib/password'
import { cargarTodo, perfiles } from '../../lib/store'
import { Modal } from '../componentes/drawer'
import { avisar } from '../componentes/toast'

type Dialogo =
  | { tipo: 'crear' }
  | { tipo: 'entrega'; email: string; password: string; titulo: string }
  | { tipo: 'reset'; id: string; nombre: string }
  | { tipo: 'rol'; id: string; nombre: string; rol: Rol }
  | { tipo: 'email'; id: string; nombre: string }
  | { tipo: 'estado'; id: string; nombre: string; activar: boolean }

export function Usuarios() {
  const yo = sesion.value!
  const [dlg, setDlg] = useState<Dialogo | null>(null)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<Rol>('reclutador')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const lista = [...perfiles.value].sort((a, b) => a.nombre.localeCompare(b.nombre))

  const abrirCrear = () => { setNombre(''); setEmail(''); setRol('reclutador'); setPass(generarPassword()); setError(''); setDlg({ tipo: 'crear' }) }

  async function correr(cuerpo: Record<string, unknown>, ok: () => void) {
    setOcupado(true); setError('')
    const r = await ejecutar('usuarios', cuerpo)
    setOcupado(false)
    if (!r.ok) return setError(r.errores[0]?.mensaje ?? r.mensaje)
    await cargarTodo(); ok()
  }

  const crear = () => correr({ accion: 'crear', nombre, email, rol, passwordTemporal: pass },
    () => setDlg({ tipo: 'entrega', email: email.trim().toLowerCase(), password: pass, titulo: 'Usuario creado' }))
  const reset = (d: Extract<Dialogo, { tipo: 'reset' }>) => { const p = generarPassword(); void correr({ accion: 'reset', id: d.id, passwordTemporal: p }, () => setDlg({ tipo: 'entrega', email: perfiles.value.find((x) => x.id === d.id)?.email ?? '', password: p, titulo: 'Contraseña restablecida' })) }
  const copiar = async (t: string) => { try { await navigator.clipboard.writeText(t); avisar('ok', 'Copiado.') } catch { avisar('bad', 'No se pudo copiar; selecciónelo manualmente.') } }

  return (
    <section>
      <div class="cabecera"><div><h1>Usuarios</h1><p>{lista.length} cuentas. Solo el administrador puede crearlas; nadie se registra por su cuenta.</p></div>
        <div class="acciones"><button class="btn primario" type="button" onClick={abrirCrear}>Nuevo usuario</button></div></div>
      <div class="tabla-marco">
        <table class="tabla">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th /></tr></thead>
          <tbody>{lista.map((p) => {
            const propio = p.id === yo.id
            return (
              <tr key={p.id}>
                <td style="font-weight:500">{p.nombre}{propio && <span class="etiqueta" style="margin-left:8px">Usted</span>}</td>
                <td class="mono" style="font-size:12.5px">{p.email}</td>
                <td>{ETIQUETA_ROL[p.rol as Rol] ?? p.rol}</td>
                <td><span class={`etiqueta ${p.activo ? 'ok' : 'bad'}`}>{p.activo ? 'Activo' : 'Desactivado'}</span></td>
                <td style="text-align:right;white-space:nowrap">
                  {!propio && <button class="btn chico" type="button" onClick={() => { setError(''); setRol(p.rol as Rol); setDlg({ tipo: 'rol', id: p.id, nombre: p.nombre, rol: p.rol as Rol }) }}>Cambiar rol</button>}{' '}
                  <button class="btn chico" type="button" onClick={() => { setError(''); setEmail(p.email); setDlg({ tipo: 'email', id: p.id, nombre: p.nombre }) }}>Cambiar correo</button>{' '}
                  <button class="btn chico" type="button" onClick={() => { setError(''); setDlg({ tipo: 'reset', id: p.id, nombre: p.nombre }) }}>Restablecer contraseña</button>{' '}
                  {!propio && <button class={`btn chico ${p.activo ? 'peligro' : ''}`} type="button" onClick={() => { setError(''); setDlg({ tipo: 'estado', id: p.id, nombre: p.nombre, activar: !p.activo }) }}>{p.activo ? 'Desactivar' : 'Activar'}</button>}
                </td>
              </tr>)
          })}</tbody>
        </table>
      </div>

      {dlg?.tipo === 'crear' && (
        <Modal titulo="Nuevo usuario" onCerrar={() => setDlg(null)} acciones={<><button class="btn" type="button" onClick={() => setDlg(null)}>Cancelar</button><button class="btn primario" type="button" disabled={ocupado || !nombre.trim() || !email.trim() || !!validarPassword(pass)} onClick={crear}>{ocupado ? 'Creando…' : 'Crear usuario'}</button></>}>
          <div style="display:grid;gap:12px">
            {error && <div class="alerta bad" role="alert">{error}</div>}
            <div class="campo"><label for="un">Nombre</label><input id="un" class="input" value={nombre} maxLength={100} onInput={(e) => setNombre(e.currentTarget.value)} /><span class="ayuda">Para reclutadores, use el nombre tal como aparece en el Excel (p. ej. CARMEN).</span></div>
            <div class="campo"><label for="ue">Correo</label><input id="ue" class="input" type="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} /></div>
            <div class="campo"><label for="ur">Rol</label><select id="ur" class="select" value={rol} onChange={(e) => setRol(e.currentTarget.value as Rol)}>{ROLES.map((r) => <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>)}</select></div>
            <div class="campo"><label for="up">Contraseña temporal</label><div style="display:flex;gap:8px"><input id="up" class="input mono" value={pass} onInput={(e) => setPass(e.currentTarget.value)} /><button class="btn" type="button" onClick={() => setPass(generarPassword())}>Generar</button></div><span class="ayuda">Deberá cambiarla en su primer ingreso.</span></div>
          </div>
        </Modal>)}

      {dlg?.tipo === 'entrega' && (
        <Modal titulo={dlg.titulo} onCerrar={() => setDlg(null)} acciones={<button class="btn primario" type="button" onClick={() => setDlg(null)}>Listo</button>}>
          <p class="dim" style="margin-bottom:12px">Entregue estos datos al usuario por un canal seguro. La contraseña <b>no se volverá a mostrar</b> y deberá cambiarla al entrar.</p>
          <div class="tarjeta" style="padding:12px;display:grid;gap:8px">
            <div style="display:flex;justify-content:space-between;gap:8px"><span class="mono" style="font-size:13px">{dlg.email}</span><button class="btn chico" type="button" onClick={() => copiar(dlg.email)}>Copiar</button></div>
            <div style="display:flex;justify-content:space-between;gap:8px"><span class="mono" style="font-size:15px;font-weight:500">{dlg.password}</span><button class="btn chico" type="button" onClick={() => copiar(dlg.password)}>Copiar</button></div>
          </div>
        </Modal>)}

      {dlg?.tipo === 'reset' && (
        <Modal titulo="Restablecer contraseña" onCerrar={() => setDlg(null)} acciones={<><button class="btn" type="button" onClick={() => setDlg(null)}>Cancelar</button><button class="btn primario" type="button" disabled={ocupado} onClick={() => reset(dlg)}>Restablecer</button></>}>
          {error && <div class="alerta bad" role="alert" style="margin-bottom:10px">{error}</div>}
          <p class="dim">Se generará una contraseña temporal para <b>{dlg.nombre}</b> y se cerrarán todas sus sesiones.</p>
        </Modal>)}

      {dlg?.tipo === 'rol' && (
        <Modal titulo="Cambiar rol" onCerrar={() => setDlg(null)} acciones={<><button class="btn" type="button" onClick={() => setDlg(null)}>Cancelar</button><button class="btn primario" type="button" disabled={ocupado || rol === dlg.rol} onClick={() => correr({ accion: 'cambiar_rol', id: dlg.id, rol }, () => { setDlg(null); avisar('ok', 'Rol actualizado.') })}>Guardar</button></>}>
          {error && <div class="alerta bad" role="alert" style="margin-bottom:10px">{error}</div>}
          <div class="campo"><label for="cr">Rol de {dlg.nombre}</label><select id="cr" class="select" value={rol} onChange={(e) => setRol(e.currentTarget.value as Rol)}>{ROLES.map((r) => <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>)}</select></div>
        </Modal>)}

      {dlg?.tipo === 'email' && (
        <Modal titulo="Cambiar correo" onCerrar={() => setDlg(null)} acciones={<><button class="btn" type="button" onClick={() => setDlg(null)}>Cancelar</button><button class="btn primario" type="button" disabled={ocupado || !email.trim()} onClick={() => correr({ accion: 'cambiar_email', id: dlg.id, email }, () => { setDlg(null); avisar('ok', 'Correo actualizado.') })}>Guardar</button></>}>
          {error && <div class="alerta bad" role="alert" style="margin-bottom:10px">{error}</div>}
          <div class="campo"><label for="ce">Nuevo correo de {dlg.nombre}</label><input id="ce" class="input" type="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} /><span class="ayuda">Después restablezca su contraseña para entregarle un acceso nuevo.</span></div>
        </Modal>)}

      {dlg?.tipo === 'estado' && (
        <Modal titulo={dlg.activar ? 'Activar usuario' : 'Desactivar usuario'} onCerrar={() => setDlg(null)} acciones={<><button class="btn" type="button" onClick={() => setDlg(null)}>Cancelar</button><button class={`btn ${dlg.activar ? 'primario' : 'peligro'}`} type="button" disabled={ocupado} onClick={() => correr({ accion: dlg.activar ? 'activar' : 'desactivar', id: dlg.id }, () => { setDlg(null); avisar('ok', dlg.activar ? 'Usuario activado.' : 'Usuario desactivado.') })}>{dlg.activar ? 'Activar' : 'Desactivar'}</button></>}>
          {error && <div class="alerta bad" role="alert" style="margin-bottom:10px">{error}</div>}
          <p class="dim">{dlg.activar ? <>{dlg.nombre} podrá volver a iniciar sesión.</> : <>{dlg.nombre} perderá el acceso de inmediato y sus sesiones se cerrarán. Sus operadores no se modifican.</>}</p>
        </Modal>)}
    </section>
  )
}
