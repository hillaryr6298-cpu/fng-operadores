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

/** Servicio Users en memoria. */
export function crearFakeUsers() {
  const u = new Map()
  const llamadas = []
  let n = 0
  return {
    _u: u, llamadas,
    async create({ userId, email, password, name }) {
      const id = userId === 'unique()' || !userId ? `u${++n}` : userId
      if ([...u.values()].some((x) => x.email === email)) throw Object.assign(new Error('exists'), { code: 409 })
      u.set(id, { $id: id, email, password, name, labels: [], status: true, sesiones: 2 })
      return { $id: id, email, name }
    },
    async updateLabels({ userId, labels }) { u.get(userId).labels = labels },
    async updateStatus({ userId, status }) { u.get(userId).status = status },
    async updatePassword({ userId, password }) { u.get(userId).password = password },
    async deleteSessions({ userId }) { llamadas.push(['deleteSessions', userId]); u.get(userId).sesiones = 0 },
    async delete({ userId }) { u.delete(userId) },
  }
}
