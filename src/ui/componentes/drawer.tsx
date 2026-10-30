import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { Icono } from './iconos'

const FOCALIZABLES = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Mantiene el foco del teclado dentro del contenedor mientras esté abierto (Tab / Shift+Tab). */
function atraparFoco(e: KeyboardEvent, contenedor: HTMLElement | null) {
  if (e.key !== 'Tab' || !contenedor) return
  const f = [...contenedor.querySelectorAll<HTMLElement>(FOCALIZABLES)].filter((x) => x.offsetParent !== null)
  if (!f.length) return
  const primero = f[0], ultimo = f[f.length - 1]
  if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus() }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus() }
  else if (!contenedor.contains(document.activeElement)) { e.preventDefault(); primero.focus() }
}

/** Panel lateral. Esc cierra; el foco entra al abrir y vuelve al elemento previo al cerrar. */
export function Drawer({ titulo, subtitulo, onCerrar, children, pie }: {
  titulo: string; subtitulo?: ComponentChildren; onCerrar: () => void; children: ComponentChildren; pie?: ComponentChildren
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not([data-cerrar])')?.focus()
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); else atraparFoco(e, ref.current) }
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('keydown', tecla); previo?.focus?.() }
  }, [])
  return (
    <>
      <div class="velo" onClick={onCerrar} />
      <div class="drawer" role="dialog" aria-modal="true" aria-label={titulo} ref={ref as any}>
        <header class="drawer-cab">
          <div><h2 style="font:500 18px var(--serif)">{titulo}</h2>{subtitulo && <div class="dim" style="margin-top:4px">{subtitulo}</div>}</div>
          <button class="btn chico fantasma" type="button" data-cerrar onClick={onCerrar} aria-label="Cerrar"><Icono n="cerrar" /></button>
        </header>
        <div class="drawer-cuerpo">{children}</div>
        {pie && <footer class="drawer-pie">{pie}</footer>}
      </div>
    </>
  )
}

export function Modal({ titulo, children, onCerrar, acciones }: {
  titulo: string; children: ComponentChildren; onCerrar: () => void; acciones: ComponentChildren
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus()
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); else atraparFoco(e, ref.current) }
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('keydown', tecla); previo?.focus?.() }
  }, [])
  return (
    <>
      <div class="velo" style="z-index:70" onClick={onCerrar} />
      <div class="modal" style="z-index:71" role="dialog" aria-modal="true" aria-label={titulo} ref={ref}>
        <h2>{titulo}</h2>
        {children}
        <div class="acciones">{acciones}</div>
      </div>
    </>
  )
}
