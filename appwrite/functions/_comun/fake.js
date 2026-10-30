// TablesDB en memoria para pruebas de las Functions. Solo implementa lo que usan.
export function crearFake(semilla = {}) {
  const tablas = {}
  for (const [t, filas] of Object.entries(semilla)) {
    tablas[t] = new Map(Object.entries(filas).map(([id, d]) => [id, { $id: id, ...d }]))
  }
  const tabla = (t) => (tablas[t] ??= new Map())
  const noExiste = () => Object.assign(new Error('not found'), { code: 404 })
  const cumple = (fila, q) => {
    const { method, attribute, values } = JSON.parse(q)
    if (method === 'equal') return values.includes(fila[attribute])
    return true
  }
  let n = 0
  return {
    _tablas: tablas,
    async getRow({ tableId, rowId }) {
      const f = tabla(tableId).get(rowId)
      if (!f) throw noExiste()
      return structuredClone(f)
    },
    async createRow({ tableId, rowId, data }) {
      const id = rowId === 'unique()' || !rowId ? `id${++n}` : rowId
      if (tabla(tableId).has(id)) throw Object.assign(new Error('exists'), { code: 409 })
      const fila = { $id: id, ...structuredClone(data) }
      tabla(tableId).set(id, fila)
      return structuredClone(fila)
    },
    async updateRow({ tableId, rowId, data }) {
      const f = tabla(tableId).get(rowId)
      if (!f) throw noExiste()
      Object.assign(f, structuredClone(data))
      return structuredClone(f)
    },
    async listRows({ tableId, queries = [] }) {
      const rows = [...tabla(tableId).values()].filter((f) => queries.every((q) => cumple(f, q)))
      return { total: rows.length, rows: structuredClone(rows) }
    },
  }
}
