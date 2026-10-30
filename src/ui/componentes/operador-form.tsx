import { useState } from 'preact/hooks'
import {
  ESTATUS, ETAPAS, MODALIDADES, puedeEditar, totalDias, validarOperador,
  type EtapaClave, type EtapaValor, type OperadorInput, type Resultado,
} from '../../../shared/dominio'
import { guardarOperador, type OperadorConId } from '../../lib/api'
import { opAEntrada } from '../../lib/datos'
import { ETIQUETA_ESTATUS, ETIQUETA_MODALIDAD, ETIQUETA_RESULTADO, hoyLocal } from '../../lib/formato'
import { sesion } from '../../lib/auth'
import { bases, integrarOp, opDesdeDoc, operadores, perfiles } from '../../lib/store'
import { Drawer, Modal } from './drawer'
import { avisar } from './toast'

const vacias = () => Object.fromEntries(ETAPAS.map((e) => [e.clave, { fecha: null, res: null }])) as OperadorInput['etapas']

function FilaEtapa({ clave, nombre, valor, desactivado, error, onChange }: {
  clave: EtapaClave; nombre: string; valor: EtapaValor; desactivado: boolean; error?: string; onChange: (v: EtapaValor) => void
}) {
  const sel = valor.res ?? (valor.fecha ? 'FECHA' : '')
  return (
    <div>
      <div class="etapa-fila">
        <label class="nombre" for={`f-${clave}`}>{nombre}</label>
        <input id={`f-${clave}`} class="input mono" type="date" disabled={desactivado} aria-invalid={error ? 'true' : undefined}
          value={valor.fecha ?? ''} onInput={(e) => { const f = e.currentTarget.value; onChange(f ? { fecha: f, res: 'FECHA' } : { fecha: null, res: null }) }} />
        <select class="select" disabled={desactivado} aria-label={`Resultado de ${nombre}`} value={sel}
          onChange={(e) => {
            const r = e.currentTarget.value as Resultado | ''
            if (!r) onChange({ fecha: null, res: null })
            else if (r === 'FECHA') onChange({ fecha: valor.fecha, res: valor.fecha ? 'FECHA' : null })
            else onChange({ fecha: null, res: r })
          }}>
          <option value="">—</option>
          {(Object.keys(ETIQUETA_RESULTADO) as Resultado[]).map((r) => <option key={r} value={r}>{ETIQUETA_RESULTADO[r]}</option>)}
        </select>
      </div>
      {error && <div class="error-campo" role="alert">{error}</div>}
    </div>
  )
}

