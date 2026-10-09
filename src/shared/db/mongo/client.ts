import { MongoClient } from 'mongodb'

if (!process.env.MONGODB_URI) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
}

const uri = process.env.MONGODB_URI
const options = { appName: 'sos-jaragua.auditoria' }

// Em desenvolvimento, uma variável global preserva a conexão entre reloads de
// módulo causados pelo HMR (Hot Module Replacement).
const globalComMongo = global as typeof globalThis & { _mongoClient?: MongoClient }
let clienteDoModulo: MongoClient | undefined

function guardado(): MongoClient | undefined {
    return process.env.NODE_ENV === 'development' ? globalComMongo._mongoClient : clienteDoModulo
}

function guardar(cliente: MongoClient | undefined): void {
    if (process.env.NODE_ENV === 'development') globalComMongo._mongoClient = cliente
    else clienteDoModulo = cliente
}

/**
 * O driver (6.x) **fecha a topologia quando a primeira conexão falha** e a
 * mantém no `MongoClient`: toda operação seguinte responde "Topology is
 * closed", mesmo depois de o Mongo voltar, até o processo reiniciar. Com um
 * cliente compartilhado, um Mongo fora do ar na partida derrubava a auditoria
 * — escrita e leitura da trilha — de vez naquela instância.
 *
 * Quando a topologia fecha, o cliente se descarta; o próximo uso cria outro e
 * tenta conectar de novo. `close()` explícito também emite o evento — o que só
 * significa que um uso posterior recebe um cliente novo, que é o correto.
 */
function criarCliente(): MongoClient {
    const cliente = new MongoClient(uri, options)
    cliente.once('topologyClosed', () => {
        if (guardado() === cliente) guardar(undefined)
    })
    return cliente
}

/**
 * Cliente Mongo escopado exclusivamente para o log de auditoria imutável
 * (BR-AUD-01). Não é uma fonte de dados de negócio — ver DESIGN.md §13 e
 * DB_SCHEMA.md §9.
 *
 * Uma função, e não uma instância exportada, para que quem usa sempre receba
 * o cliente vivo (ver `criarCliente`).
 */
export function clienteMongo(): MongoClient {
    const atual = guardado()
    if (atual) return atual
    const novo = criarCliente()
    guardar(novo)
    return novo
}
