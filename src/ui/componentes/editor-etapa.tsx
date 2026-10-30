import { useEffect, useRef, useState } from 'preact/hooks'
import { validarOperador, type EtapaClave, type EtapaValor } from '../../../shared/dominio'
import { guardarOperador } from '../../lib/api'
import { opAEntrada } from '../../lib/datos'
import { hoyISO, hoyLocal, valorAlEnter } from '../../lib/formato'
import { integrarOp, opDesdeDoc, operadores } from '../../lib/store'
import { avisar } from './toast'
import { ETAPAS } from '../../../shared/dominio'

/** Editor emergente de una etapa: fecha o resultado, con atajos para guardar en un clic. */
export function EditorEtapa({ opId, clave, ancla, onCerrar }: { opId: string; clave: EtapaClave; ancla: DOMRect; onCerrar: () => void }) {
  const op = operadores.value.find((o) => o.id === opId)
  const [fecha, setFecha] = useState(op?.etapas[clave]?.fecha ?? '')
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const nombre = ETAPAS.find((e) => e.clave === clave)!.nombre

  useEffect(() => {
    ref.current?.querySelector<HTMLInputElement>('input')?.focus()
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onCerrar() }
    setTimeout(() => document.addEventListener('mousedown', fuera), 0)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  if (!op) return null

  async function guardar(valor: EtapaValor) {
    const actual = operadores.value.find((o) => o.id === opId)!
    const etapas = { ...actual.etapas, [clave]: valor }
    const entrada = { ...opAEntrada(actual), etapas }
    const errs = validarOperador(entrada, hoyLocal())
    if (errs.length) return setError(errs.map((e) => e.mensaje).join(' '))
    setError(''); setGuardando(true)
    const r = await guardarOperador('actualizar', entrada, actual.id, actual.version)
    setGuardando(false)
    if (r.ok) { integrarOp(opDesdeDoc(r.doc)); onCerrar(); return }
    if (r.status === 409 && r.actual) {
      integrarOp(opDesdeDoc(r.actual))
      setAviso('Alguien modificó este operador mientras editaba. Se cargó la versión más reciente; revise y guarde de nuevo.')
      return
    }
    setError(r.errores[0]?.mensaje ?? r.mensaje)
    if (r.status === 403) avisar('bad', r.mensaje)
  }

  const abajo = ancla.bottom + 250 > innerHeight
  const estilo = `left:${Math.min(ancla.left, innerWidth - 300)}px;${abajo ? `bottom:${innerHeight - ancla.top + 6}px` : `top:${ancla.bottom + 6}px`}`
  const tecla = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onCerrar()
    if (e.key === 'Enter') { e.preventDefault(); const v = valorAlEnter(fecha); if (v) void guardar(v) }
  }

  return (
    <div ref={ref} class="tarjeta" role="dialog" aria-label={`Editar ${nombre}`} style={`position:fixed;z-index:65;width:288px;padding:14px;box-shadow:var(--sombra);${estilo}`} onKeyDown={tecla}>
      <div style="font-weight:500">{nombre}</div>
      <div class="dim" style="font-size:12px;margin-bottom:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{op.nombre}</div>
      {aviso && <div class="alerta warn" style="margin-bottom:10px">{aviso}</div>}
      {error && <div class="alerta bad" style="margin-bottom:10px" role="alert">{error}</div>}
      <div class="campo"><label for="fe">Fecha</label><input id="fe" class="input mono" type="date" value={fecha} onInput={(e) => setFecha(e.currentTarget.value)} disabled={guardando} /></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0">
        <button class="btn chico" type="button" disabled={guardando} onClick={() => guardar({ fecha: hoyISO(), res: 'FECHA' })}>Hoy</button>
        <button class="btn chico" type="button" disabled={guardando} onClick={() => guardar({ fecha: null, res: 'NA_LOCAL' })}>N/A local</button>
        <button class="btn chico" type="button" disabled={guardando} onClick={() => guardar({ fecha: null, res: 'OP_VIAJE' })}>Op. viaje</button>
        <button class="btn chico" type="button" disabled={guardando} onClick={() => guardar({ fecha: null, res: 'OK' })}>OK</button>
        <button class="btn chico peligro" type="button" disabled={guardando} onClick={() => guardar({ fecha: null, res: 'NO_APTO' })}>No apto</button>
        <button class="btn chico fantasma" type="button" disabled={guardando} onClick={() => guardar({ fecha: null, res: null })}>Limpiar</button>
      </div>
      <div class="acciones" style="justify-content:flex-end">
        <button class="btn chico" type="button" onClick={onCerrar}>Cancelar</button>
        <button class="btn chico primario" type="button" disabled={guardando || !fecha} onClick={() => guardar({ fecha, res: 'FECHA' })}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  )
}
