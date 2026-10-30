const P: Record<string, string> = {
  panel: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  operadores: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21c0-4 3.6-6 8-6s8 2 8 6',
  tablero: 'M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v13h-4z',
  descartados: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5',
  reportes: 'M5 3h10l4 4v14H5zM14 3v5h5M8 13h8M8 17h5',
  importar: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  auditoria: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  usuarios: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M17 4.5a3.5 3.5 0 0 1 0 6.5M19 15c2 .6 3 2.2 3 5',
  bases: 'M12 21s7-6.3 7-11a7 7 0 0 0-14 0c0 4.7 7 11 7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  cerrar: 'M6 6l12 12M18 6L6 18',
  mas: 'M12 5v14M5 12h14',
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.5-4.5',
}

export function Icono({ n }: { n: keyof typeof P | string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={P[n] ?? ''} />
    </svg>
  )
}
