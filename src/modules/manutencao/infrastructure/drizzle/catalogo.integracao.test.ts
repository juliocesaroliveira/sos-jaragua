import { describe, expect, it } from 'vitest'
import { CATALOGO } from '../../domain/catalogo'
import { conferirCatalogo } from '../../domain/conferir-catalogo'
import { criarLeitorEsquema } from './leitor-esquema'

/**
 * Catálogo × banco real (026, research D2, FR-013a).
 *
 * É o teste que quebra o CI quando uma migração acrescenta uma FK sem
 * classificá-la em `domain/catalogo.ts`. Em produção a mesma divergência só
 * bloquearia as ações das tabelas envolvidas — aqui ela impede o merge.
 */
describe('catálogo da Danger Zone confere com o Postgres', () => {
    it('nenhuma tabela bloqueada', async () => {
        const fks = await criarLeitorEsquema().fksFisicas()
        const { divergencias } = conferirCatalogo(CATALOGO, fks)
        expect(divergencias).toEqual([])
    })

    it('todas as tabelas do catálogo existem e são contáveis', async () => {
        const contagens = await criarLeitorEsquema().contagens(CATALOGO.tabelas.map((t) => t.nome))
        expect(Object.keys(contagens).sort()).toEqual(CATALOGO.tabelas.map((t) => t.nome).sort())
    })
})
