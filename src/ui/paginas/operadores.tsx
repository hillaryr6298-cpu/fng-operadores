import { useMemo, useState } from 'preact/hooks'
import { ETAPAS, normalizarNombre, puedeEditar, totalDias, type EtapaClave, type Estatus } from '../../../shared/dominio'
import { sesion } from '../../lib/auth'
import type { Op } from '../../lib/datos'
import { CLASE_ESTATUS, ETIQUETA_ESTATUS, ETIQUETA_MODALIDAD, etiquetaMes, hoyLocal, textoEtapa } from '../../lib/formato'
import { bases, cargando, errorCarga, operadores, perfiles } from '../../lib/store'
import { EditorEtapa } from '../componentes/editor-etapa'
import { Icono } from '../componentes/iconos'
import { operadorAbierto } from '../estado'

type Orden = { campo: 'nombre' | 'dias' | 'inicio'; dir: 1 | -1 }

export function Operadores() {
  const s = sesion.value!
  const [q, setQ] = useState('')
  const [mes, setMes] = useState('')
  const [base, setBase] = useState('')
  const [rec, setRec] = useState(s.rol === 'reclutador' ? s.id : '')
  const [est, setEst] = useState('activos')
  const [orden, setOrden] = useState<Orden>({ campo: 'nombre', dir: 1 })
  const [editor, setEditor] = useState<{ opId: string; clave: EtapaClave; ancla: DOMRect } | null>(null)
  const hoy = hoyLocal()

  const meses = useMemo(() => [...new Set(operadores.value.map((o) => o.fecha_inicio?.slice(0, 7)).filter(Boolean) as string[])].sort().reverse(), [operadores.value])

  const lista = useMemo(() => {
    const nq = normalizarNombre(q)
    const f = operadores.value.filter((o) =>
      (est === 'activos' ? o.estatus !== 'DESCARTADO' : est === 'todos' ? true : o.estatus === est) &&
      (!base || o.base === base) && (!rec || o.reclutador_id === rec) &&
      (!mes || (mes === 'sin' ? !o.fecha_inicio : o.fecha_inicio?.slice(0, 7) === mes)) &&
      (!nq || normalizarNombre(o.nombre).includes(nq)))
    const val = (o: Op) => orden.campo === 'nombre' ? o.nombre : orden.campo === 'dias' ? (totalDias(o.etapas, hoy) ?? -1) : (o.fecha_inicio ?? '')
    return f.sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * orden.dir })
  }, [operadores.value, q, mes, base, rec, est, orden])

  const ordenar = (campo: Orden['campo']) => setOrden((o) => ({ campo, dir: o.campo === campo ? (-o.dir as 1 | -1) : 1 }))
  const flecha = (campo: Orden['campo']) => (orden.campo === campo ? (orden.dir === 1 ? ' ↑' : ' ↓') : '')
  const hayFiltros = q || mes || base || (rec && s.rol !== 'reclutador') || est !== 'activos'
  const limpiar = () => { setQ(''); setMes(''); setBase(''); setRec(s.rol === 'reclutador' ? s.id : ''); setEst('activos') }

  const alTeclado = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement
    if (!t.dataset.r) return
    const r = Number(t.dataset.r), c = Number(t.dataset.c)
    const mover = { ArrowDown: [r + 1, c], ArrowUp: [r - 1, c], ArrowRight: [r, c + 1], ArrowLeft: [r, c - 1] }[e.key]
    if (!mover) return
    e.preventDefault()
    document.querySelector<HTMLElement>(`[data-r="${mover[0]}"][data-c="${mover[1]}"]`)?.focus()
  }

  const puede = s.rol !== 'consulta'
  return (
    <section>
      <div class="cabecera">
        <div><h1>Operadores</h1><p>{cargando.value ? 'Cargando…' : `${lista.length} de ${operadores.value.length} operadores`}</p></div>
        <div class="acciones">{puede && <button class="btn primario" type="button" onClick={() => (operadorAbierto.value = null)}><Icono n="mas" /> Nuevo operador</button>}</div>
      </div>

      <div class="barra-filtros" role="search">
        <div class="campo ancho"><label for="q">Buscar</label><input id="q" class="input" type="search" placeholder="Nombre del operador" value={q} onInput={(e) => setQ(e.currentTarget.value)} /></div>
        <div class="campo"><label for="m">Mes de inicio</label><select id="m" class="select" value={mes} onChange={(e) => setMes(e.currentTarget.value)}><option value="">Todos</option>{meses.map((m) => <option key={m} value={m}>{etiquetaMes(m)}</option>)}<option value="sin">Sin fecha</option></select></div>
        <div class="campo"><label for="b">Base</label><select id="b" class="select" value={base} onChange={(e) => setBase(e.currentTarget.value)}><option value="">Todas</option>{bases.value.map((b) => <option key={b.id} value={b.nombre}>{b.nombre}</option>)}</select></div>
        <div class="campo"><label for="r">Reclutador</label><select id="r" class="select" value={rec} onChange={(e) => setRec(e.currentTarget.value)}><option value="">Todos</option>{perfiles.value.filter((p) => p.rol === 'reclutador').map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
        <div class="campo"><label for="e">Estatus</label><select id="e" class="select" value={est} onChange={(e) => setEst(e.currentTarget.value)}><option value="activos">En proceso (todos)</option><option value="todos">Incluir descartados</option>{(Object.keys(ETIQUETA_ESTATUS) as Estatus[]).map((k) => <option key={k} value={k}>{ETIQUETA_ESTATUS[k]}</option>)}</select></div>
        {hayFiltros && <button class="btn fantasma" type="button" onClick={limpiar}>Limpiar filtros</button>}
      </div>

      {errorCarga.value && <div class="alerta bad" style="margin-bottom:12px" role="alert">{errorCarga.value}</div>}

      <div class="tabla-marco" onKeyDown={alTeclado}>
        <table class="tabla">
          <thead>
            <tr>
              <th class="fija" aria-sort={orden.campo === 'nombre' ? (orden.dir === 1 ? 'ascending' : 'descending') : 'none'}><button class="btn fantasma chico" style="padding:0;height:auto;font:inherit;text-transform:inherit;letter-spacing:inherit" type="button" onClick={() => ordenar('nombre')}>Operador{flecha('nombre')}</button></th>
              <th scope="col">Base</th><th scope="col">Reclutador</th><th scope="col">Modalidad</th><th scope="col">Estatus</th>
              {ETAPAS.map((e) => <th scope="col" key={e.clave}>{e.nombre}</th>)}
              <th scope="col" aria-sort={orden.campo === 'dias' ? (orden.dir === 1 ? 'ascending' : 'descending') : 'none'}><button class="btn fantasma chico" style="padding:0;height:auto;font:inherit;text-transform:inherit;letter-spacing:inherit" type="button" onClick={() => ordenar('dias')}>Días{flecha('dias')}</button></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((o, r) => {
              const editable = puedeEditar(s.rol, s.id, o.reclutador_id)
              const d = totalDias(o.etapas, hoy)
              return (
                <tr key={o.id}>
                  <td class="fija nom" title={o.nombre}><button type="button" class="enlace-nombre" onClick={() => (operadorAbierto.value = o.id)}>{o.nombre}</button></td>
                  <td>{o.base}</td><td>{o.reclutador_nombre}</td><td>{ETIQUETA_MODALIDAD[o.modalidad]}</td>
                  <td><span class={`etiqueta ${CLASE_ESTATUS[o.estatus]}`}>{ETIQUETA_ESTATUS[o.estatus]}</span></td>
                  {ETAPAS.map((e, c) => {
                    const v = o.etapas[e.clave]
                    const txt = textoEtapa(v)
                    return (
                      <td key={e.clave}>
                        <button type="button" data-r={r} data-c={c} disabled={!editable}
                          class={`celda-etapa ${editable ? 'editable' : ''} ${txt === '—' ? 'vacia' : v.res === 'NO_APTO' ? 'malo' : !v.fecha ? 'res' : ''} ${editor?.opId === o.id && editor.clave === e.clave ? 'activa' : ''}`}
                          aria-label={`${e.nombre} de ${o.nombre}: ${txt}`}
                          onClick={(ev) => setEditor({ opId: o.id, clave: e.clave, ancla: (ev.currentTarget as HTMLElement).getBoundingClientRect() })}>{txt}</button>
                      </td>
                    )
                  })}
                  <td class="mono" style={d !== null && d >= 30 && o.estatus !== 'CONTRATADO' ? 'color:var(--warn);font-weight:500' : ''}>{d ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!cargando.value && lista.length === 0 && (
          <div class="vacio">
            {operadores.value.length === 0
              ? <><b>Aún no hay operadores</b>{s.rol === 'admin' || s.rol === 'gerente_rh' ? 'Importe el Excel de seguimiento o cree el primero.' : 'RH aún no ha cargado operadores.'}</>
              : <><b>Ningún operador coincide</b>Pruebe con otros filtros. <button class="btn chico" type="button" onClick={limpiar}>Limpiar filtros</button></>}
          </div>
        )}
      </div>

      {editor && <EditorEtapa key={`${editor.opId}${editor.clave}`} {...editor} onCerrar={() => setEditor(null)} />}
    </section>
  )
}
