import { describe, expect, it } from 'vitest'
import type { Catalogo } from './catalogo'
import { conferirCatalogo, type FkFisica } from './conferir-catalogo'

const tabela = (nome: string) => ({
    nome,
    rotulo: nome,
    area: 'estoque' as const,
    chavePrimaria: ['id'],
    rotuloRegistro: { colunas: ['id'] },
    colunasExibidas: ['id'],
    colunasSensiveis: [],
    colunasCredencial: []
})

const catalogo: Catalogo = {
    tabelas: [tabela('pai'), tabela('filho'), tabela('outro')],
    vinculos: [
        {
            filho: 'filho',
            coluna: 'pai_id',
            pai: 'pai',
            obrigatorio: true,
            regraBanco: 'cascade',
            classificacao: 'inseparavel'
        }
    ]
}

const fkIgual: FkFisica = { filho: 'filho', coluna: 'pai_id', pai: 'pai', regraBanco: 'cascade', obrigatorio: true }

describe('conferirCatalogo (FR-013a, research D2)', () => {
    it('catálogo igual ao banco não bloqueia nada', () => {
        const r = conferirCatalogo(catalogo, [fkIgual])
        expect(r.tabelasBloqueadas.size).toBe(0)
        expect(r.divergencias).toEqual([])
    })

    it('FK física ausente do catálogo bloqueia as duas tabelas ligadas', () => {
        const nova: FkFisica = {
            filho: 'outro',
            coluna: 'pai_id',
            pai: 'pai',
            regraBanco: 'restrict',
            obrigatorio: true
        }
        const r = conferirCatalogo(catalogo, [fkIgual, nova])
        expect([...r.tabelasBloqueadas.keys()].sort()).toEqual(['outro', 'pai'])
        expect(r.tabelasBloqueadas.get('outro')).toEqual(['outro.pai_id → pai'])
        expect(r.tabelasBloqueadas.has('filho')).toBe(false)
    })

    it('vínculo do catálogo sem FK física bloqueia', () => {
        const r = conferirCatalogo(catalogo, [])
        expect([...r.tabelasBloqueadas.keys()].sort()).toEqual(['filho', 'pai'])
    })

    it('obrigatoriedade ou regra divergentes bloqueiam', () => {
        expect(conferirCatalogo(catalogo, [{ ...fkIgual, obrigatorio: false }]).tabelasBloqueadas.size).toBe(2)
        expect(conferirCatalogo(catalogo, [{ ...fkIgual, regraBanco: 'restrict' }]).tabelasBloqueadas.size).toBe(2)
    })

    it('FK de tabela fora do catálogo apontando para tabela do catálogo bloqueia o pai', () => {
        const r = conferirCatalogo(catalogo, [
            fkIgual,
            { filho: 'tabela_nova', coluna: 'pai_id', pai: 'pai', regraBanco: 'cascade', obrigatorio: true }
        ])
        expect([...r.tabelasBloqueadas.keys()].sort()).toEqual(['pai', 'tabela_nova'])
    })
})
