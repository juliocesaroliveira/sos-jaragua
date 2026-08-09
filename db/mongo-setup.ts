/**
 * Cria a coleção `audit_logs` e seus índices (AUD-01, DB_SCHEMA.md §9).
 *
 * Executar com: `npm run mongo:setup`
 *
 * Idempotente: pode rodar quantas vezes for necessário. Roda fora do bundler do
 * Next, por isso não usa o alias `@/`.
 */
import { MongoClient } from 'mongodb'

const NOME_COLECAO = 'audit_logs'

async function main() {
    const uri = process.env.MONGODB_URI
    if (!uri) throw new Error('MONGODB_URI ausente no ambiente.')

    const client = new MongoClient(uri, { appName: 'sos-jaragua.setup' })

    try {
        await client.connect()
        const db = client.db()

        const existentes = await db.listCollections({ name: NOME_COLECAO }).toArray()
        if (existentes.length === 0) {
            await db.createCollection(NOME_COLECAO)
            console.log(`✓ coleção ${NOME_COLECAO} criada`)
        } else {
            console.log(`· coleção ${NOME_COLECAO} já existia`)
        }

        const criados = await db.collection(NOME_COLECAO).createIndexes([
            { key: { entidade: 1, entidadeId: 1, timestamp: -1 }, name: 'entidade_entidadeId_timestamp' },
            { key: { userId: 1, timestamp: -1 }, name: 'userId_timestamp' },
            { key: { timestamp: -1 }, name: 'timestamp' }
        ])
        console.log(`✓ índices garantidos: ${criados.join(', ')}`)

        console.log(
            '\n⚠ AUD-02 — passo manual no MongoDB Atlas:\n' +
                '  o usuário usado pela aplicação deve ter grant de INSERT/FIND em\n' +
                `  ${NOME_COLECAO}, mas NÃO de update/delete. O RBAC do Postgres não\n` +
                '  tem jurisdição sobre o Mongo, e é isso que torna o log realmente\n' +
                '  não-apagável (BR-AUD-01, DB_SCHEMA.md §9).'
        )
    } finally {
        await client.close()
    }
}

await main()
