import { Client, TablesDB, Users, Functions } from 'node-appwrite'

export const ENDPOINT = process.env.APPWRITE_ENDPOINT ?? 'https://sfo.cloud.appwrite.io/v1'
export const PROJECT = process.env.APPWRITE_PROJECT ?? '6ae50287002f8a4e87ba'
export const DB = 'fng'

export function cliente() {
  const key = process.env.APPWRITE_API_KEY
  if (!key) throw new Error('Falta la variable de entorno APPWRITE_API_KEY')
  const c = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(key)
  return { c, tdb: new TablesDB(c), users: new Users(c), fn: new Functions(c) }
}
