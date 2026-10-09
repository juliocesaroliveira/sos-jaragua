import 'server-only'
import { DomainError } from '@/src/shared/kernel'
import { ENTIDADES_AUDITADAS, type AcaoAuditada, type EntidadeAuditada } from '@/src/shared/db/mongo/audit-logs'
import {
    AuditoriaIndisponivelError,
    criarLeitorAuditoria,
    type FiltrosTrilha,
    type RegistroTrilha
} from '../../infrastructure/audit-reader'

/**
 * Trilha de auditoria para a central de relatórios — R-17
 * (specs/023-central-relatorios, US4, FR-021 a FR-023).
 *
 * Porta de leitura do módulo Auditoria: Contingência não fala com o Mongo
 * (Princípio I). Aqui a falha de infraestrutura vira um erro de domínio com
 * código estável (`auditoria_indisponivel`), que o caso de uso devolve como
 * falha tipada — a tela mostra "indisponível, tente de novo" e os outros 16
 * relatórios nem percebem (FR-023, SC-008).
 */

export type { FiltrosTrilha, RegistroTrilha }

export const ACOES_AUDITADAS = ['create', 'update', 'delete'] as const satisfies readonly AcaoAuditada[]

export { ENTIDADES_AUDITADAS }

/** Rótulos em pt-BR — o BRD fala de "assuntos", não de nomes de entidade. */
export const ROTULO_ENTIDADE_AUDITADA: Record<EntidadeAuditada, string> = {
    Doacao: 'Doação',
    Voluntario: 'Voluntário',
    Atividade: 'Atividade',
    Usuario: 'Usuário',
    Habilidade: 'Habilidade'
}

export const ROTULO_ACAO_AUDITADA: Record<AcaoAuditada, string> = {
    create: 'Criação',
    update: 'Alteração',
    delete: 'Exclusão'
}

const MENSAGEM_INDISPONIVEL = 'A trilha de auditoria está indisponível no momento. Tente novamente em instantes.'

const leitor = criarLeitorAuditoria()

export async function trilhaAuditoria(
    filtros: FiltrosTrilha,
    janela: { limite: number; deslocamento: number }
): Promise<RegistroTrilha[]> {
    return traduzirIndisponibilidade(() => leitor.listar(filtros, janela))
}

export async function contarTrilhaAuditoria(filtros: FiltrosTrilha): Promise<number> {
    return traduzirIndisponibilidade(() => leitor.contar(filtros))
}

async function traduzirIndisponibilidade<T>(operacao: () => Promise<T>): Promise<T> {
    try {
        return await operacao()
    } catch (erro) {
        if (erro instanceof AuditoriaIndisponivelError) {
            // Log estruturado para quem opera: a mensagem da tela não diz por quê.
            console.error('[auditoria] leitura da trilha falhou', { causa: erro.cause })
            throw new DomainError('auditoria_indisponivel', MENSAGEM_INDISPONIVEL)
        }
        throw erro
    }
}
