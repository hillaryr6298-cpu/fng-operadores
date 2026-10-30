import { useState } from 'preact/hooks'
import { puedeEditar, type Estatus } from '../../../shared/dominio'
import { guardarOperador } from '../../lib/api'
import { sesion } from '../../lib/auth'
import { opAEntrada, type Op } from '../../lib/datos'
import { ETIQUETA_ESTATUS, hoyLocal } from '../../lib/formato'
import { cargando, integrarOp, opDesdeDoc, operadores, perfiles, bases } from '../../lib/store'
import { totalDias } from '../../../shared/dominio'
import { avisar } from '../componentes/toast'
import { abrirOperador } from '../estado'

const COLUMNAS: Estatus[] = ['PREMEDICO_INTERNO', 'VALIDACION_CARTAS', 'PREMEDICO_CRYO', 'LABORATORIOS', 'DICTAMEN', 'CONTRATADO']

export function Tablero() {
  const s = sesion.value!
  const [rec, setRec] = useState(s.rol === 'reclutador' ? s.id : '')
  const [base, setBase] = useState('')
  const [sobre, setSobre] = useState<Estatus | null>(null)
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const hoy = hoyLocal()
  const lista = operadores.value.filter((o) => (!rec || o.reclutador_id === rec) && (!base || o.base === base))

  async function soltar(destino: Estatus) {
    setSobre(null)
    const op = operadores.value.find((o) => o.id === arrastrando)
    setArrastrando(null)
    if (!op || op.estatus === destino) return
    const r = destino === 'CONTRATADO'
      ? await guardarOperador('contratar', undefined, op.id, op.version)
      : await guardarOperador('actualizar', { ...opAEntrada(op), estatus: destino }, op.id, op.version)
    if (r.ok) { integrarOp(opDesdeDoc(r.doc)); avisar('ok', `${op.nombre}: ${ETIQUETA_ESTATUS[destino]}`) }
    else if (r.status === 409 && r.actual) { integrarOp(opDesdeDoc(r.actual)); avisar('bad', 'El operador cambió mientras lo movía. Intente de nuevo.') }
    else avisar('bad', r.errores[0]?.mensaje ?? r.mensaje)
  }

  const ficha = (o: Op) => {
    const editable = puedeEditar(s.rol, s.id, o.reclutador_id)
    const d = totalDias(o.etapas, hoy)
    return (
      <div key={o.id} class="ficha" draggable={editable} onDragStart={() => setArrastrando(o.id)} onDragEnd={() => { setArrastrando(null); setSobre(null) }} style={editable ? '' : 'cursor:default'}>
        <b role="button" tabIndex={0} onClick={() => abrirOperador(o.id)} onKeyDown={(e) => e.key === 'Enter' && abrirOperador(o.id)}>{o.nombre}</b>
        <div class="meta"><span>{o.base}</span><span>·</span><span>{o.reclutador_nombre}</span>{d !== null && <><span>·</span><span class="mono">{d} d</span></>}</div>
      </div>
    )
  }

  return (
    <section>
      <div class="cabecera"><div><h1>Tablero</h1><p>Arrastre una ficha para cambiar el estatus. {s.rol === 'consulta' ? 'Vista de solo lectura.' : ''}</p></div></div>
      <div class="barra-filtros">
        <div class="campo"><label for="tr">Reclutador</label><select id="tr" class="select" value={rec} onChange={(e) => setRec(e.currentTarget.value)}><option value="">Todos</option>{perfiles.value.filter((p) => p.rol === 'reclutador').map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
        <div class="campo"><label for="tb">Base</label><select id="tb" class="select" value={base} onChange={(e) => setBase(e.currentTarget.value)}><option value="">Todas</option>{bases.value.map((b) => <option key={b.id} value={b.nombre}>{b.nombre}</option>)}</select></div>
      </div>
      {cargando.value ? <div class="tarjeta vacio">Cargando…</div> : (
        <div class="tablero">
          {COLUMNAS.map((c) => {
            const items = lista.filter((o) => o.estatus === c).sort((a, b) => a.nombre.localeCompare(b.nombre))
            return (
              <div key={c} class={`columna ${sobre === c ? 'sobre' : ''}`} onDragOver={(e) => { if (arrastrando) { e.preventDefault(); setSobre(c) } }} onDragLeave={() => setSobre((x) => (x === c ? null : x))} onDrop={(e) => { e.preventDefault(); void soltar(c) }}>
                <h3><span>{ETIQUETA_ESTATUS[c]}</span><span class="mono">{items.length}</span></h3>
                {items.map(ficha)}
                {items.length === 0 && <div class="dim" style="font-size:12px;padding:8px 4px">Sin operadores</div>}
              </div>
            )
          })}
        </div>)}
    </section>
  )
}
