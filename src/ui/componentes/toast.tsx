import { signal } from '@preact/signals'

type Aviso = { id: number; tipo: 'ok' | 'bad' | ''; texto: string }
const avisos = signal<Aviso[]>([])
let n = 0

export function avisar(tipo: Aviso['tipo'], texto: string, ms = 4500) {
  const id = ++n
  avisos.value = [...avisos.value, { id, tipo, texto }]
  setTimeout(() => (avisos.value = avisos.value.filter((a) => a.id !== id)), ms)
}

export function Avisos() {
  return (
    <div class="avisos" role="status" aria-live="polite">
      {avisos.value.map((a) => (
        <div key={a.id} class={`aviso ${a.tipo}`}>{a.texto}</div>
      ))}
    </div>
  )
}
