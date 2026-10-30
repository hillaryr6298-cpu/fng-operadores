import type { ComponentType } from 'preact'
import type { Rol } from '../../shared/dominio'
import { Auditoria } from './paginas/auditoria'
import { Bases } from './paginas/bases'
import { Descartados } from './paginas/descartados'
import { Importar } from './paginas/importar'
import { Operadores } from './paginas/operadores'
import { Panel } from './paginas/panel'
import { Reportes } from './paginas/reportes'
import { Tablero } from './paginas/tablero'
import { Usuarios } from './paginas/usuarios'

const TODOS: Rol[] = ['admin', 'gerente_rh', 'reclutador', 'consulta']
const GERENCIA: Rol[] = ['admin', 'gerente_rh']

export type Ruta = { ruta: string; titulo: string; grupo: string; icono: string; roles: Rol[]; vista: ComponentType }

export const RUTAS: Ruta[] = [
  { ruta: 'panel', titulo: 'Panel', grupo: 'Seguimiento', icono: 'panel', roles: TODOS, vista: Panel },
  { ruta: 'operadores', titulo: 'Operadores', grupo: 'Seguimiento', icono: 'operadores', roles: TODOS, vista: Operadores },
  { ruta: 'tablero', titulo: 'Tablero', grupo: 'Seguimiento', icono: 'tablero', roles: TODOS, vista: Tablero },
  { ruta: 'descartados', titulo: 'Descartados', grupo: 'Seguimiento', icono: 'descartados', roles: TODOS, vista: Descartados },
  { ruta: 'reportes', titulo: 'Reportes', grupo: 'Información', icono: 'reportes', roles: TODOS, vista: Reportes },
  { ruta: 'importar', titulo: 'Importar Excel', grupo: 'Administración', icono: 'importar', roles: GERENCIA, vista: Importar },
  { ruta: 'auditoria', titulo: 'Auditoría', grupo: 'Administración', icono: 'auditoria', roles: GERENCIA, vista: Auditoria },
  { ruta: 'usuarios', titulo: 'Usuarios', grupo: 'Administración', icono: 'usuarios', roles: ['admin'], vista: Usuarios },
  { ruta: 'bases', titulo: 'Bases', grupo: 'Administración', icono: 'bases', roles: ['admin'], vista: Bases },
]
