import { ID } from 'node-appwrite'
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { cliente, DB } from './cliente.mjs'
const { tdb, users } = cliente()
const email = 'movil-prueba@fng-test.invalid', password = `Mv-${randomBytes(9).toString('hex')}-Zq`
const u = await users.create({ userId: ID.unique(), email, password, name: 'Prueba movil' })
await users.updateLabels({ userId: u.$id, labels: ['admin'] })
await tdb.createRow({ databaseId: DB, tableId: 'perfiles', rowId: u.$id, data: { nombre: 'Prueba móvil', rol: 'admin', activo: true, email, debe_cambiar: false } })
writeFileSync(process.argv[2], JSON.stringify({ id: u.$id, email, password }))
