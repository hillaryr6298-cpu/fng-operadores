import { useEffect, useState } from 'preact/hooks'
import { Query, tdb } from '../../lib/appwrite'
import { diffAuditoria } from '../../lib/auditoria'
import { DB_ID } from '../../lib/config'
import { operadores, perfiles } from '../../lib/store'

type Fila = { $id: string; ts: string; usuario_id: string; usuario_nombre: string; entidad: string; registro_id: string; accion: string; antes: string | null; despues: string | null }
const LOTE = 50
const ACCIONES: Record<string, string> = {
  crear: 'Alta', actualizar: 'Modificación', descartar: 'Descarte', contratar: 'Contratación', importar: 'Importación', cambiar_rol: 'Cambio de rol',
  desactivar: 'Desactivación', activar: 'Activación', reset_password: 'Restablecer contraseña', cambiar_password: 'Cambio de contraseña',
}
const ENTIDADES: Record<string, string> = { operadores: 'Operadores', perfiles: 'Usuarios', bases: 'Bases' }
const fmt = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' })

export function Auditoria() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [mas, setMas] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [entidad, setEntidad] = useState('')
  const [usuario, setUsuario] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)

  async function cargar(reiniciar: boolean) {
    setCargando(true); setError('')
    try {
      const q = [Query.orderDesc('ts'), Query.limit(LOTE)]
      if (entidad) q.push(Query.equal('entidad', [entidad]))
      if (usuario) q.push(Query.equal('usuario_id', [usuario]))
      if (desde) q.push(Query.greaterThanEqual('ts', new Date(desde + 'T00:00:00').toISOString()))
      if (hasta) q.push(Query.lessThanEqual('ts', new Date(hasta + 'T23:59:59.999').toISOString()))
      if (!reiniciar && filas.length) q.push(Query.cursorAfter(filas[filas.length - 1].$id))
      const r = await tdb.listRows({ databaseId: DB_ID, tableId: 'auditoria', queries: q })
      const nuevas = r.rows as unknown as Fila[]
      setFilas(reiniciar ? nuevas : [...filas, ...nuevas]); setMas(nuevas.length === LOTE)
    } catch { setError('No se pudo cargar la bitácora.') }
    setCargando(false)
  }
  useEffect(() => { void cargar(true) }, [entidad, usuario, desde, hasta])

  const nombreRegistro = (f: Fila) => f.entidad === 'operadores' ? operadores.value.find((o) => o.id === f.registro_id)?.nombre
    : f.entidad === 'perfiles' ? perfiles.value.find((p) => p.id === f.registro_id)?.nombre : f.registro_id

  return (
    <section>
      <div class="cabecera"><div><h1>Auditoría</h1><p>Bitácora inmutable: quién cambió qué y cuándo. Nadie puede editarla ni borrarla desde la aplicación.</p></div></div>
      <div class="barra-filtros">
        <div class="campo"><label for="ae">Entidad</label><select id="ae" class="select" value={entidad} onChange={(e) => setEntidad(e.currentTarget.value)}><option value="">Todas</option>{Object.entries(ENTIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div class="campo"><label for="au">Usuario</label><select id="au" class="select" value={usuario} onChange={(e) => setUsuario(e.currentTarget.value)}><option value="">Todos</option>{perfiles.value.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
        <div class="campo"><label for="ad">Desde</label><input id="ad" class="input mono" type="date" value={desde} onInput={(e) => setDesde(e.currentTarget.value)} /></div>
        <div class="campo"><label for="ah">Hasta</label><input id="ah" class="input mono" type="date" value={hasta} onInput={(e) => setHasta(e.currentTarget.value)} /></div>
        {(entidad || usuario || desde || hasta) && <button class="btn fantasma" type="button" onClick={() => { setEntidad(''); setUsuario(''); setDesde(''); setHasta('') }}>Limpiar filtros</button>}
      </div>
      {error && <div class="alerta bad" role="alert" style="margin-bottom:12px">{error}</div>}
      <div class="tabla-marco">
        <table class="tabla">
          <thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Entidad</th><th>Acción</th><th>Registro</th><th /></tr></thead>
          <tbody>{filas.flatMap((f) => {
            const d = abierta === f.$id ? diffAuditoria(f.antes, f.despues, (id) => perfiles.value.find((p) => p.id === id)?.nombre ?? id) : []
            return [
              <tr key={f.$id}>
                <td class="mono" style="font-size:12.5px">{fmt(f.ts)}</td><td>{f.usuario_nombre}</td><td>{ENTIDADES[f.entidad] ?? f.entidad}</td>
                <td><span class="etiqueta acento">{ACCIONES[f.accion] ?? f.accion}</span></td><td style="max-width:260px;overflow:hidden;text-overflow:ellipsis">{nombreRegistro(f)}</td>
                <td style="text-align:right"><button class="btn chico fantasma" type="button" aria-expanded={abierta === f.$id} onClick={() => setAbierta(abierta === f.$id ? null : f.$id)}>{abierta === f.$id ? 'Ocultar' : 'Detalle'}</button></td>
              </tr>,
              abierta === f.$id && (
                <tr key={`${f.$id}-d`}><td colSpan={6} style="height:auto;padding:12px 16px;background:var(--surface-2);white-space:normal">
                  {d.length === 0 ? <span class="dim">Sin cambios de campos para mostrar.</span> : (
                    <table style="border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;padding:2px 24px 2px 0" class="dim">Campo</th><th style="text-align:left;padding:2px 24px 2px 0" class="dim">Antes</th><th style="text-align:left;padding:2px 0" class="dim">Después</th></tr></thead>
                      <tbody>{d.map((c) => <tr key={c.campo}><td style="padding:2px 24px 2px 0;font-weight:500">{c.campo}</td><td class="mono" style="padding:2px 24px 2px 0;color:var(--bad)">{c.antes}</td><td class="mono" style="padding:2px 0;color:var(--ok)">{c.despues}</td></tr>)}</tbody></table>)}
                </td></tr>),
            ]
          })}</tbody>
        </table>
        {!cargando && filas.length === 0 && <div class="vacio"><b>Sin registros</b>No hay actividad con esos filtros.</div>}
      </div>
      <div style="display:flex;justify-content:center;margin-top:14px">{cargando ? <span class="dim">Cargando…</span> : mas && <button class="btn" type="button" onClick={() => cargar(false)}>Cargar más</button>}</div>
    </section>
  )
}
