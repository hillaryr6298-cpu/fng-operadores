import { describe, it, expect } from 'vitest'
import { diffAuditoria } from './auditoria'

const base = { nombre: 'A', base: 'SLP', observaciones: '', etapas: { quimica_sanguinea: { fecha: null, res: null }, prueba_manejo: { fecha: '2026-10-01', res: 'FECHA' } } }

describe('diffAuditoria', () => {
  it('lista solo los campos que cambiaron, con etiqueta legible', () => {
    const d = diffAuditoria(JSON.stringify(base), JSON.stringify({ ...base, observaciones: 'nota', base: 'TEX' }))
    expect(d).toEqual([
      { campo: 'Base', antes: 'SLP', despues: 'TEX' },
      { campo: 'Observaciones', antes: '', despues: 'nota' },
    ])
  })
  it('aplana las etapas', () => {
    const despues = { ...base, etapas: { ...base.etapas, quimica_sanguinea: { fecha: '2026-10-05', res: 'FECHA' } } }
    expect(diffAuditoria(JSON.stringify(base), JSON.stringify(despues))).toEqual([{ campo: 'Química sanguínea', antes: '—', despues: '05/10/26' }])
  })
  it('alta: antes null muestra todo como nuevo', () => {
    const d = diffAuditoria(null, JSON.stringify({ nombre: 'A', base: 'SLP' }))
    expect(d).toContainEqual({ campo: 'Nombre', antes: '—', despues: 'A' })
  })
  it('JSON inválido o vacío no rompe', () => {
    expect(diffAuditoria('{no es json', null)).toEqual([])
    expect(diffAuditoria(null, null)).toEqual([])
  })
})

describe('diffAuditoria — etiquetas legibles', () => {
  it('muestra el rol con su nombre, no el código', () => {
    const d = diffAuditoria(null, JSON.stringify({ nombre: 'Ana', rol: 'gerente_rh', activo: true, email: 'a@x.mx' }))
    expect(d).toContainEqual({ campo: 'Rol', antes: '—', despues: 'Gerente de RH' })
    expect(d).toContainEqual({ campo: 'Activo', antes: '—', despues: 'Sí' })
  })
  it('resuelve el reclutador por nombre cuando se le da un resolvedor', () => {
    const d = diffAuditoria(JSON.stringify({ reclutador_id: 'u1' }), JSON.stringify({ reclutador_id: 'u2' }), (id) => `NOMBRE-${id}`)
    expect(d).toEqual([{ campo: 'Reclutador', antes: 'NOMBRE-u1', despues: 'NOMBRE-u2' }])
  })
})
