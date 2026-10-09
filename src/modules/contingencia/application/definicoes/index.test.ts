import { describe, expect, it, vi } from 'vitest'

/**
 * Registro completo (specs/023-central-relatorios).
 *
 * O catálogo só mostra relatórios registrados e `/relatorios/<slug>` sem
 * registro responde 404. Este teste trava que os 17 do catálogo têm definição,
 * cada um uma vez — e que a definição herda do catálogo a rota que decide o
 * acesso (research D3).
 *
 * As consultas dos módulos não são chamadas ao registrar, então os mocks
 * só precisam existir para o import não abrir conexão com banco.
 */
vi.mock('@/src/modules/estoque/presentation/queries/relatorios', () => ({}))
vi.mock('@/src/modules/voluntariado/presentation/queries/relatorios', () => ({}))
vi.mock('@/src/modules/logistica/presentation/queries/relatorios', () => ({}))
vi.mock('@/src/modules/logistica/presentation/queries/dashboard', () => ({}))
vi.mock('@/src/modules/notificacoes/presentation/queries/relatorios', () => ({}))
vi.mock('@/src/modules/identidade/presentation/queries/relatorios', () => ({}))
vi.mock('@/src/modules/auditoria/presentation/queries/trilha', () => ({
    ACOES_AUDITADAS: ['create', 'update', 'delete'],
    ENTIDADES_AUDITADAS: ['Voluntario', 'Atividade', 'Doacao', 'Usuario', 'Habilidade'],
    ROTULO_ACAO_AUDITADA: {},
    ROTULO_ENTIDADE_AUDITADA: {}
}))
vi.mock('@/src/shared/config/limiares-alerta', () => ({ limiarEstoqueMinimoGlobal: () => 5 }))

const { obterRelatorio, slugsDisponiveis } = await import('./index')
const { DESCRICOES_RELATORIO, SLUGS_RELATORIO } = await import('../../domain/catalogo')

describe('registro de relatórios', () => {
    it('os 17 relatórios do catálogo estão registrados, cada um uma vez', () => {
        const registrados = slugsDisponiveis()
        expect([...registrados].sort()).toEqual([...SLUGS_RELATORIO].sort())
        expect(new Set(registrados).size).toBe(registrados.length)
    })

    it('cada definição carrega a descrição do catálogo — inclusive a rota que decide o acesso', () => {
        for (const slug of SLUGS_RELATORIO) {
            const relatorio = obterRelatorio(slug)
            expect(relatorio?.rota, slug).toBe(DESCRICOES_RELATORIO[slug].rota)
            expect(relatorio?.nome, slug).toBe(DESCRICOES_RELATORIO[slug].nome)
            expect(relatorio?.colunas.length, slug).toBeGreaterThan(0)
        }
    })

    it('slug desconhecido não resolve', () => {
        expect(obterRelatorio('nao-existe')).toBeUndefined()
        expect(obterRelatorio(undefined)).toBeUndefined()
    })
})
