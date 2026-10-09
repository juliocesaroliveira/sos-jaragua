import { describe, expect, it } from 'vitest'
import { podeAcessar } from '@/src/shared/auth/rotas'
import {
    DESCRICOES_RELATORIO,
    GRUPOS_RELATORIO,
    SLUGS_RELATORIO,
    ehSlugRelatorio,
    gruposVisiveisRelatorios,
    relatoriosVisiveis
} from './catalogo'

/**
 * Invariantes do catálogo de relatórios (specs/023-central-relatorios,
 * data-model.md §1, INV-R1..R4).
 *
 * A autorização de cada relatório **é** a regra de rota da sua página
 * (research D3). Se uma descrição apontar para a rota errada, ou se a regra de
 * `/relatorios/auditoria` sumir de `REGRAS_DE_ROTA`, estes testes quebram —
 * e são eles que impedem a trilha de auditoria de ficar visível a quem não é
 * administrador (FR-020).
 */

const TODOS = SLUGS_RELATORIO
const SEM_ACESSO = ['coordenador', 'voluntario', 'usuario'] as const

describe('INV-R1 — identidade das descrições', () => {
    it('cataloga os 17 relatórios, uma descrição por slug', () => {
        expect(TODOS).toHaveLength(17)
        expect(Object.keys(DESCRICOES_RELATORIO).sort()).toEqual([...TODOS].sort())
    })

    it('slug e nome são únicos', () => {
        const nomes = TODOS.map((slug) => DESCRICOES_RELATORIO[slug].nome)
        expect(new Set(nomes).size).toBe(nomes.length)
        expect(new Set(TODOS).size).toBe(TODOS.length)
    })

    it('a rota de cada relatório é /relatorios/<slug>', () => {
        for (const slug of TODOS) {
            expect(DESCRICOES_RELATORIO[slug].rota).toBe(`/relatorios/${slug}`)
            expect(DESCRICOES_RELATORIO[slug].slug).toBe(slug)
        }
    })

    it('todo relatório pertence a um grupo conhecido e tem uma pergunta', () => {
        for (const slug of TODOS) {
            const descricao = DESCRICOES_RELATORIO[slug]
            expect(Object.keys(GRUPOS_RELATORIO)).toContain(descricao.grupo)
            expect(descricao.pergunta.trim().length, slug).toBeGreaterThan(0)
        }
    })
})

describe('INV-R2/R3 — acesso por perfil', () => {
    it('membro da Defesa Civil acessa todos, menos a trilha de auditoria', () => {
        for (const slug of TODOS) {
            const esperado = slug !== 'auditoria'
            expect(podeAcessar(DESCRICOES_RELATORIO[slug].rota, 'membro_defesa_civil'), slug).toBe(esperado)
        }
    })

    it('administrador acessa todos', () => {
        for (const slug of TODOS) {
            expect(podeAcessar(DESCRICOES_RELATORIO[slug].rota, 'administrador'), slug).toBe(true)
        }
    })

    it('coordenador, voluntário e usuário não acessam nenhum (SC-005)', () => {
        for (const slug of TODOS) {
            for (const role of SEM_ACESSO) {
                expect(podeAcessar(DESCRICOES_RELATORIO[slug].rota, role), `${slug} para ${role}`).toBe(false)
            }
        }
    })
})

describe('INV-R4 — período declarado', () => {
    it('exatamente os relatórios de histórico usam período (FR-005)', () => {
        const comPeriodo = TODOS.filter((slug) => DESCRICOES_RELATORIO[slug].usaPeriodo).sort()
        expect(comPeriodo).toEqual(
            [
                'saidas',
                'entradas',
                'descartes',
                'movimentacao',
                'entregas-por-destino',
                'triagem',
                'ocupacao-turnos',
                'participacao',
                'evolucao-crise',
                'notificacoes',
                'auditoria'
            ].sort()
        )
    })

    it('relatórios com dados pessoais sensíveis estão marcados (FR-014)', () => {
        const sensiveis = TODOS.filter((slug) => DESCRICOES_RELATORIO[slug].contemDadosSensiveis).sort()
        expect(sensiveis).toEqual(['auditoria', 'participacao', 'voluntarios'])
    })
})

describe('ehSlugRelatorio', () => {
    it('reconhece só slugs do catálogo', () => {
        expect(ehSlugRelatorio('saidas')).toBe(true)
        expect(ehSlugRelatorio('auditoria')).toBe(true)
        expect(ehSlugRelatorio('nao-existe')).toBe(false)
        expect(ehSlugRelatorio(undefined)).toBe(false)
        expect(ehSlugRelatorio(42)).toBe(false)
    })
})

describe('relatoriosVisiveis e gruposVisiveisRelatorios', () => {
    it('para o membro, o grupo Auditoria não existe (FR-020)', () => {
        const grupos = gruposVisiveisRelatorios('membro_defesa_civil', TODOS)
        expect(grupos.map((g) => g.grupo.id)).toEqual(['estoque', 'voluntariado', 'crise', 'comunicacao'])
    })

    it('para o administrador, os cinco grupos aparecem na ordem do catálogo', () => {
        const grupos = gruposVisiveisRelatorios('administrador', TODOS)
        expect(grupos.map((g) => g.grupo.id)).toEqual(['estoque', 'voluntariado', 'crise', 'comunicacao', 'auditoria'])
    })

    it('só lista relatórios disponíveis (registrados), na ordem do catálogo', () => {
        const visiveis = relatoriosVisiveis('administrador', ['descartes', 'inventario'])
        expect(visiveis.map((r) => r.slug)).toEqual(['inventario', 'descartes'])
    })

    it('grupo sem relatório disponível não aparece', () => {
        const grupos = gruposVisiveisRelatorios('administrador', ['inventario'])
        expect(grupos.map((g) => g.grupo.id)).toEqual(['estoque'])
    })

    it('perfis sem acesso não veem nada', () => {
        expect(relatoriosVisiveis('coordenador', TODOS)).toEqual([])
        expect(gruposVisiveisRelatorios('coordenador', TODOS)).toEqual([])
    })
})
