const EVENTOS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove']

/** Llama `alExpirar` tras `minutos` sin actividad del usuario. Devuelve la función para cancelar. */
export function iniciarTemporizadorInactividad(
  minutos: number,
  alExpirar: () => void,
  objetivo: EventTarget = globalThis as unknown as EventTarget,
): () => void {
  let id: ReturnType<typeof setTimeout>
  let ultimo = Date.now()
  const armar = () => {
    clearTimeout(id)
    id = setTimeout(alExpirar, minutos * 60_000)
  }
  const alActividad = () => {
    const ahora = Date.now()
    if (ahora - ultimo < 1000) return // evita reprogramar en cada movimiento del ratón
    ultimo = ahora
    armar()
  }
  EVENTOS.forEach((e) => objetivo.addEventListener(e, alActividad, { passive: true } as AddEventListenerOptions))
  armar()
  return () => {
    clearTimeout(id)
    EVENTOS.forEach((e) => objetivo.removeEventListener(e, alActividad))
  }
}
