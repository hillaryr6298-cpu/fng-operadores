import { useState } from 'preact/hooks'
import { descargar } from '../../lib/descarga'
import { exportarLibro } from '../../lib/excel'
import { etiquetaMes, hoyISO, hoyLocal } from '../../lib/formato'
import { resumenPor, type FilaResumen } from '../../lib/metricas'
import { bases, cargando, operadores, perfiles } from '../../lib/store'
import { avisar } from '../componentes/toast'

function Tabla({ titulo, filas, vacio }: { titulo: string; filas: FilaResumen[]; vacio: string }) {
  return (
    <div class="tarjeta" style="margin-bottom:14px">
      <div class="tarjeta-cab"><h2>{titulo}</h2></div>
      {filas.length === 0 ? <div class="vacio" style="padding:28px">{vacio}</div> : (
        <table class="tabla">
          <thead><tr><th>{titulo.replace('Resumen por ', '')}</th><th style="text-align:right">En proceso</th><th style="text-align:right">Contratados</th><th style="text-align:right">Descartados</th><th style="text-align:right">Promedio de días</th></tr></thead>
          <tbody>{filas.map((f) => (
            <tr key={f.clave}><td style="font-weight:500">{f.clave}</td>
              <td class="mono" style="text-align:right">{f.enProceso}</td><td class="mono" style="text-align:right">{f.contratados}</td>
              <td class="mono" style="text-align:right">{f.descartados}</td><td class="mono" style="text-align:right">{f.promedioDias ?? '—'}</td></tr>))}</tbody>
        </table>)}
    </div>
  )
}

export function Reportes() {
  const [mes, setMes] = useState('')
  const [base, setBase] = useState('')
  const [rec, setRec] = useState('')
  const hoy = hoyLocal()
  const meses = [...new Set(operadores.value.map((o) => o.fecha_inicio?.slice(0, 7)).filter(Boolean) as string[])].sort().reverse()
  const lista = operadores.value.filter((o) => (!mes || o.fecha_inicio?.slice(0, 7) === mes) && (!base || o.base === base) && (!rec || o.reclutador_id === rec))

  const exportar = () => {
    if (!lista.length) return avisar('bad', 'No hay operadores con esos filtros.')
    descargar(exportarLibro(lista, hoy), `FNG-operadores-${hoyISO()}.xlsx`)
    avisar('ok', `Se exportaron ${lista.length} operadores.`)
  }

  return (
    <section>
      <div class="cabecera">
        <div><h1>Reportes</h1><p>{cargando.value ? 'Cargando…' : `${lista.length} operadores según los filtros.`}</p></div>
        <div class="acciones"><button class="btn primario" type="button" onClick={exportar} disabled={cargando.value}>Descargar Excel</button></div>
      </div>
      <div class="barra-filtros">
        <div class="campo"><label for="rm">Mes de inicio</label><select id="rm" class="select" value={mes} onChange={(e) => setMes(e.currentTarget.value)}><option value="">Todos</option>{meses.map((m) => <option key={m} value={m}>{etiquetaMes(m)}</option>)}</select></div>
        <div class="campo"><label for="rb">Base</label><select id="rb" class="select" value={base} onChange={(e) => setBase(e.currentTarget.value)}><option value="">Todas</option>{bases.value.map((b) => <option key={b.id} value={b.nombre}>{b.nombre}</option>)}</select></div>
        <div class="campo"><label for="rr">Reclutador</label><select id="rr" class="select" value={rec} onChange={(e) => setRec(e.currentTarget.value)}><option value="">Todos</option>{perfiles.value.filter((p) => p.rol === 'reclutador').map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
      </div>
      <Tabla titulo="Resumen por base" filas={resumenPor(lista, 'base', hoy)} vacio="Sin datos para los filtros elegidos." />
      <Tabla titulo="Resumen por reclutador" filas={resumenPor(lista, 'reclutador_nombre', hoy)} vacio="Sin datos para los filtros elegidos." />
      <p class="ayuda">El archivo incluye las hojas OPERADORES, DESCARTADOS y RESUMEN, con las mismas columnas que el Excel original.</p>
    </section>
  )
}
