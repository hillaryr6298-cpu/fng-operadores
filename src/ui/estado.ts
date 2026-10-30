import { signal } from '@preact/signals'

/** Operador abierto en el panel lateral. undefined = cerrado; null = alta de uno nuevo. */
export const operadorAbierto = signal<string | null | undefined>(undefined)
export const abrirOperador = (id: string | null) => (operadorAbierto.value = id)
