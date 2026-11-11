import { sessaoRecente } from '@/src/shared/auth/sessao-recente'
import { DomainError, falha, ok, type Result } from '@/src/shared/kernel'
import { CATALOGO, tabelaDoCatalogo, type Catalogo } from '../../domain/catalogo'
import {
    mesmasContagens,
    textoConfirmacao,
    type Ambiente,
    type ImpressaoDigital,
    type PedidoAcao,
    type Previa,
    type ResultadoExecucao
} from '../../domain/previa'
import type { ExecutorConjuntos, SessaoConjuntos } from '../ports/executor-conjuntos'
import type { LeitorEsquema } from '../ports/leitor-esquema'
import type { EventoExecucao, FaseEvento, RegistroExecucaoManutencao, SnapshotLinha } from '../ports/registro-execucao'
import {
    calcularConjuntos,
    montarPrevia,
    protecoesDo,
    tabelasATravar,
    validarPedido,
    vinculosRedirecionados,
    type AtorDangerZone
} from './montar-previa'

export type EntradaExecucao = {
    pedido: PedidoAcao
    impressaoDigital: ImpressaoDigital
    confirmacao: string
    ator: AtorDangerZone
    ambiente: Ambiente
}

type Dependencias = {
    leitor: LeitorEsquema
    executor: ExecutorConjuntos
    registro: RegistroExecucaoManutencao
    relogio?: () => Date
    novoId?: () => string
    catalogo?: Catalogo
}

/** Interrompe a transação levando a recusa — o `emTransacao` faz rollback. */
class Interrupcao extends Error {
    constructor(readonly erro: DomainError) {
        super(erro.message)
    }
}

const MSG = {
    reautenticacao:
        'Por segurança, ações da Danger Zone exigem um login feito há no máximo 15 minutos. Entre novamente para continuar.',
    confirmacao: 'O texto de confirmação não confere. Digite exatamente o texto pedido.',
    auditoria:
        'A trilha de auditoria está indisponível. Ações da Danger Zone não são executadas sem auditoria — tente novamente em instantes.',
    dadosMudaram:
        'Os dados mudaram desde a prévia — alguém criou ou apagou registros nesse intervalo. Revise o novo impacto antes de confirmar.',
    modo: 'Escolha entre apagar em cascata e preservar os dependentes antes de executar.',
    ultimoAdmin: 'A ação deixaria o sistema sem nenhum administrador ativo e foi recusada.',
    falha: 'A execução falhou e nada foi alterado. Tente novamente; se persistir, avise a equipe técnica.'
}

/**
 * Executa um reset ou uma exclusão de selecionados (C-04, research D6–D8).
 *
 * A ordem é a garantia, e o teste a trava:
 * `verificarDisponibilidade → travar → recálculo e comparação → registrarInicio
 * → aplicar → recalcularSaldos → commit → registrarDesfecho`.
 *
 * - Nada toca o Postgres sem a auditoria ter respondido (FR-016, exceção ao
 *   Princípio V restrita à Danger Zone).
 * - Os snapshots vão para a trilha **antes** do commit; se não forem aceitos, a
 *   transação é desfeita — não existe ação efetivada sem rastro.
 * - O recálculo sob trava é o que torna a impressão digital confiável (FR-015).
 */
export class ExecutarAcaoUseCase {
    private readonly catalogo: Catalogo
    private readonly relogio: () => Date
    private readonly novoId: () => string

    constructor(private readonly deps: Dependencias) {
        this.catalogo = deps.catalogo ?? CATALOGO
        this.relogio = deps.relogio ?? (() => new Date())
        this.novoId = deps.novoId ?? (() => crypto.randomUUID())
    }

