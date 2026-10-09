import { afterAll, describe, expect, it } from 'vitest'

/**
 * Recuperação do cliente Mongo depois de uma falha de conexão.
 *
 * O driver (6.x) fecha a topologia quando a **primeira** conexão falha e a
 * mantém no `MongoClient`: dali em diante toda operação responde "Topology is
 * closed", mesmo com o Mongo de volta, até o processo reiniciar. Com um
 * cliente compartilhado, uma queda momentânea na partida derrubava a
 * auditoria — leitura e escrita — para sempre naquela instância.
 *
 * Aponta para uma porta local fechada: a conexão é recusada na hora, sem rede
 * externa.
 */
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/teste?serverSelectionTimeoutMS=300'

const { clienteMongo } = await import('./client')

afterAll(async () => {
    await clienteMongo().close()
})

describe('clienteMongo', () => {
    it('devolve o mesmo cliente enquanto ele está saudável', () => {
        expect(clienteMongo()).toBe(clienteMongo())
    })

    it('depois de uma falha de conexão, a próxima operação tenta de novo em vez de "Topology is closed"', async () => {
        const primeiro = clienteMongo()
        const falha1 = await primeiro.db().command({ ping: 1 }).catch((erro: Error) => erro)
        expect(falha1).toBeInstanceOf(Error)
        expect((falha1 as Error).name).toBe('MongoServerSelectionError')

        const segundo = clienteMongo()
        expect(segundo).not.toBe(primeiro)

        const falha2 = await segundo.db().command({ ping: 1 }).catch((erro: Error) => erro)
        // Nova tentativa de conexão de verdade — não o cliente envenenado.
        expect((falha2 as Error).name).toBe('MongoServerSelectionError')
    })
})
