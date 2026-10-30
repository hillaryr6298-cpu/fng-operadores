import { useState } from 'preact/hooks'
import { ejecutar } from '../../lib/api'
import { bases, cargarTodo, operadores } from '../../lib/store'
import { avisar } from '../componentes/toast'

export function Bases() {
  const [nombre, setNombre] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  async function correr(cuerpo: Record<string, unknown>, ok?: string) {
    setOcupado(true); setError('')
    const r = await ejecutar('bases', cuerpo)
    setOcupado(false)
    if (!r.ok) return setError(r.errores[0]?.mensaje ?? r.mensaje)
    await cargarTodo(); if (ok) avisar('ok', ok)
  }

  return (
    <section>
      <div class="cabecera"><div><h1>Bases</h1><p>Catálogo de bases operativas. Desactivar una base la oculta de los formularios nuevos; los operadores existentes no cambian.</p></div></div>
      <div class="tarjeta" style="max-width:640px">
        <div class="tarjeta-cab"><h2>Agregar base</h2></div>
        <form class="tarjeta-cuerpo" style="display:flex;gap:8px;align-items:flex-start" onSubmit={(e) => { e.preventDefault(); void correr({ accion: 'crear', nombre }, 'Base creada.').then(() => setNombre('')) }}>
          <div class="campo" style="flex:1"><label class="sr-only" for="bn">Nombre de la base</label><input id="bn" class="input" placeholder="Nombre de la base" maxLength={60} value={nombre} onInput={(e) => setNombre(e.currentTarget.value)} />{error && <span class="error-campo" role="alert">{error}</span>}</div>
          <button class="btn primario" type="submit" disabled={ocupado || !nombre.trim()}>Agregar</button>
        </form>
      </div>
      <div class="tabla-marco" style="max-width:640px;margin-top:14px">
        <table class="tabla">
          <thead><tr><th>Base</th><th style="text-align:right">Operadores</th><th>Estado</th><th /></tr></thead>
          <tbody>{bases.value.map((b) => (
            <tr key={b.id}><td style="font-weight:500">{b.nombre}</td><td class="mono" style="text-align:right">{operadores.value.filter((o) => o.base === b.nombre).length}</td>
              <td><span class={`etiqueta ${b.activa ? 'ok' : ''}`}>{b.activa ? 'Activa' : 'Inactiva'}</span></td>
              <td style="text-align:right"><button class="btn chico" type="button" disabled={ocupado} onClick={() => correr({ accion: b.activa ? 'desactivar' : 'activar', id: b.id })}>{b.activa ? 'Desactivar' : 'Activar'}</button></td></tr>))}</tbody>
        </table>
      </div>
    </section>
  )
}
