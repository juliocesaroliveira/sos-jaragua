import { describe, expect, it } from 'vitest'
import { diferencaAuditoria, resumoAlteracoes } from './diff-auditoria'

/**
 * Diferença antes/depois da trilha de auditoria (specs/023-central-relatorios,
 * US4, FR-021, research D9).
 *
 * É o que responde "qual era o valor antes?" — a pergunta que justifica a
 * trilha existir (BR-AUD-01). Fica no domínio para ser testável sem Mongo e
 * para a prévia e a planilha mostrarem exatamente a mesma diferença.
 */

describe('diferencaAuditoria', () => {
    it('criação: todos os campos como incluídos', () => {
        expect(diferencaAuditoria('create', null, { nome: 'Arroz', quantidade: 10 })).toEqual([
            { campo: 'nome', antes: null, depois: 'Arroz', tipo: 'incluido' },
            { campo: 'quantidade', antes: null, depois: '10', tipo: 'incluido' }
        ])
    })

    it('exclusão: todos os campos como removidos', () => {
        expect(diferencaAuditoria('delete', { nome: 'Arroz', ativo: true }, null)).toEqual([
            { campo: 'nome', antes: 'Arroz', depois: null, tipo: 'removido' },
            { campo: 'ativo', antes: 'true', depois: null, tipo: 'removido' }
        ])
    })

    it('alteração: só os campos que mudaram, inclusive campo que surgiu ou sumiu', () => {
        const antes = { nome: 'Arroz', status: 'pendente', motivo: 'x', cpf: '123' }
        const depois = { nome: 'Arroz', status: 'aprovado', cpf: '123', aprovadoEm: '2026-10-08' }

        expect(diferencaAuditoria('update', antes, depois)).toEqual([
            { campo: 'status', antes: 'pendente', depois: 'aprovado', tipo: 'alterado' },
            { campo: 'motivo', antes: 'x', depois: null, tipo: 'removido' },
            { campo: 'aprovadoEm', antes: null, depois: '2026-10-08', tipo: 'incluido' }
        ])
    })

    it('compara valores aninhados e datas pelo conteúdo, não pela referência', () => {
        const antes = {
            disponibilidade: ['manha', 'tarde'],
            receita: { arroz: 2 },
            criadoEm: new Date('2026-10-01T12:00:00Z')
        }
        const depois = {
            disponibilidade: ['manha', 'tarde'],
            receita: { arroz: 3 },
            criadoEm: new Date('2026-10-01T12:00:00Z')
        }

        expect(diferencaAuditoria('update', antes, depois)).toEqual([
            { campo: 'receita', antes: '{"arroz":2}', depois: '{"arroz":3}', tipo: 'alterado' }
        ])
    })

    it('datas são serializadas em ISO', () => {
        expect(diferencaAuditoria('create', null, { quando: new Date('2026-10-01T12:00:00Z') })).toEqual([
            { campo: 'quando', antes: null, depois: '2026-10-01T12:00:00.000Z', tipo: 'incluido' }
        ])
    })

    it('null e ausente são o mesmo valor: sem diferença', () => {
        expect(diferencaAuditoria('update', { motivo: null }, {})).toEqual([])
    })

    it('alteração sem snapshots não quebra', () => {
        expect(diferencaAuditoria('update', null, null)).toEqual([])
    })
})

describe('resumoAlteracoes', () => {
    it('uma linha só, para a coluna "Alterações" da planilha', () => {
        expect(
            resumoAlteracoes([
                { campo: 'status', antes: 'pendente', depois: 'aprovado', tipo: 'alterado' },
                { campo: 'motivo', antes: 'x', depois: null, tipo: 'removido' },
                { campo: 'aprovadoEm', antes: null, depois: '2026-10-08', tipo: 'incluido' }
            ])
        ).toBe('status: pendente → aprovado; motivo: x → —; aprovadoEm: — → 2026-10-08')
    })

    it('criação lista os valores gravados', () => {
        expect(resumoAlteracoes(diferencaAuditoria('create', null, { nome: 'Arroz' }))).toBe('nome: Arroz')
    })

    it('exclusão lista os valores que existiam', () => {
        expect(resumoAlteracoes(diferencaAuditoria('delete', { nome: 'Arroz' }, null))).toBe('nome: Arroz')
    })

    it('sem alterações, vazio', () => {
        expect(resumoAlteracoes([])).toBe('')
    })
})
