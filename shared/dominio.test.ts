import { describe, it, expect } from 'vitest'
import {
  ETAPAS, normalizarNombre, validarOperador, fechaInicio, totalDias,
  aDocumento, deDocumento, puedeEditar, etiquetaDeRol, type OperadorInput, type EtapaClave,
} from './dominio'

const HOY = new Date('2026-10-30T12:00:00Z')
const vacias = () =>
  Object.fromEntries(ETAPAS.map((e) => [e.clave, { fecha: null, res: null }])) as OperadorInput['etapas']
const base = (o: Partial<OperadorInput> = {}): OperadorInput => ({
  nombre: 'PEDRO PRUEBA ALVAREZ', base: 'SLP', reclutador_id: 'u1',
  modalidad: 'SENCILLO', estatus: 'LABORATORIOS', etapas: vacias(), ...o,
})
const con = (cambios: Partial<Record<EtapaClave, { fecha: string | null; res: any }>>) => {
  const e = vacias()
  for (const [k, v] of Object.entries(cambios)) (e as any)[k] = v
  return e
}

describe('normalizarNombre', () => {
  it('quita acentos, espacios dobles y pasa a mayúsculas', () => {
    expect(normalizarNombre('  José  Peña ')).toBe('JOSE PENA')
  })
  it('recorta espacios finales como en el Excel', () => {
    expect(normalizarNombre('MARIO PRUEBA GARCIA ')).toBe('MARIO PRUEBA GARCIA')
  })
})

describe('validarOperador', () => {
  it('acepta un operador válido', () => {
    expect(validarOperador(base(), HOY)).toEqual([])
  })
  it('rechaza nombre vacío', () => {
    expect(validarOperador(base({ nombre: '  ' }), HOY).map((e) => e.campo)).toContain('nombre')
  })
  it('rechaza fechas fuera de orden cronológico', () => {
    const e = con({
      solicitud_examen_cryo: { fecha: '2026-10-20', res: 'FECHA' },
      envio_laboratorios: { fecha: '2026-10-10', res: 'FECHA' },
    })
    expect(validarOperador(base({ etapas: e }), HOY).map((x) => x.campo)).toContain('envio_laboratorios')
  })
  it('permite prueba de manejo antes de la solicitud (caso real del Excel)', () => {
    const e = con({
      solicitud_examen_cryo: { fecha: '2026-10-24', res: 'FECHA' },
      prueba_manejo: { fecha: '2026-10-23', res: 'FECHA' },
    })
    expect(validarOperador(base({ etapas: e }), HOY)).toEqual([])
  })
  it('permite revaloración después de la solicitud y antes del resultado', () => {
    const e = con({
      solicitud_examen_cryo: { fecha: '2026-10-20', res: 'FECHA' },
      revaloracion: { fecha: '2026-10-28', res: 'FECHA' },
      resultado_premedicos_cryo: { fecha: '2026-10-28', res: 'FECHA' },
    })
    expect(validarOperador(base({ etapas: e }), HOY)).toEqual([])
  })
  it('rechaza fechas más de 30 días en el futuro', () => {
    const e = con({ quimica_sanguinea: { fecha: '2026-12-15', res: 'FECHA' } })
    expect(validarOperador(base({ etapas: e }), HOY).map((x) => x.campo)).toContain('quimica_sanguinea')
  })
  it('acepta una fecha futura de pocos días (Excel: 2026-11-02)', () => {
    const e = con({ revision_medica_interna: { fecha: '2026-11-02', res: 'FECHA' } })
    expect(validarOperador(base({ etapas: e }), HOY)).toEqual([])
  })
  it('acepta OK sin fecha', () => {
    const e = con({ prueba_manejo: { fecha: null, res: 'OK' } })
    expect(validarOperador(base({ etapas: e }), HOY)).toEqual([])
  })
  it('rechaza FECHA sin fecha', () => {
    const e = con({ prueba_manejo: { fecha: null, res: 'FECHA' } })
    expect(validarOperador(base({ etapas: e }), HOY).map((x) => x.campo)).toContain('prueba_manejo')
  })
  it('rechaza formato de fecha inválido', () => {
    const e = con({ prueba_manejo: { fecha: '31/10/2026', res: 'FECHA' } })
    expect(validarOperador(base({ etapas: e }), HOY).map((x) => x.campo)).toContain('prueba_manejo')
  })
  it('CONTRATADO exige dictamen OK', () => {
    expect(validarOperador(base({ estatus: 'CONTRATADO' }), HOY).map((x) => x.campo)).toContain('estatus')
    const e = con({ dictamen_cryo: { fecha: '2026-10-29', res: 'OK' } })
    expect(validarOperador(base({ estatus: 'CONTRATADO', etapas: e }), HOY)).toEqual([])
  })
  it('DESCARTADO exige motivo', () => {
    expect(validarOperador(base({ estatus: 'DESCARTADO' }), HOY).map((x) => x.campo)).toContain('motivo_descarte')
    expect(validarOperador(base({ estatus: 'DESCARTADO', motivo_descarte: 'NO APTO PRUEBA DE MANEJO' }), HOY)).toEqual([])
  })
  it('rechaza catálogos desconocidos', () => {
    const campos = validarOperador(base({ modalidad: 'X' as any, estatus: 'Y' as any }), HOY).map((x) => x.campo)
    expect(campos).toEqual(expect.arrayContaining(['modalidad', 'estatus']))
  })
})

