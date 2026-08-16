import { describe, expect, it } from 'vitest'
import { camposComErro } from '@/src/shared/kernel'
import { resolverDataNascimento, validarCandidatura, type DadosCandidatura } from './candidatura'

/**
 * `resolverDataNascimento` é a regra que implementa FR-017 no servidor
 * (011-auto-cadastro-provedor, data-model.md R1).
 *
 * Ela existe porque o campo desabilitado no navegador **não é enforcement**: a
 * Server Action é um POST alcançável fora da navegação normal, e o valor que
 * chega no corpo pode ter sido forjado. A conta é a autoridade.
 */

const HOJE = new Date('2026-08-16T12:00:00Z')

const BASE: DadosCandidatura = {
    nomeCompleto: 'Fulano de Tal',
    dataNascimento: '1990-05-20',
    cpf: '52998224725',
    telefone: '47999998888',
    cep: '89250000',
    bairro: 'Centro',
    profissao: 'Enfermeiro',
    restricoesSaude: null,
    veiculoProprio: false,
    tipoVeiculo: null,
    disponibilidade: ['integral'],
    habilidadeIds: []
}

describe('resolverDataNascimento', () => {
    it('usa a data da conta e descarta a do formulário quando a conta já tem o valor', () => {
        expect(resolverDataNascimento('1990-05-20', '2005-01-01')).toBe('1990-05-20')
    })

    it('usa a data do formulário quando a conta ainda não tem o valor', () => {
        expect(resolverDataNascimento(null, '1990-05-20')).toBe('1990-05-20')
    })

    it('devolve indefinido quando nem a conta nem o formulário têm data', () => {
        expect(resolverDataNascimento(null, undefined)).toBeUndefined()
    })

    it('ignora string vazia vinda do formulário, tratando-a como ausência', () => {
        expect(resolverDataNascimento(null, '')).toBeUndefined()
    })

    it('prevalece sobre o formulário mesmo quando o valor da conta é o de um menor de idade', () => {
        // O pré-preenchimento não pode virar uma via para contornar a
        // maioridade: quem forja uma data adulta no POST continua sendo
        // avaliado pela data real da conta.
        expect(resolverDataNascimento('2015-01-01', '1990-05-20')).toBe('2015-01-01')
    })
})

describe('validarCandidatura com data resolvida da conta', () => {
    it('reprova por maioridade quando a data da conta é de menor de idade', () => {
        const dataFinal = resolverDataNascimento('2015-01-01', '1990-05-20')
        const resultado = validarCandidatura({ ...BASE, dataNascimento: dataFinal ?? '' }, HOJE)

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(camposComErro(resultado.erro.paraObjeto()).dataNascimento).toBe(
            'É necessário ter 18 anos ou mais para se candidatar.'
        )
    })

    it('exige a data quando nem a conta nem o formulário a informaram', () => {
        const dataFinal = resolverDataNascimento(null, undefined)
        const resultado = validarCandidatura({ ...BASE, dataNascimento: dataFinal ?? '' }, HOJE)

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(camposComErro(resultado.erro.paraObjeto()).dataNascimento).toBe('Informe a data de nascimento.')
    })

    it('aprova quando a data da conta é de maior de idade', () => {
        const dataFinal = resolverDataNascimento('1990-05-20', undefined)
        const resultado = validarCandidatura({ ...BASE, dataNascimento: dataFinal ?? '' }, HOJE)

        expect(resultado.ok).toBe(true)
        if (!resultado.ok) return
        expect(resultado.valor.dataNascimento).toBe('1990-05-20')
    })
})
