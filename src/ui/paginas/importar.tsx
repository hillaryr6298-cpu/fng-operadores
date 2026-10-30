import { useState } from 'preact/hooks'
import type { OperadorInput } from '../../../shared/dominio'
import { ejecutar } from '../../lib/api'
import { leerLibro, parsearHojaOperadores } from '../../lib/excel'
import { hoyLocal } from '../../lib/formato'
import { cargarTodo, perfiles } from '../../lib/store'
import { avisar } from '../componentes/toast'

const MAX_BYTES = 5 * 1024 * 1024
type Hoja = { nombre: string; descartados: boolean; filas: OperadorInput[]; errores: { fila: number; mensaje: string }[]; incluir: boolean }

export function Importar() {
  const [hojas, setHojas] = useState<Hoja[]>([])
  const [archivo, setArchivo] = useState('')
  const [error, setError] = useState('')
  const [servidor, setServidor] = useState<{ hoja: string; fila: number; mensaje: string }[]>([])
  const [ocupado, setOcupado] = useState(false)

  const seleccion = hojas.filter((h) => h.incluir)
  const todasLasFilas = seleccion.flatMap((h) => h.filas)
  const erroresLocales = seleccion.flatMap((h) => h.errores.map((e) => ({ hoja: h.nombre, ...e })))
  const faltantes = [...new Set(erroresLocales.map((e) => /^Reclutador "(.+)" no existe/.exec(e.mensaje)?.[1]).filter(Boolean))]

  async function elegir(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0]
    setHojas([]); setServidor([]); setError('')
    if (!f) return
    if (!/\.xlsx$/i.test(f.name)) return setError('Solo se admiten archivos .xlsx.')
    if (f.size > MAX_BYTES) return setError('El archivo supera 5 MB.')
    try {
      const libro = leerLibro(await f.arrayBuffer())
      const recs = perfiles.value.filter((p) => p.rol === 'reclutador' && p.activo)
      const parsed: Hoja[] = libro
        .filter((h) => h.filas.length > 1)
        .map((h) => {
          const descartados = /descartad/i.test(h.nombre)
          return { nombre: h.nombre, descartados, ...parsearHojaOperadores(h.filas, recs, hoyLocal(), { descartados }), incluir: true }
        })
        .filter((h) => h.filas.length || h.errores.length)
      if (!parsed.length) return setError('No se encontraron hojas con operadores. Verifique que tengan la columna "NOMBRE OPERADOR".')
      setArchivo(f.name); setHojas(parsed)
    } catch {
      setError('No se pudo leer el archivo. ¿Está dañado o protegido con contraseña?')
    }
  }

  /** Un solo lote para todas las hojas: así se detectan duplicados entre hojas y la importación es todo o nada. */
  async function enviar(confirmar: boolean) {
    setOcupado(true); setServidor([])
    const rondas = seleccion.filter((h) => h.filas.length)
    const origen = rondas.flatMap((h) => h.filas.map((_, i) => ({ hoja: h.nombre, fila: i + 1 })))
    const r = await ejecutar<{ validas?: number; creadas?: number }>('importar', { filas: todasLasFilas, confirmar })
    setOcupado(false)
    const errs = r.ok ? ((r as any).errores ?? []) : r.errores
    if (errs.length || !r.ok) {
      setServidor(errs.length
        ? errs.map((e: any) => ({ hoja: origen[e.fila - 1]?.hoja ?? '', fila: origen[e.fila - 1]?.fila ?? 0, mensaje: e.mensaje }))
        : [{ hoja: '', fila: 0, mensaje: (r as any).mensaje }])
      return
    }
    if (!confirmar) return avisar('ok', 'Validación correcta. Puede importar.')
    avisar('ok', `Se importaron ${(r as any).creadas} operadores.`)
    setHojas([]); setArchivo('')
    await cargarTodo()
  }

  const hayErrores = erroresLocales.length > 0 || servidor.length > 0
  return (
    <section>
      <div class="cabecera"><div><h1>Importar Excel</h1><p>Cargue el archivo de seguimiento. Se valida todo antes de guardar: si algo falla, no se importa nada.</p></div></div>
      <div class="tarjeta"><div class="tarjeta-cuerpo" style="display:grid;gap:14px">
        <div class="campo" style="max-width:420px"><label for="xl">Archivo .xlsx (máx. 5 MB)</label><input id="xl" class="input" type="file" accept=".xlsx" onChange={elegir} style="height:auto;padding:6px" /></div>
        {error && <div class="alerta bad" role="alert">{error}</div>}
        {hojas.length > 0 && (
          <>
            <div><b>{archivo}</b><div class="dim">Marque las hojas que desea importar. Las hojas cuyo nombre contiene "descartados" se cargan como descartados.</div></div>
            {hojas.map((h, i) => (
              <label key={h.nombre} style="display:flex;gap:10px;align-items:center">
                <input type="checkbox" checked={h.incluir} onChange={(e) => { const c = hojas.slice(); c[i] = { ...h, incluir: e.currentTarget.checked }; setHojas(c); setServidor([]) }} />
                <span><b>{h.nombre}</b> — {h.filas.length} filas válidas{h.errores.length ? <>, <span style="color:var(--bad)">{h.errores.length} con errores</span></> : ''}{h.descartados && <span class="etiqueta bad" style="margin-left:8px">Descartados</span>}</span>
              </label>))}
            {faltantes.length > 0 && <div class="alerta warn">Antes de importar, cree estos reclutadores en <a href="#/usuarios">Usuarios</a> (el nombre debe coincidir): <b>{faltantes.join(', ')}</b>. Luego vuelva a cargar el archivo.</div>}
            {hayErrores && (
              <div class="tabla-marco" style="max-height:260px"><table class="tabla"><thead><tr><th>Hoja</th><th>Fila</th><th>Problema</th></tr></thead>
                <tbody>{[...erroresLocales, ...servidor].map((e, i) => <tr key={i}><td>{e.hoja}</td><td class="mono">{e.fila || '—'}</td><td style="white-space:normal">{e.mensaje}</td></tr>)}</tbody></table></div>)}
            {!hayErrores && todasLasFilas.length > 0 && (
              <div class="tabla-marco" style="max-height:300px"><table class="tabla"><thead><tr><th>Operador</th><th>Base</th><th>Reclutador</th><th>Modalidad</th><th>Estatus</th></tr></thead>
                <tbody>{todasLasFilas.slice(0, 50).map((f, i) => <tr key={i}><td style="font-weight:500">{f.nombre}</td><td>{f.base}</td><td>{perfiles.value.find((p) => p.id === f.reclutador_id)?.nombre}</td><td>{f.modalidad}</td><td>{f.estatus.replace(/_/g, ' ')}</td></tr>)}</tbody></table></div>)}
            <div class="acciones">
              <button class="btn" type="button" disabled={ocupado || !todasLasFilas.length} onClick={() => enviar(false)}>Validar con el servidor</button>
              <button class="btn primario" type="button" disabled={ocupado || !todasLasFilas.length || erroresLocales.length > 0} onClick={() => enviar(true)}>{ocupado ? 'Procesando…' : `Importar ${todasLasFilas.length} operadores`}</button>
            </div>
          </>)}
      </div></div>
    </section>
  )
}
