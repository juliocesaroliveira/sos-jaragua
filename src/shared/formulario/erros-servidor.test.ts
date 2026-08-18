import { describe, expect, it } from 'vitest'
import { aplicarErrosDoServidor } from './erros-servidor'
import type { DomainErrorPlano } from '../kernel/result'

/**
 * Contrato em specs/016-formularios-rhf-zod/contracts/componentes-formulario.md §3.
 * O `definirErro` é injetado, então o comportamento inteiro é verificável sem
 * DOM e sem react-hook-form.
 */
function coletor() {
    const aplicados: Record<string, string> = {}
    return {
        aplicados,
        definirErro: (campo: string, mensagem: string) => {
            aplicados[campo] = mensagem
        }
    }
}

describe('aplicarErrosDoServidor', () => {
    it('leva cada mensagem ao seu campo quando todos são conhecidos', () => {
        const { aplicados, definirErro } = coletor()
        const erro: DomainErrorPlano = {
            codigo: 'validacao',
            mensagem: 'Dados inválidos.',
            detalhes: { campos: { cpf: 'CPF inválido.', email: 'E-mail já cadastrado.' } }
        }

        const { mensagemGeral } = aplicarErrosDoServidor({
            erro,
            camposConhecidos: ['cpf', 'email', 'nome'],
            definirErro
        })

        expect(aplicados).toEqual({ cpf: 'CPF inválido.', email: 'E-mail já cadastrado.' })
        // Tudo coube nos campos: nada sobra para o aviso geral.
        expect(mensagemGeral).toBeNull()
    })

    it('agrega ao erro geral a mensagem de campo que o formulário não conhece', () => {
        const { aplicados, definirErro } = coletor()
        const erro: DomainErrorPlano = {
            codigo: 'validacao',
            mensagem: 'Dados inválidos.',
            detalhes: { campos: { cpf: 'CPF inválido.', turnoId: 'Turno não disponível.' } }
        }

        const { mensagemGeral } = aplicarErrosDoServidor({
            erro,
            camposConhecidos: ['cpf'],
            definirErro
        })

        expect(aplicados).toEqual({ cpf: 'CPF inválido.' })
        // A órfã não pode sumir: sem isto o envio seria recusado sem nada na tela.
        expect(mensagemGeral).toBe('Dados inválidos. Turno não disponível.')
    })

    it('devolve apenas a mensagem geral quando o erro não traz campos', () => {
        const { aplicados, definirErro } = coletor()
        const erro: DomainErrorPlano = { codigo: 'indisponivel', mensagem: 'Serviço indisponível.' }

        const { mensagemGeral } = aplicarErrosDoServidor({
            erro,
            camposConhecidos: ['cpf'],
            definirErro
        })

        expect(aplicados).toEqual({})
        expect(mensagemGeral).toBe('Serviço indisponível.')
    })

    it('trata `detalhes.campos` vazio como erro sem campos', () => {
        const { definirErro } = coletor()
        const erro: DomainErrorPlano = {
            codigo: 'validacao',
            mensagem: 'Dados inválidos.',
            detalhes: { campos: {} }
        }

        const { mensagemGeral } = aplicarErrosDoServidor({ erro, camposConhecidos: ['cpf'], definirErro })

        expect(mensagemGeral).toBe('Dados inválidos.')
    })
})
