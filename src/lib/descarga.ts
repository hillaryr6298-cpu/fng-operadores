/** Descarga un archivo generado en el navegador. */
export function descargar(contenido: ArrayBuffer, nombre: string, tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url; a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
