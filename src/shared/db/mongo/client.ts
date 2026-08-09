import { MongoClient } from 'mongodb'

if (!process.env.MONGODB_URI) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
}

const uri = process.env.MONGODB_URI
const options = { appName: 'sos-jaragua.auditoria' }

let client: MongoClient

if (process.env.NODE_ENV === 'development') {
    // Em desenvolvimento, usa uma variável global para preservar a conexão
    // entre reloads de módulo causados pelo HMR (Hot Module Replacement).
    let globalWithMongo = global as typeof globalThis & {
        _mongoClient?: MongoClient
    }

    if (!globalWithMongo._mongoClient) {
        globalWithMongo._mongoClient = new MongoClient(uri, options)
    }
    client = globalWithMongo._mongoClient
} else {
    client = new MongoClient(uri, options)
}

/**
 * Cliente Mongo escopado exclusivamente para o log de auditoria imutável
 * (BR-AUD-01). Não é uma fonte de dados de negócio — ver DESIGN.md §13 e
 * DB_SCHEMA.md §9.
 */
export default client
