import type { EventoExecucao, RegistroExecucaoManutencao, SnapshotLinha } from '../../ports/registro-execucao'
import type { ExecutorConjuntos, SessaoConjuntos } from '../../ports/executor-conjuntos'
import type { LeitorEsquema } from '../../ports/leitor-esquema'
import { CATALOGO } from '../../../domain/catalogo'
import type { FkFisica } from '../../../domain/conferir-catalogo'
import type { ImpressaoDigital, SaldoPrevisto } from '../../../domain/previa'

/**
 * Dublês dos ports do `manutencao`, só para testes de `application/`. Registram
 * a ordem das chamadas em `chamadas` — é o que os testes de `executar-acao`
 * verificam (research D8: a ordem é a garantia).
 */

export const FKS_DO_CATALOGO: FkFisica[] = CATALOGO.vinculos.map((v) => ({
    filho: v.filho,
    coluna: v.coluna,
    pai: v.pai,
    regraBanco: v.regraBanco,
    obrigatorio: v.obrigatorio
}))

export function leitorFalso(fks: FkFisica[] = FKS_DO_CATALOGO): LeitorEsquema {
    return {
        fksFisicas: async () => fks,
        contagens: async (tabelas) =>
            Object.fromEntries(tabelas.map((t) => [t, { registros: 3, registrosSistema: 0 }])),
        listarRegistros: async () => ({ linhas: [], total: 0 })
    }
}

export type ConfiguracaoSessao = {
    /** Uma impressão por modo; `padrao` quando o modo não importa. */
    impressao: Partial<Record<'cascata' | 'preservacao' | 'padrao', ImpressaoDigital>>
    protegidos?: Array<{ descricao: string; quantidade: number }>
    saldos?: SaldoPrevisto[]
    administradores?: number
    linhas?: SnapshotLinha[]
    falhaEm?: 'aplicar' | 'recalcularSaldos'
}

export function executorFalso(config: ConfiguracaoSessao, chamadas: string[]) {
    const transacoes: Array<{ confirmar: boolean; resultado: 'commit' | 'rollback' }> = []

    const executor: ExecutorConjuntos = {
        async emTransacao(fn, { confirmar }) {
            let modoAtual: 'cascata' | 'preservacao' | 'padrao' = 'padrao'
            const impressao = () => config.impressao[modoAtual] ?? config.impressao.padrao ?? {}

            const sessao: SessaoConjuntos = {
                async travar(tabelas) {
                    chamadas.push(`travar:${[...tabelas].sort().join(',')}`)
                },
                async semear() {
                    chamadas.push('semear')
                },
                async protegidosNaRaiz() {
                    return config.protegidos ?? []
                },
                // Sempre "há linhas": o dublê precisa que a expansão visite os
                // vínculos para inferir o modo.
                tamanho: () => 1,
                async propagarExclusao(v) {
                    // Só a cascata propaga exclusão por vínculo histórico; só a
                    // preservação redireciona. É assim que o dublê sabe o modo.
                    if (v.classificacao === 'historico') modoAtual = 'cascata'
                    return 0
                },
                async propagarRedirecionamento() {
                    modoAtual = 'preservacao'
                    return 0
                },
                async descartarRedirecionamentosApagados() {},
                async contar() {
                    chamadas.push('contar')
                    return impressao()
                },
                async amostrar() {
                    return []
                },
                async saldos() {
                    return config.saldos ?? []
                },
                async idsParaInvalidar() {
                    return { atividades: [], usuarios: [] }
                },
                async administradoresRestantes() {
                    return config.administradores ?? 1
                },
                async *linhasAfetadas() {
                    for (const l of config.linhas ?? []) yield l
                },
                async aplicar() {
                    chamadas.push('aplicar')
                    if (config.falhaEm === 'aplicar') throw new Error('falha simulada no aplicar')
                    return impressao()
                },
                async recalcularSaldos() {
                    chamadas.push('recalcularSaldos')
                    if (config.falhaEm === 'recalcularSaldos') throw new Error('falha simulada no saldo')
                    return config.saldos ?? []
                }
            }

            try {
                const r = await fn(sessao)
                const resultado = confirmar ? 'commit' : 'rollback'
                chamadas.push(resultado)
                transacoes.push({ confirmar, resultado })
                return r
            } catch (erro) {
                chamadas.push('rollback')
                transacoes.push({ confirmar, resultado: 'rollback' })
                throw erro
            }
        }
    }
    return { executor, transacoes }
}

export function registroFalso(
    chamadas: string[],
    falhas: { ping?: boolean; inicio?: boolean; desfecho?: boolean } = {}
) {
    const eventos: EventoExecucao[] = []
    const snapshots: SnapshotLinha[] = []
    const registro: RegistroExecucaoManutencao = {
        async verificarDisponibilidade() {
            chamadas.push('verificarDisponibilidade')
            if (falhas.ping) throw new Error('mongo fora')
        },
        async registrarInicio(evento, linhas) {
            chamadas.push('registrarInicio')
            if (falhas.inicio) throw new Error('mongo caiu no meio')
            eventos.push(evento)
            for await (const l of linhas) snapshots.push(l)
        },
        async registrarDesfecho(evento) {
            chamadas.push(`registrarDesfecho:${evento.fase}`)
            if (falhas.desfecho) throw new Error('mongo caiu no desfecho')
            eventos.push(evento)
        }
    }
    return { registro, eventos, snapshots }
}
