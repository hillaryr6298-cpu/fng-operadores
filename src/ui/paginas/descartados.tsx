import { useState } from 'preact/hooks'
import { ESTATUS, normalizarNombre, type Estatus } from '../../../shared/dominio'
import { guardarOperador } from '../../lib/api'
import { sesion } from '../../lib/auth'
import { opAEntrada, type Op } from '../../lib/datos'
import { ETIQUETA_ESTATUS, ETIQUETA_MODALIDAD } from '../../lib/formato'
import { cargando, integrarOp, opDesdeDoc, operadores } from '../../lib/store'
import { Modal } from '../componentes/drawer'
import { avisar } from '../componentes/toast'
import { abrirOperador } from '../estado'

export function Descartados() {
  const s = sesion.value!
  const gerencia = s.rol === 'admin' || s.rol === 'gerente_rh'
  const [q, setQ] = useState('')
  const [restaurar, setRestaurar] = useState<Op | null>(null)
  const [destino, setDestino] = useState<Estatus>('PREMEDICO_INTERNO')
  const [guardando, setGuardando] = useState(false)
  const nq = normalizarNombre(q)
  const lista = operadores.value.filter((o) => o.estatus === 'DESCARTADO' && (!nq || normalizarNombre(o.nombre).includes(nq))).sort((a, b) => a.nombre.localeCompare(b.nombre))

  async function confirmar() {
    if (!restaurar) return
    setGuardando(true)
    const r = await guardarOperador('actualizar', { ...opAEntrada(restaurar), estatus: destino, motivo_descarte: undefined }, restaurar.id, restaurar.version)
    setGuardando(false)
    if (r.ok) { integrarOp(opDesdeDoc(r.doc)); avisar('ok', 'Operador restaurado.'); setRestaurar(null) }
    else { if (r.status === 409 && r.actual) integrarOp(opDesdeDoc(r.actual)); avisar('bad', r.errores[0]?.mensaje ?? r.mensaje); setRestaurar(null) }
  }

  return (
    <section>
      <div class="cabecera"><div><h1>Descartados</h1><p>{cargando.value ? 'Cargando…' : `${lista.length} operadores que no continuaron el proceso.`}</p></div></div>
      <div class="barra-filtros"><div class="campo ancho"><label for="dq">Buscar</label><input id="dq" class="input" type="search" placeholder="Nombre del operador" value={q} onInput={(e) => setQ(e.currentTarget.value)} /></div></div>
      <div class="tabla-marco">
        <table class="tabla">
          <thead><tr><th>Operador</th><th>Base</th><th>Reclutador</th><th>Modalidad</th><th>Motivo del descarte</th><th /></tr></thead>
          <tbody>
            {lista.map((o) => (
              <tr key={o.id}>
                <td class="nom" onClick={() => abrirOperador(o.id)}>{o.nombre}</td><td>{o.base}</td><td>{o.reclutador_nombre}</td><td>{ETIQUETA_MODALIDAD[o.modalidad]}</td>
                <td style="white-space:normal;min-width:240px;max-width:420px">{o.motivo_descarte || <span class="dim">Sin motivo registrado</span>}</td>
                <td style="text-align:right">{gerencia && <button class="btn chico" type="button" onClick={() => { setDestino('PREMEDICO_INTERNO'); setRestaurar(o) }}>Restaurar</button>}</td>
              </tr>))}
          </tbody>
        </table>
        {!cargando.value && lista.length === 0 && <div class="vacio"><b>Sin descartados</b>{q ? 'Ningún nombre coincide con la búsqueda.' : 'Todos los operadores siguen en proceso.'}</div>}
      </div>
      {restaurar && (
        <Modal titulo="Restaurar operador" onCerrar={() => setRestaurar(null)} acciones={<><button class="btn" type="button" onClick={() => setRestaurar(null)}>Cancelar</button><button class="btn primario" type="button" disabled={guardando} onClick={confirmar}>Restaurar</button></>}>
          <p class="dim" style="margin-bottom:12px">{restaurar.nombre} volverá al proceso. Elija el estatus con el que continúa.</p>
          <div class="campo"><label for="dst">Estatus</label><select id="dst" class="select" value={destino} onChange={(e) => setDestino(e.currentTarget.value as Estatus)}>{ESTATUS.filter((e) => e !== 'DESCARTADO' && e !== 'CONTRATADO').map((e) => <option key={e} value={e}>{ETIQUETA_ESTATUS[e]}</option>)}</select></div>
        </Modal>)}
    </section>
  )
}
