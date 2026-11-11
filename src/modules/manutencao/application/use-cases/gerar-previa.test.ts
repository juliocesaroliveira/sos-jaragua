import { describe, expect, it } from 'vitest'
import { REGISTROS_SISTEMA } from '@/src/shared/kernel/registros-sistema'
import { GerarPreviaUseCase } from './gerar-previa'
import { executorFalso, FKS_DO_CATALOGO, leitorFalso } from './testes/fakes'

const ATOR = {
    userId: 'admin-1',
    role: 'administrador' as const,
    sessionToken: 'tok-admin',
    sessaoCriadaEm: new Date()
}

function caso(config: Parameters<typeof executorFalso>[0], fks = FKS_DO_CATALOGO) {
    const chamadas: string[] = []
    const { executor, transacoes } = executorFalso(config, chamadas)
    const uc = new GerarPreviaUseCase({ leitor: leitorFalso(fks), executor })
    return { uc, chamadas, transacoes }
}

describe('GerarPreviaUseCase (C-03)', () => {
    it('tabela fora do catálogo → tabela_desconhecida', async () => {
        const { uc } = caso({ impressao: {} })
        const r = await uc.executar({
            pedido: { acao: 'resetar_tabela', tabela: 'pg_authid' },
            ator: ATOR,
            ambiente: 'development'
        })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.erro.codigo).toBe('tabela_desconhecida')
    })

    it('vínculo não classificado → catalogo_divergente com os vínculos', async () => {
        const fks = [
            ...FKS_DO_CATALOGO,
            { filho: 'kit', coluna: 'novo_id', pai: 'item', regraBanco: 'restrict' as const, obrigatorio: true }
        ]
        const { uc } = caso({ impressao: {} }, fks)
        const r = await uc.executar({
            pedido: { acao: 'resetar_tabela', tabela: 'item' },
            ator: ATOR,
            ambiente: 'development'
        })
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.erro.codigo).toBe('catalogo_divergente')
            expect(r.erro.detalhes?.vinculos).toEqual(['kit.novo_id → item'])
        }
    })

    it('com dependentes de histórico e sem modo → pede a escolha, com os totais de cada opção', async () => {
        const { uc, transacoes } = caso({
            impressao: {
                preservacao: {
                    item: { apagar: 3, redirecionar: {} },
                    entrada: { apagar: 0, redirecionar: { item_id: 7 } }
                },
                cascata: { item: { apagar: 3, redirecionar: {} }, entrada: { apagar: 7, redirecionar: {} } }
            }
        })
        const r = await uc.executar({
            pedido: { acao: 'resetar_tabela', tabela: 'item' },
            ator: ATOR,
            ambiente: 'development'
        })
        expect(r.ok).toBe(true)
        if (!r.ok) return
        expect(r.valor.temDependentes).toBe(true)
        expect(r.valor.modo).toBeNull()
        expect(r.valor.opcoes).toEqual({ cascata: { apagar: 10, alterar: 0 }, preservacao: { apagar: 3, alterar: 7 } })
        // Prévia nunca confirma transação.
        expect(transacoes.every((t) => t.resultado === 'rollback')).toBe(true)
    })

    it('com modo escolhido → árvore, redirecionamentos e texto de confirmação', async () => {
        const { uc } = caso({
            impressao: {
                preservacao: {
                    item: { apagar: 3, redirecionar: {} },
                    entrada: { apagar: 0, redirecionar: { item_id: 7 } }
                }
            }
        })
        const r = await uc.executar({
            pedido: { acao: 'resetar_tabela', tabela: 'item', modo: 'preservacao' },
            ator: ATOR,
            ambiente: 'production'
        })
        expect(r.ok).toBe(true)
        if (!r.ok) return
        expect(r.valor.modo).toBe('preservacao')
        expect(r.valor.textoConfirmacao).toBe('RESETAR item')
        expect(r.valor.arvore.map((n) => [n.tabela, n.nivel])).toEqual([
            ['item', 0],
            ['entrada', 1]
        ])
        expect(r.valor.redirecionamentos).toEqual([
            {
                vinculo: 'entrada.item_id → item',
                tabela: 'entrada',
                coluna: 'item_id',
                quantidade: 7,
                valorPadrao: 'Item removido'
            }
        ])
        expect(r.valor.totalApagar).toBe(3)
        expect(r.valor.totalAlterar).toBe(7)
        expect(r.valor.ambiente).toBe('production')
    })

    it('só dependentes inseparáveis → sem escolha, modo sem_dependentes, inseparáveis listados (FR-011)', async () => {
        const { uc } = caso({
            impressao: {
                padrao: { saida: { apagar: 2, redirecionar: {} }, saida_item: { apagar: 5, redirecionar: {} } }
            }
        })
        const r = await uc.executar({
            pedido: { acao: 'resetar_tabela', tabela: 'saida' },
            ator: ATOR,
            ambiente: 'development'
        })
        expect(r.ok).toBe(true)
        if (!r.ok) return
        expect(r.valor.temDependentes).toBe(false)
        expect(r.valor.modo).toBe('sem_dependentes')
        expect(r.valor.inseparaveis.map((n) => n.tabela)).toEqual(['saida_item'])
    })

    it('sem dependente nenhum → sem_dependentes', async () => {
        const { uc } = caso({ impressao: { padrao: { habilidade: { apagar: 4, redirecionar: {} } } } })
        const r = await uc.executar({
            pedido: { acao: 'resetar_tabela', tabela: 'habilidade' },
            ator: ATOR,
            ambiente: 'development'
        })
        expect(r.ok && r.valor.modo).toBe('sem_dependentes')
    })

    it('registros protegidos aparecem em preservados (FR-018)', async () => {
        const { uc } = caso({
            impressao: { padrao: { user: { apagar: 10, redirecionar: {} } } },
            protegidos: [
                { descricao: 'Sua conta', quantidade: 1 },
                { descricao: 'Registro do sistema: Usuário removido', quantidade: 1 },
                { descricao: 'Suas contas de login', quantidade: 0 }
            ]
        })
        const r = await uc.executar({
            pedido: { acao: 'resetar_tabela', tabela: 'user', modo: 'cascata' },
            ator: ATOR,
            ambiente: 'development'
        })
        expect(r.ok).toBe(true)
        if (!r.ok) return
        expect(r.valor.preservados.map((p) => p.descricao)).toEqual([
            'Sua conta',
            'Registro do sistema: Usuário removido'
        ])
    })

    it('tabelas de autenticação trazem o alerta de acesso', async () => {
        const { uc } = caso({ impressao: { padrao: { session: { apagar: 4, redirecionar: {} } } } })
        const r = await uc.executar({
            pedido: { acao: 'resetar_tabela', tabela: 'session' },
            ator: ATOR,
            ambiente: 'development'
        })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.valor.alertas.join(' ')).toMatch(/desconectad/i)
    })

    it('seleção com registro padrão ou a própria conta → registro_protegido', async () => {
        const { uc } = caso({ impressao: {} })
        for (const [tabela, chave] of [
            ['item', REGISTROS_SISTEMA.item],
            ['user', 'admin-1']
        ]) {
            const r = await uc.executar({
                pedido: { acao: 'excluir_selecionados', tabela, chaves: ['outro', chave] },
                ator: ATOR,
                ambiente: 'development'
            })
            expect(r.ok).toBe(false)
            if (!r.ok) expect(r.erro.codigo).toBe('registro_protegido')
        }
    })

    it('seleção vazia ou acima de 500 é recusada', async () => {
        const { uc } = caso({ impressao: {} })
        const vazia = await uc.executar({
            pedido: { acao: 'excluir_selecionados', tabela: 'item', chaves: [] },
            ator: ATOR,
            ambiente: 'development'
        })
        const grande = await uc.executar({
            pedido: {
                acao: 'excluir_selecionados',
                tabela: 'item',
                chaves: Array.from({ length: 501 }, (_, i) => `k${i}`)
            },
            ator: ATOR,
            ambiente: 'development'
        })
        expect(vazia.ok || grande.ok).toBe(false)
    })
})
