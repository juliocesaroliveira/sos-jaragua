import { withAudit, type Ator } from '@/src/modules/auditoria'
import { ValorIlegivelError } from '@/src/shared/cripto/erros'
import { campoVisivelPara, ROTULO_CAMPO_SENSIVEL, type CampoSensivel } from '@/src/shared/mascara/campos-sensiveis'
import type { Role } from '@/src/shared/auth/roles'
import type { VoluntarioRepository } from '../ports/voluntario-repository'

/**
 * Revelação do valor completo de um campo sensível (feature 025, FR-015 a
 * FR-017).
 *
 * É o **único** caminho pelo qual dado sensível em texto plano chega ao cliente.
 * Fica fora de cache por construção: depende da sessão, e `DESIGN.md` §7 proíbe
 * cachear dado derivado de sessão.
 */

export type EntradaRevelacao = {
    perfilId: string
    campo: CampoSensivel
    ator: { userId: string; role: Role | undefined }
}

export type ResultadoRevelacao =
    | { ok: true; valor: string }
    | { ok: false; erro: 'sem_permissao' | 'ilegivel' | 'nao_encontrado' }

export class RevelarDadoSensivelUseCase {
    constructor(private readonly voluntarios: VoluntarioRepository) {}

    async executar({ perfilId, campo, ator }: EntradaRevelacao): Promise<ResultadoRevelacao> {
        let dados
        try {
            dados = await this.voluntarios.buscarDadosSensiveis(perfilId)
        } catch (erro) {
            if (erro instanceof ValorIlegivelError) return { ok: false, erro: 'ilegivel' }
            throw erro
        }

        // Titular anonimizado não tem dado para revelar, e tratá-lo como
        // "não encontrado" evita confirmar que a pessoa existiu (FR-022).
        if (!dados || dados.anonimizadoEm !== null) return { ok: false, erro: 'nao_encontrado' }

        const ehTitular = dados.userId === ator.userId

        // A autorização é verificada **aqui**, no servidor, não na interface: o
        // botão de revelar é conveniência, esta checagem é a fonte de verdade.
        if (!campoVisivelPara(campo, ator.role, ehTitular)) {
            // Recusa NÃO produz registro de leitura: não houve acesso ao dado.
            return { ok: false, erro: 'sem_permissao' }
        }

        const valor = dados[campo]
        if (valor === null) return { ok: false, erro: 'nao_encontrado' }

        // A auditoria NÃO pode derrubar a revelação (Princípio V): a política de
        // degradação não bloqueante vale para a leitura como vale para a escrita.
        // Quem está em campo conferindo um documento não pode ser impedido porque
        // o Mongo está fora do ar — a lacuna de log é o menor dos dois males, e
        // fica registrada para reconciliação.
        try {
            await this.auditar({ perfilId, campo, ator, ehTitular })
        } catch (erro) {
            console.error('[revelar-dado-sensivel] falha ao auditar revelação — acesso NÃO foi impedido', {
                perfilId,
                campo,
                userId: ator.userId,
                erro
            })
        }

        return { ok: true, valor }
    }

    /**
     * Registra a revelação com ação `read`.
     *
     * Grava o **nome** do campo, nunca o valor — do contrário a trilha de FR-017
     * violaria FR-026, virando ela mesma o vazamento que a feature combate.
     *
     * A falha de auditoria não impede a revelação: a política de degradação não
     * bloqueante do Princípio V vale aqui como vale para as escritas.
     */
    private async auditar({
        perfilId,
        campo,
        ator,
        ehTitular
    }: {
        perfilId: string
        campo: CampoSensivel
        ator: { userId: string; role: Role | undefined }
        ehTitular: boolean
    }): Promise<void> {
        const identificacao: Ator = { userId: ator.userId, role: ator.role ?? 'usuario' }

        await withAudit(
            {
                entidade: 'Voluntario',
                acao: 'read',
                tabela: 'voluntario_perfil',
                ator: identificacao,
                dadosAnteriores: async () => null,
                extrair: () => ({
                    entidadeId: perfilId,
                    dadosNovos: {
                        campoRevelado: campo,
                        rotulo: ROTULO_CAMPO_SENSIVEL[campo],
                        proprioTitular: ehTitular
                    }
                })
            },
            async () => undefined
        )
    }
}
