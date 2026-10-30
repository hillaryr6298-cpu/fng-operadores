import { Account, Client, ExecutionMethod, Functions, Query, TablesDB } from 'appwrite'
import { ENDPOINT, PROJECT_ID } from './config'

export const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID)
export const account = new Account(client)
export const tdb = new TablesDB(client)
export const functions = new Functions(client)
export { ExecutionMethod, Query }
