import { describe, expect, it } from 'vitest'
import { REGISTRO_SISTEMA_POR_TABELA } from '@/src/shared/kernel/registros-sistema'
import { CATALOGO, tabelaDoCatalogo, vinculosDoCatalogo } from './catalogo'

describe('catálogo da Danger Zone (research D3, data-model §1)', () => {
    it('cobre as 26 tabelas do schema físico', () => {
        expect(CATALOGO.tabelas).toHaveLength(26)
        expect(new Set(CATALOGO.tabelas.map((t) => t.nome)).size).toBe(26)
    })

    it('classifica os 30 vínculos, cada um uma única vez', () => {
        expect(CATALOGO.vinculos).toHaveLength(30)
        const chaves = CATALOGO.vinculos.map((v) => `${v.filho}.${v.coluna}`)
        expect(new Set(chaves).size).toBe(30)
    })

    it('todo vínculo liga tabelas que existem no catálogo', () => {
        for (const v of CATALOGO.vinculos) {
            expect(tabelaDoCatalogo(v.filho), `${v.filho}`).toBeDefined()
            expect(tabelaDoCatalogo(v.pai), `${v.pai}`).toBeDefined()
        }
    })

    it('vínculo histórico obrigatório só aponta para tabela com registro padrão (FR-012a)', () => {
        const destinos = new Set(
            CATALOGO.vinculos.filter((v) => v.classificacao === 'historico' && v.obrigatorio).map((v) => v.pai)
        )
        expect([...destinos].sort()).toEqual(['atividade_categoria', 'item', 'user'])
        for (const destino of destinos) expect(REGISTRO_SISTEMA_POR_TABELA[destino]).toBeDefined()
    })

    it('nenhuma tabela exibe coluna de credencial nem coluna sensível fora da lista de sensíveis', () => {
        for (const t of CATALOGO.tabelas) {
            for (const c of t.colunasCredencial) expect(t.colunasExibidas, `${t.nome}.${c}`).not.toContain(c)
        }
        const conta = tabelaDoCatalogo('account')!
        expect(conta.colunasCredencial).toEqual(
            expect.arrayContaining(['password', 'access_token', 'refresh_token', 'id_token'])
        )
        expect(tabelaDoCatalogo('session')!.colunasCredencial).toContain('token')
        expect(tabelaDoCatalogo('verification')!.colunasCredencial).toContain('value')
    })

    it('toda tabela tem rótulo pt-BR, área e rótulo de registro', () => {
        for (const t of CATALOGO.tabelas) {
            expect(t.rotulo.length, t.nome).toBeGreaterThan(0)
            expect(t.area, t.nome).toBeTruthy()
            expect(t.rotuloRegistro.colunas.length, t.nome).toBeGreaterThan(0)
            expect(t.chavePrimaria.length, t.nome).toBeGreaterThan(0)
        }
    })

    it('rótulo herdado do pai usa um vínculo declarado', () => {
        for (const t of CATALOGO.tabelas) {
            const pai = t.rotuloRegistro.pai
            if (!pai) continue
            const vinculo = vinculosDoCatalogo().find((v) => v.filho === t.nome && v.coluna === pai.coluna)
            expect(vinculo, `${t.nome}.${pai.coluna}`).toBeDefined()
        }
    })

    it('alocações e notificações de um usuário são histórico; sessões e perfil são inseparáveis', () => {
        const de = (filho: string, coluna: string) =>
            CATALOGO.vinculos.find((v) => v.filho === filho && v.coluna === coluna)?.classificacao
        expect(de('alocacao', 'participante_user_id')).toBe('historico')
        expect(de('notificacao', 'destinatario_user_id')).toBe('historico')
        expect(de('session', 'user_id')).toBe('inseparavel')
        expect(de('voluntario_perfil', 'user_id')).toBe('inseparavel')
        expect(de('turno', 'atividade_id')).toBe('inseparavel')
    })
})
