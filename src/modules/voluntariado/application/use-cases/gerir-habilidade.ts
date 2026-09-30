import { DomainError, NaoEncontradoError, falha, ok, type Result, type UseCase } from '@/src/shared/kernel'
import { withAudit } from '@/src/modules/auditoria'
import {
    DuplicadoError,
    VinculoExistenteError,
    normalizarNomeHabilidade,
    validarNomeHabilidade
} from '../../domain/habilidade'
import type { Habilidade, HabilidadeRepository } from '../ports/habilidade-repository'

/**
 * Casos de uso de Gestão de Habilidades (017-gestao-habilidades).
 *
 * A normalização e os limites vêm do `domain/`; aqui ficam a ordem das
 * checagens, a auditoria e a tradução para `Result`. O repositório é a única
 * dependência — nada de Drizzle ou Next nesta camada (Princípio I).
 */

/**
 * Erros de domínio levantados pelo repositório (`DuplicadoError` na violação do
 * índice único, `VinculoExistenteError` na de FK) viram falha, não exceção que
 * atravessa a Server Action.
 *
 * A checagem prévia cobre o caso comum e dá a mensagem melhor; isto cobre a
 * corrida em que duas escritas simultâneas passam pela checagem e só o banco
 * separa as duas (research.md D3/D4).
 */
async function comoResultado<T>(fn: () => Promise<T>): Promise<Result<T, DomainError>> {
    try {
        return ok(await fn())
    } catch (erro) {
        if (erro instanceof DomainError) return falha(erro)
        throw erro
    }
}

export type EntradaCriarHabilidade = { nome: string }

/** FR-006 — cadastro de habilidade (contracts/gestao-habilidades.md C-01). */
export class CriarHabilidadeUseCase implements UseCase<EntradaCriarHabilidade, Habilidade> {
    constructor(private readonly habilidades: HabilidadeRepository) {}

    async executar({ nome: bruto }: EntradaCriarHabilidade): Promise<Result<Habilidade, DomainError>> {
        const invalido = validarNomeHabilidade(bruto)
        if (invalido) return falha(invalido)

        const nome = normalizarNomeHabilidade(bruto)

        const existente = await this.habilidades.buscarPorNomeNormalizado(nome, undefined)
        if (existente) return falha(new DuplicadoError())

        return comoResultado(() =>
            withAudit(
                {
                    entidade: 'Habilidade',
                    acao: 'create',
                    tabela: 'habilidade',
                    extrair: (criada) => ({ entidadeId: criada.id, dadosNovos: { ...criada } })
                },
                () => this.habilidades.criar({ nome })
            )
        )
    }
}

export type EntradaEditarHabilidade = { id: string; nome: string }

/**
 * FR-007 — edição do nome (contracts/gestao-habilidades.md E-01).
 *
 * Só `nome` é alterado: `id` e `criadoEm` são imutáveis e nenhum vínculo é
 * tocado, porque a chave do vínculo é o `id`, que não muda (INV-05/INV-06).
 */
export class EditarHabilidadeUseCase implements UseCase<EntradaEditarHabilidade, Habilidade> {
    constructor(private readonly habilidades: HabilidadeRepository) {}

    async executar({ id, nome: bruto }: EntradaEditarHabilidade): Promise<Result<Habilidade, DomainError>> {
        const invalido = validarNomeHabilidade(bruto)
        if (invalido) return falha(invalido)

        const nome = normalizarNomeHabilidade(bruto)

        const anterior = await this.habilidades.buscarPorId(id)
        if (!anterior) return falha(new NaoEncontradoError('Esta habilidade não existe mais.'))

        // `id` como segundo argumento exclui a própria linha da checagem: sem
        // isso, corrigir "motosserra" para "Motosserra" seria recusado como
        // duplicata de si mesma (E-01.2).
        const colisao = await this.habilidades.buscarPorNomeNormalizado(nome, id)
        if (colisao) return falha(new DuplicadoError())

        return comoResultado(async () => {
            const atualizada = await withAudit(
                {
                    entidade: 'Habilidade',
                    acao: 'update',
                    tabela: 'habilidade',
                    dadosAnteriores: async () => ({ ...anterior }),
                    extrair: (resultado) => ({
                        entidadeId: id,
                        dadosNovos: resultado ? { ...resultado } : null
                    })
                },
                () => this.habilidades.atualizar({ id, nome })
            )

            // Excluída entre o `buscarPorId` e o `UPDATE` — janela estreita, mas
            // o retorno `null` do repositório é o que a expõe.
            if (!atualizada) throw new NaoEncontradoError('Esta habilidade não existe mais.')
            return atualizada
        })
    }
}

export type EntradaExcluirHabilidade = { id: string }

/**
 * FR-011/FR-012 — exclusão (contracts/gestao-habilidades.md X-01).
 *
 * A contagem prévia existe pela **mensagem**: dizer "está vinculada a 3
 * voluntários" orienta a próxima ação. A garantia de que nenhum vínculo some
 * é do banco (FK `RESTRICT`), não desta checagem — é o que cobre a corrida em
 * que o vínculo nasce entre a contagem e o `DELETE` (INV-04, research.md D4).
 */
export class ExcluirHabilidadeUseCase implements UseCase<EntradaExcluirHabilidade, { id: string }> {
    constructor(private readonly habilidades: HabilidadeRepository) {}

    async executar({ id }: EntradaExcluirHabilidade): Promise<Result<{ id: string }, DomainError>> {
        const habilidade = await this.habilidades.buscarPorId(id)
        if (!habilidade) return falha(new NaoEncontradoError('Esta habilidade não existe mais.'))

        const vinculos = await this.habilidades.contarVinculos(id)
        if (vinculos > 0) return falha(new VinculoExistenteError(vinculos))

        return comoResultado(async () => {
            await withAudit(
                {
                    entidade: 'Habilidade',
                    acao: 'delete',
                    tabela: 'habilidade',
                    dadosAnteriores: async () => ({ ...habilidade }),
                    extrair: () => ({ entidadeId: id, dadosNovos: null })
                },
                () => this.habilidades.excluir(id)
            )
            return { id }
        })
    }
}
