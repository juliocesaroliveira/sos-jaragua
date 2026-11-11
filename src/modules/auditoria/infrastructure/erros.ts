/**
 * Erro de indisponibilidade da base de auditoria.
 *
 * Num arquivo próprio, sem importar o cliente Mongo, para que o índice do
 * módulo possa reexportá-lo sem arrastar a conexão (e a exigência de
 * `MONGODB_URI`) para quem só precisa do tipo — inclusive os testes unitários.
 */
export class AuditoriaIndisponivelError extends Error {
    constructor(causa?: unknown) {
        super('Base de auditoria indisponível.', { cause: causa })
        this.name = 'AuditoriaIndisponivelError'
    }
}
