import { signal } from '@preact/signals'
import type { ComponentChildren } from 'preact'
import { ETIQUETA_ROL, cerrarSesion, sesion } from '../lib/auth'
import { Icono } from './componentes/iconos'
import { OperadorForm } from './componentes/operador-form'
import { operadorAbierto } from './estado'
import { RUTAS, type Ruta } from './rutas'

export const abierto = signal(false)

export function Layout({ ruta, children }: { ruta: Ruta; children: ComponentChildren }) {
  const s = sesion.value!
  const visibles = RUTAS.filter((r) => r.roles.includes(s.rol))
  const grupos = [...new Set(visibles.map((r) => r.grupo))]
  return (
    <div class="shell">
      <nav class={`nav ${abierto.value ? 'abierto' : ''}`} aria-label="Principal">
        <div class="marca"><b>FNG</b><span>Seguimiento de operadores</span></div>
        {grupos.map((g) => (
          <div key={g}>
            <div class="nav-grupo">{g}</div>
            {visibles.filter((r) => r.grupo === g).map((r) => (
              <a key={r.ruta} href={`#/${r.ruta}`} aria-current={r.ruta === ruta.ruta ? 'page' : undefined} onClick={() => (abierto.value = false)}>
                <Icono n={r.icono} />{r.titulo}
              </a>
            ))}
          </div>
        ))}
        <div class="nav-pie">
          <div class="quien">{s.nombre}</div>
          <div class="rol">{ETIQUETA_ROL[s.rol]}</div>
          <button class="btn-nav" type="button" onClick={() => cerrarSesion()}>Cerrar sesión</button>
        </div>
      </nav>
      {abierto.value && <div class="velo" onClick={() => (abierto.value = false)} />}
      <main class="contenido" id="contenido">
        <button class="btn menu-movil" type="button" onClick={() => (abierto.value = true)} aria-label="Abrir menú"><Icono n="menu" /> Menú</button>
        {children}
        {operadorAbierto.value !== undefined && <OperadorForm key={operadorAbierto.value ?? 'nuevo'} opId={operadorAbierto.value} onCerrar={() => (operadorAbierto.value = undefined)} />}
      </main>
    </div>
  )
}