describe('fechaInicio / totalDias', () => {
  it('fecha de inicio es la mínima registrada', () => {
    const e = con({
      quimica_sanguinea: { fecha: '2026-10-15', res: 'FECHA' },
      revision_medica_interna: { fecha: '2026-10-12', res: 'FECHA' },
    })
    expect(fechaInicio(e)).toBe('2026-10-12')
  })
  it('sin fechas devuelve null', () => {
    expect(fechaInicio(vacias())).toBeNull()
    expect(totalDias(vacias(), HOY)).toBeNull()
  })
  it('con contratación cuenta hasta esa fecha', () => {
    const e = con({
      quimica_sanguinea: { fecha: '2026-10-01', res: 'FECHA' },
      contratacion: { fecha: '2026-10-11', res: 'FECHA' },
    })
    expect(totalDias(e, HOY)).toBe(10)
  })
  it('sin contratación cuenta hasta hoy', () => {
    const e = con({ quimica_sanguinea: { fecha: '2026-10-20', res: 'FECHA' } })
    expect(totalDias(e, HOY)).toBe(10)
  })
})

describe('documento', () => {
  it('ida y vuelta idéntica', () => {
    const o = base({
      observaciones: 'x',
      etapas: con({ prueba_manejo: { fecha: '2026-10-12', res: 'FECHA' }, quimica_sanguinea: { fecha: null, res: 'NA_LOCAL' } }),
    })
    const d = aDocumento(o)
    expect(d.prueba_manejo_fecha).toBe('2026-10-12')
    expect(d.quimica_sanguinea_res).toBe('NA_LOCAL')
    expect(deDocumento(d)).toEqual({ ...o, motivo_descarte: undefined })
  })
})

describe('puedeEditar', () => {
  it('admin y gerente siempre', () => {
    expect(puedeEditar('admin', 'a', 'b')).toBe(true)
    expect(puedeEditar('gerente_rh', 'a', 'b')).toBe(true)
  })
  it('reclutador solo lo suyo', () => {
    expect(puedeEditar('reclutador', 'a', 'a')).toBe(true)
    expect(puedeEditar('reclutador', 'a', 'b')).toBe(false)
  })
  it('consulta nunca', () => {
    expect(puedeEditar('consulta', 'a', 'a')).toBe(false)
  })
})

describe('etiquetaDeRol', () => {
  it('quita el guion bajo porque Appwrite solo admite etiquetas alfanuméricas', () => {
    expect(etiquetaDeRol('gerente_rh')).toBe('gerenterh')
    expect(etiquetaDeRol('admin')).toBe('admin')
  })
})