    async executar(entrada: EntradaExecucao): Promise<Result<ResultadoExecucao, DomainError>> {
        const { pedido, ator, ambiente } = entrada
        const execucaoId = this.novoId()
        const inicio = this.relogio().getTime()
        const resumo = (extra: Record<string, unknown> = {}) => ({
            acao: pedido.acao,
            tabela: pedido.tabela,
            modo: pedido.modo ?? 'sem_dependentes',
            ambiente,
            impressaoDigital: entrada.impressaoDigital,
            ...(pedido.chaves ? { selecionados: pedido.chaves.length } : {}),
            ...extra
        })
        const evento = (fase: FaseEvento, extra?: Record<string, unknown>): EventoExecucao => ({
            execucaoId,
            fase,
            ator: { userId: ator.userId, role: ator.role, ip: ator.ip, userAgent: ator.userAgent },
            resumo: resumo(extra)
        })
        const recusar = async (erro: DomainError) => {
            await this.desfechoTolerante(evento('recusada', { motivo: erro.codigo }))
            return falha(erro)
        }

        if (!sessaoRecente(ator, this.relogio())) {
            return recusar(new DomainError('reautenticacao_necessaria', MSG.reautenticacao))
        }
        if (entrada.confirmacao !== textoConfirmacao(pedido)) {
            return recusar(new DomainError('confirmacao_invalida', MSG.confirmacao))
        }
        const invalido = await validarPedido(pedido, ator, this.catalogo, this.deps.leitor)
        if (invalido) return recusar(invalido)

        try {
            await this.deps.registro.verificarDisponibilidade()
        } catch {
            // Sem auditoria não há onde registrar a recusa; o log basta.
            console.error('[manutencao] auditoria indisponível — execução recusada', {
                execucaoId,
                tabela: pedido.tabela
            })
            return falha(new DomainError('auditoria_indisponivel', MSG.auditoria))
        }

        const protecoes = protecoesDo(ator)
        const modoCalculo = pedido.modo ?? 'preservacao'
        let travadoEm = 0
        let inicioRegistrado = false

        try {
            const resultado = await this.deps.executor.emTransacao(
                async (sessao) => {
                    await sessao.travar(tabelasATravar(pedido, this.catalogo))
                    travadoEm = this.relogio().getTime()

                    const impressao = await calcularConjuntos(sessao, this.catalogo, pedido, modoCalculo, protecoes)
                    const previa = await montarPrevia(
                        sessao,
                        this.catalogo,
                        pedido,
                        impressao,
                        protecoes,
                        ambiente,
                        pedido.modo ?? null,
                        null
                    )

                    if (previa.temDependentes && !pedido.modo) {
                        throw new Interrupcao(new DomainError('modo_obrigatorio', MSG.modo))
                    }
                    if (!mesmasContagens(impressao, entrada.impressaoDigital)) {
                        throw new Interrupcao(
                            new DomainError('dados_mudaram', MSG.dadosMudaram, { previa: previaSerializavel(previa) })
                        )
                    }
                    if ((await sessao.administradoresRestantes()) < 1) {
                        throw new Interrupcao(new DomainError('ultimo_administrador', MSG.ultimoAdmin))
                    }

                    try {
                        await this.deps.registro.registrarInicio(evento('iniciada'), this.snapshots(sessao))
                        inicioRegistrado = true
                    } catch {
                        throw new Interrupcao(new DomainError('auditoria_indisponivel', MSG.auditoria))
                    }

                    const invalidar = await sessao.idsParaInvalidar()
                    // Os conjuntos foram calculados em `modoCalculo`; aplicar com o
                    // mesmo modo é o que mantém o executado igual ao mostrado.
                    const contagens = await sessao.aplicar(vinculosRedirecionados(this.catalogo, modoCalculo))
                    const saldos = await sessao.recalcularSaldos(previa.saldos.map((s) => s.itemId))
                    return { contagens, saldos, invalidar }
                },
                { confirmar: true }
            )

            const fim = this.relogio().getTime()
            await this.desfechoTolerante(evento('concluida', { contagensReais: resultado.contagens }))
            console.info('[manutencao] duracao', {
                execucaoId,
                tabela: pedido.tabela,
                totalMs: fim - inicio,
                travasMs: travadoEm ? fim - travadoEm : 0
            })
            return ok({
                execucaoId,
                contagens: resultado.contagens,
                saldos: resultado.saldos,
                duracaoMs: fim - inicio,
                invalidar: resultado.invalidar
            })
        } catch (erro) {
            if (erro instanceof Interrupcao) {
                if (erro.erro.codigo === 'auditoria_indisponivel') return falha(erro.erro)
                return recusar(erro.erro)
            }
            console.error('[manutencao] execução falhou — transação desfeita', {
                execucaoId,
                tabela: pedido.tabela,
                // Só a mensagem: um erro do Postgres pode citar valores de linha.
                erro: erro instanceof Error ? erro.name : 'desconhecido'
            })
            if (inicioRegistrado) await this.desfechoTolerante(evento('falhou', { motivo: 'falha_execucao' }))
            return falha(new DomainError('falha_execucao', MSG.falha))
        }
    }

    /** Snapshots com as colunas de credencial do catálogo marcadas para remoção. */
    private async *snapshots(sessao: SessaoConjuntos): AsyncIterable<SnapshotLinha> {
        for await (const linha of sessao.linhasAfetadas()) {
            yield {
                ...linha,
                colunasOmitidas: tabelaDoCatalogo(linha.tabela)?.colunasCredencial ?? linha.colunasOmitidas
            }
        }
    }

    /**
     * Desfecho e recusas: a falha aqui não desfaz nada (o commit já aconteceu,
     * ou não houve alteração). Sem desfecho, o histórico mostra "desfecho não
     * confirmado" — o rastro do início já existe (research D8).
     */
    private async desfechoTolerante(evento: EventoExecucao): Promise<void> {
        try {
            await this.deps.registro.registrarDesfecho(evento)
        } catch {
            console.error('[manutencao] falha ao registrar desfecho na auditoria', {
                execucaoId: evento.execucaoId,
                fase: evento.fase
            })
        }
    }
}

/** A prévia nova vai em `detalhes` do erro — já é dado plano, só garante isso. */
function previaSerializavel(previa: Previa): Record<string, unknown> {
    return JSON.parse(JSON.stringify(previa)) as Record<string, unknown>
}
