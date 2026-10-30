import { useState } from 'preact/hooks'
import { ETAPAS } from '../../../shared/dominio'
import { ETIQUETA_ESTATUS, hoyLocal } from '../../lib/formato'
import { atrasados, conteoPorEstatus, conteoPorEtapa, enProceso, porReclutador, promedioDias } from '../../lib/metricas'
import { cargando, operadores } from '../../lib/store'
import { abrirOperador } from '../estado'

function Barras({ filas, max }: { filas: { etiqueta: string; n: number }[]; max: number }) {
  return (
    <div>
      {filas.map((f) => (
        <div class="barra-fila" key={f.etiqueta}>
          <span>{f.etiqueta}</span>
          <div class="barra" role="img" aria-label={`${f.etiqueta}: ${f.n}`}><i style={`width:${max ? (f.n / max) * 100 : 0}%`} /></div>
          <span class="mono" style="text-align:right">{f.n}</span>
        </div>
      ))}
    </div>
  )
}

export function Panel() {
  const [umbral, setUmbral] = useState(15)
  const hoy = hoyLocal()
  const ops = operadores.value
  const activos = ops.filter(enProceso)
  const porEtapa = conteoPorEtapa(ops)
  const filasEtapa = [{ etiqueta: 'Sin iniciar', n: porEtapa.sin_iniciar ?? 0 }, ...ETAPAS.map((e) => ({ etiqueta: e.nombre, n: porEtapa[e.clave] ?? 0 }))]
  const estatus = conteoPorEstatus(ops)
  const prom = promedioDias(ops, hoy)
  const atr = atrasados(ops, hoy, umbral)
  const recs = porReclutador(ops)

  if (cargando.value) return <section><div class="cabecera"><h1>Panel</h1></div><div class="tarjeta vacio">Cargando…</div></section>
  return (
    <section>
      <div class="cabecera"><div><h1>Panel</h1><p>Resumen del proceso de contratación al día de hoy.</p></div></div>

      <div class="kpis">
        <div class="tarjeta kpi"><div class="t">En proceso</div><div class="n">{activos.length}</div><div class="s">operadores activos</div></div>
        <div class="tarjeta kpi"><div class="t">Promedio de días</div><div class="n">{prom ?? '—'}</div><div class="s">desde su primera etapa</div></div>
        <div class="tarjeta kpi"><div class="t">Contratados</div><div class="n">{estatus.CONTRATADO ?? 0}</div><div class="s">en el periodo cargado</div></div>
        <div class="tarjeta kpi"><div class="t">Descartados</div><div class="n">{estatus.DESCARTADO ?? 0}</div><div class="s">no continúan</div></div>
      </div>

      <div class="rejilla-2">
        <div class="tarjeta">
          <div class="tarjeta-cab"><h2>Operadores por etapa actual</h2></div>
          <div class="tarjeta-cuerpo">
            {activos.length === 0 ? <div class="vacio">Sin operadores en proceso.</div> : <Barras filas={filasEtapa} max={Math.max(1, ...filasEtapa.map((f) => f.n))} />}
          </div>
        </div>
        <div class="tarjeta">
          <div class="tarjeta-cab">
            <h2>Sin avance</h2>
            <label class="dim" style="font-size:12px">Más de <select class="select" style="width:auto;height:28px;display:inline-block" value={umbral} onChange={(e) => setUmbral(Number(e.currentTarget.value))}>{[7, 15, 30].map((d) => <option key={d} value={d}>{d}</option>)}</select> días</label>
          </div>
          <div class="tarjeta-cuerpo" style="padding:6px 18px 14px">
            {atr.length === 0 ? <div class="vacio" style="padding:28px 0">Ningún operador supera {umbral} días sin avance.</div> :
              atr.slice(0, 8).map(({ op, dias }) => (
                <div key={op.id} style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)">
                  <button type="button" class="btn fantasma chico" style="padding:0;height:auto;text-align:left;font-weight:500" onClick={() => abrirOperador(op.id)}>{op.nombre}</button>
                  <span class="etiqueta warn mono">{dias} d</span>
                </div>))}
            {atr.length > 8 && <div class="dim" style="padding-top:10px">y {atr.length - 8} más en la tabla de operadores.</div>}
          </div>
        </div>
      </div>

      <div class="rejilla-2" style="margin-top:14px">
        <div class="tarjeta">
          <div class="tarjeta-cab"><h2>Por estatus</h2></div>
          <div class="tarjeta-cuerpo"><Barras filas={(Object.keys(ETIQUETA_ESTATUS) as (keyof typeof ETIQUETA_ESTATUS)[]).map((k) => ({ etiqueta: ETIQUETA_ESTATUS[k], n: estatus[k] ?? 0 }))} max={Math.max(1, ...Object.values(estatus))} /></div>
        </div>
        <div class="tarjeta">
          <div class="tarjeta-cab"><h2>Carga por reclutador</h2></div>
          <div class="tarjeta-cuerpo">{recs.length === 0 ? <div class="vacio" style="padding:28px 0">Sin datos.</div> : <Barras filas={recs.map((r) => ({ etiqueta: r.nombre, n: r.total }))} max={Math.max(1, ...recs.map((r) => r.total))} />}</div>
        </div>
      </div>
    </section>
  )
}
