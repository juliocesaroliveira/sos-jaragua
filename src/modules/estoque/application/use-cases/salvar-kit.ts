import {
    DomainError,
    NaoEncontradoError,
    ValidacaoError,
    falha,
    ok,
    type Result,
    type UseCase
} from '@/src/shared/kernel'
import { withAudit } from '@/src/modules/auditoria'
import { validarReceita, type ComponenteInformado } from '../../domain/receita-kit'
import type { ConflitoComposicao, KitRepository } from '../ports/estoque-repository'

export type EntradaSalvarKit = {
    /** Ausente = kit novo. */
    id?: string
    nome: string
    descricao?: string | null
    ativo: boolean
    componentes: ComponenteInformado[]
}

const MENSAGEM_CONFLITO: Record<ConflitoComposicao['tipo'], string> = {
    ambiguo: 'Há mais de um item com esse nome. Selecione o item na lista.',
    repetido: 'Este item já está na receita.'
}

/**
 * BR-EST-02/BR-EST-03 + feature 022 — grava o kit e sua receita, criando os
 * itens novos digitados na composição.
 *
 * A atomicidade (itens, kit e receita, tudo ou nada) fica no repositório, que
 * é quem tem a transação. Aqui ficam as regras e a auditoria — e a auditoria só
 * acontece **depois** de saber que algo foi gravado: `withAudit` registra sempre
 * que a função termina, e envolver um salvamento que o repositório recusou
 * deixaria no log um "create kit" que não existiu (research R6).
 */
export class SalvarKitUseCase implements UseCase<EntradaSalvarKit, { id: string; itensCriados: number }> {
    constructor(private readonly kits: KitRepository) {}

    async executar(entrada: EntradaSalvarKit): Promise<Result<{ id: string; itensCriados: number }, DomainError>> {
        const validacao = validarReceita(entrada.componentes)
        if (!validacao.ok) return validacao
        const componentes = validacao.valor

        // O "antes" precisa ser lido antes da mutação.
        const anteriores = entrada.id ? await this.snapshot(entrada.id) : null

        const resultado = await this.kits.salvarComposicao({
            id: entrada.id,
            nome: entrada.nome,
            descricao: entrada.descricao,
            ativo: entrada.ativo,
            componentes
        })

        if (!resultado) return falha(new NaoEncontradoError('Kit não encontrado.'))

        if ('conflitos' in resultado) {
            const campos = Object.fromEntries(
                resultado.conflitos.map((c) => [`componentes.${c.indice}.itemId`, MENSAGEM_CONFLITO[c.tipo]])
            )
            return falha(new ValidacaoError('Revise os campos destacados.', { campos }))
        }

        const { kit, receita, itensCriados, vinculos } = resultado

        // Receita de kit entra na auditoria de `Doacao` (DB_SCHEMA.md §10):
        // mudar a receita muda o que é deduzido do estoque em cada saída.
        await withAudit(
            {
                entidade: 'Doacao',
                acao: entrada.id ? 'update' : 'create',
                tabela: 'kit',
                dadosAnteriores: async () => anteriores,
                extrair: () => ({
                    entidadeId: kit.id,
                    dadosNovos: { ...kit, receita, itensCriados: itensCriados.map((i) => i.id), vinculos }
                })
            },
            async () => resultado
        )

        // Um registro por item criado: a busca de auditoria pelo id do item
        // precisa achar a criação, e `origem` responde de onde ele veio (FR-012).
        for (const criado of itensCriados) {
            await withAudit(
                {
                    entidade: 'Doacao',
                    acao: 'create',
                    tabela: 'item',
                    extrair: () => ({
                        entidadeId: criado.id,
                        dadosNovos: { ...criado, origem: 'kit', kitId: kit.id }
                    })
                },
                async () => criado
            )
        }

        return ok({ id: kit.id, itensCriados: itensCriados.length })
    }

    private async snapshot(id: string): Promise<Record<string, unknown> | null> {
        const anterior = await this.kits.buscarPorId(id)
        if (!anterior) return null
        return { ...anterior, receita: await this.kits.receita(id) }
    }
}