export function OperadorForm({ opId, onCerrar }: { opId: string | null; onCerrar: () => void }) {
  const s = sesion.value!
  const existente = opId ? operadores.value.find((o) => o.id === opId) ?? null : null
  const [versionBase, setVersionBase] = useState(existente?.version ?? 0)
  const [form, setForm] = useState<OperadorInput>(() =>
    existente ? opAEntrada(existente) : {
      nombre: '', base: '', reclutador_id: s.rol === 'reclutador' ? s.id : '', modalidad: 'FULL', estatus: 'PREMEDICO_INTERNO', observaciones: '', etapas: vacias(),
    })
  const [tocado, setTocado] = useState(false)
  const [srv, setSrv] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [modal, setModal] = useState<'descartar' | 'contratar' | null>(null)
  const [motivo, setMotivo] = useState('')

  if (opId && !existente) return null
  const editable = !existente || puedeEditar(s.rol, s.id, existente.reclutador_id)
  const gerencia = s.rol === 'admin' || s.rol === 'gerente_rh'
  const errs = validarOperador(form, hoyLocal())
  const mostrar = tocado
  const err = (campo: string) => srv[campo] ?? (mostrar ? errs.find((e) => e.campo === campo)?.mensaje : undefined)
  const cambia = (p: Partial<OperadorInput>) => { setTocado(true); setSrv({}); setForm((f) => ({ ...f, ...p })) }

  const recs = perfiles.value.filter((p) => p.rol === 'reclutador' && (p.activo || p.id === form.reclutador_id))
  const bs = bases.value.filter((b) => b.activa || b.nombre === form.base)
  const dias = totalDias(form.etapas, hoyLocal())
  const cerrado = existente?.estatus === 'DESCARTADO' || existente?.estatus === 'CONTRATADO'

  async function procesar(r: Awaited<ReturnType<typeof guardarOperador>>, mensajeOk: string) {
    if (r.ok) { integrarOp(opDesdeDoc(r.doc as OperadorConId)); avisar('ok', mensajeOk); onCerrar(); return }
    if (r.status === 409 && r.actual) {
      integrarOp(opDesdeDoc(r.actual)); setVersionBase(r.actual.version)
      setAviso('Este operador fue modificado por otra persona. Sus cambios siguen aquí: revíselos y vuelva a guardar.')
      return
    }
    const m: Record<string, string> = {}
    for (const e of r.errores) if (e.campo) m[e.campo] = e.mensaje
    setSrv(m)
    setAviso(Object.keys(m).length ? '' : r.mensaje)
  }

  async function guardar() {
    setTocado(true)
    if (errs.length) return
    setGuardando(true); setAviso('')
    const r = existente
      ? await guardarOperador('actualizar', form, existente.id, versionBase)
      : await guardarOperador('crear', form)
    setGuardando(false)
    await procesar(r, existente ? 'Cambios guardados.' : 'Operador creado.')
  }

  async function accion(tipo: 'descartar' | 'contratar') {
    setGuardando(true); setAviso('')
    const r = await guardarOperador(tipo, tipo === 'descartar' ? { motivo_descarte: motivo } : undefined, existente!.id, versionBase)
    setGuardando(false)
    if (!r.ok && r.status !== 409) setModal(null)
    await procesar(r, tipo === 'descartar' ? 'Operador descartado.' : 'Operador marcado como contratado.')
    if (!r.ok) setModal(null)
  }

  const pie = (
    <>
      {existente && editable && !cerrado && (
        <div style="margin-right:auto;display:flex;gap:8px">
          <button class="btn peligro" type="button" onClick={() => { setMotivo(''); setModal('descartar') }}>Descartar…</button>
          <button class="btn" type="button" onClick={() => setModal('contratar')}>Marcar contratado</button>
        </div>
      )}
      <button class="btn" type="button" onClick={onCerrar}>{editable ? 'Cancelar' : 'Cerrar'}</button>
      {editable && <button class="btn primario" type="button" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : existente ? 'Guardar cambios' : 'Crear operador'}</button>}
    </>
  )

  return (
    <Drawer titulo={existente ? existente.nombre : 'Nuevo operador'} onCerrar={onCerrar} pie={pie}
      subtitulo={existente ? <><span class="etiqueta">{ETIQUETA_ESTATUS[existente.estatus]}</span>{dias !== null && <span class="mono" style="margin-left:8px">{dias} días</span>}</> : 'Alta de operador en proceso'}>
      {!editable && <div class="alerta info">Solo lectura: este operador está asignado a {existente?.reclutador_nombre}.</div>}
      {aviso && <div class="alerta warn" role="alert">{aviso}</div>}
      {existente?.estatus === 'DESCARTADO' && <div class="alerta bad"><b>Descartado.</b> {existente.motivo_descarte}{gerencia && <><br />Para restaurarlo, elija otro estatus y guarde.</>}</div>}

      <div class="campo"><label for="nom">Nombre completo</label>
        <input id="nom" class="input" value={form.nombre} disabled={!editable} maxLength={150} aria-invalid={err('nombre') ? 'true' : undefined} onInput={(e) => cambia({ nombre: e.currentTarget.value })} />
        {err('nombre') && <span class="error-campo" role="alert">{err('nombre')}</span>}</div>

      <div class="dos-col">
        <div class="campo"><label for="bas">Base</label>
          <select id="bas" class="select" value={form.base} disabled={!editable} aria-invalid={err('base') ? 'true' : undefined} onChange={(e) => cambia({ base: e.currentTarget.value })}>
            <option value="">Seleccione…</option>{bs.map((b) => <option key={b.id} value={b.nombre}>{b.nombre}</option>)}</select>
          {err('base') && <span class="error-campo">{err('base')}</span>}</div>
        <div class="campo"><label for="rec">Reclutador</label>
          <select id="rec" class="select" value={form.reclutador_id} disabled={!editable || (!gerencia && !!existente) || (s.rol === 'reclutador' && !existente)} aria-invalid={err('reclutador_id') ? 'true' : undefined} onChange={(e) => cambia({ reclutador_id: e.currentTarget.value })}>
            <option value="">Seleccione…</option>{recs.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
          {err('reclutador_id') && <span class="error-campo">{err('reclutador_id')}</span>}</div>
        <div class="campo"><label for="mod">Modalidad</label>
          <select id="mod" class="select" value={form.modalidad} disabled={!editable} onChange={(e) => cambia({ modalidad: e.currentTarget.value as any })}>
            {MODALIDADES.map((m) => <option key={m} value={m}>{ETIQUETA_MODALIDAD[m]}</option>)}</select></div>
        <div class="campo"><label for="est">Estatus</label>
          <select id="est" class="select" value={form.estatus} disabled={!editable} aria-invalid={err('estatus') ? 'true' : undefined} onChange={(e) => cambia({ estatus: e.currentTarget.value as any })}>
            {ESTATUS.map((e) => <option key={e} value={e} disabled={(e === 'DESCARTADO' || e === 'CONTRATADO') && existente?.estatus !== e}>{ETIQUETA_ESTATUS[e]}</option>)}</select>
          {err('estatus') && <span class="error-campo">{err('estatus')}</span>}</div>
      </div>

      <div class="campo"><span class="etq">Etapas del proceso</span>
        <div class="etapas-form">
          {ETAPAS.map((e) => <FilaEtapa key={e.clave} clave={e.clave} nombre={e.nombre} valor={form.etapas[e.clave]} desactivado={!editable} error={err(e.clave)}
            onChange={(v) => cambia({ etapas: { ...form.etapas, [e.clave]: v } })} />)}
        </div></div>

      <div class="campo"><label for="obs">Observaciones</label>
        <textarea id="obs" class="textarea" value={form.observaciones ?? ''} disabled={!editable} maxLength={2000} onInput={(e) => cambia({ observaciones: e.currentTarget.value })} /></div>

      {modal === 'descartar' && (
        <Modal titulo="Descartar operador" onCerrar={() => setModal(null)} acciones={<>
          <button class="btn" type="button" onClick={() => setModal(null)}>Cancelar</button>
          <button class="btn peligro" type="button" disabled={guardando || !motivo.trim()} onClick={() => accion('descartar')}>Descartar</button></>}>
          <p class="dim" style="margin-bottom:12px">El operador pasará a la lista de descartados. Podrá restaurarlo personal de RH gerencial.</p>
          <div class="campo"><label for="mot">Motivo (obligatorio)</label><textarea id="mot" class="textarea" value={motivo} maxLength={500} onInput={(e) => setMotivo(e.currentTarget.value)} /></div>
        </Modal>)}
      {modal === 'contratar' && (
        <Modal titulo="Marcar como contratado" onCerrar={() => setModal(null)} acciones={<>
          <button class="btn" type="button" onClick={() => setModal(null)}>Cancelar</button>
          <button class="btn primario" type="button" disabled={guardando} onClick={() => accion('contratar')}>Confirmar</button></>}>
          <p class="dim">Requiere que el dictamen Cryo esté en OK. Se registrará en la bitácora de auditoría.</p>
        </Modal>)}
    </Drawer>
  )
}
