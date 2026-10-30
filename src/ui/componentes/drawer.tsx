import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { Icono } from './iconos'

/** Panel lateral. Esc cierra; el foco entra al abrir y vuelve al elemento previo al cerrar. */
export function Drawer({ titulo, subtitulo, onCerrar, children, pie }: {
  titulo: string; subtitulo?: ComponentChildren; onCerrar: () => void; children: ComponentChildren; pie?: ComponentChildren
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not([data-cerrar])')?.focus()
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
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
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [])
  return (
    <>
      <div class="velo" style="z-index:70" onClick={onCerrar} />
      <div class="modal" style="z-index:71" role="dialog" aria-modal="true" aria-label={titulo}>
        <h2>{titulo}</h2>
        {children}
        <div class="acciones">{acciones}</div>
      </div>
    </>
  )
}
