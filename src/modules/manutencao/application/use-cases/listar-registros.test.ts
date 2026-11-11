import { describe, expect, it } from 'vitest'
import { REGISTROS_SISTEMA } from '@/src/shared/kernel/registros-sistema'
import { MARCADOR } from '@/src/shared/mascara'
import { ListarRegistrosUseCase } from './listar-registros'
import { leitorFalso } from './testes/fakes'
import type { LeitorEsquema, PaginaRegistrosBrutos } from '../ports/leitor-esquema'

function leitorCom(pagina: PaginaRegistrosBrutos): LeitorEsquema {
    return { ...leitorFalso(), listarRegistros: async () => pagina }
}

describe('ListarRegistrosUseCase (C-02, US2)', () => {
    it('marca o registro padrão como do sistema', async () => {
        const uc = new ListarRegistrosUseCase({
            leitor: leitorCom({
                linhas: [
                    { chave: REGISTROS_SISTEMA.item, rotulo: 'Item removido', valores: { nome: 'Item removido' } },
                    { chave: 'outro', rotulo: 'Arroz', valores: { nome: 'Arroz' } }
                ],
                total: 2
            })
        })
        const r = await uc.executar({ tabela: 'item', page: 1, pageSize: 10 })
        expect(r.ok && r.valor.rows.map((l) => l.sistema)).toEqual([true, false])
    })

    it('mascara colunas sensíveis e nunca devolve credenciais', async () => {
        const uc = new ListarRegistrosUseCase({
            leitor: leitorCom({
                linhas: [
                    {
                        chave: 'p1',
                        rotulo: 'Ana',
                        valores: {
                            status: 'aprovado',
                            cpf: 'v1.cifrado',
                            cep: null,
                            data_nascimento: 'v1.x',
                            cpf_indice: 'hmac'
                        }
                    }
                ],
                total: 1
            })
        })
        const r = await uc.executar({ tabela: 'voluntario_perfil', page: 1, pageSize: 10 })
        expect(r.ok).toBe(true)
        if (!r.ok) return
        const [linha] = r.valor.rows
        expect(linha.valores.cpf).toMatch(new RegExp(`^${MARCADOR}+$`))
        expect(linha.valores.data_nascimento).toMatch(new RegExp(`^${MARCADOR}+$`))
        expect(linha.valores.cep).toBeNull()
        expect(linha.valores).not.toHaveProperty('cpf_indice')
        expect(linha.valores.status).toBe('aprovado')
        expect(r.valor.colunas).not.toContain('cpf_indice')
    })

    it('account nunca expõe senha nem tokens', async () => {
        const uc = new ListarRegistrosUseCase({
            leitor: leitorCom({
                linhas: [
                    {
                        chave: 'a1',
                        rotulo: 'Ana · credential',
                        valores: { provider_id: 'credential', password: 'hash' }
                    }
                ],
                total: 1
            })
        })
        const r = await uc.executar({ tabela: 'account', page: 1, pageSize: 10 })
        expect(r.ok && JSON.stringify(r.valor)).not.toContain('hash')
    })

    it('tabela fora do catálogo → tabela_desconhecida', async () => {
        const uc = new ListarRegistrosUseCase({ leitor: leitorCom({ linhas: [], total: 0 }) })
        const r = await uc.executar({ tabela: 'pg_shadow', page: 1, pageSize: 10 })
        expect(r.ok).toBe(false)
    })
})
