import { beforeAll, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { redigirCamposSensiveis } from './redacao'

beforeAll(() => {
    process.env.DADOS_SENSIVEIS_CHAVE = randomBytes(32).toString('base64')
})

const PERFIL = {
    id: 'p-1',
    nomeCompleto: 'Ana Souza',
    cpf: '12345678901',
    cpfIndice: 'indice-qualquer',
    dataNascimento: '1990-03-15',
    cep: '89250000',
    telefone: '47999990000',
    status: 'pendente'
}

describe('redigirCamposSensiveis', () => {
    it('não deixa nenhum valor sensível em texto plano no snapshot (FR-026)', () => {
        const serializado = JSON.stringify(redigirCamposSensiveis(PERFIL))
        for (const valor of ['12345678901', '1990-03-15', '89250000', 'indice-qualquer']) {
            expect(serializado).not.toContain(valor)
        }
    })

    it('preserva os campos não sensíveis intactos — a trilha continua útil', () => {
        const r = redigirCamposSensiveis(PERFIL)!
        expect(r.nomeCompleto).toBe('Ana Souza')
        expect(r.telefone).toBe('47999990000')
        expect(r.status).toBe('pendente')
        expect(r.id).toBe('p-1')
    })

    it('redige também as chaves em snake_case, para linhas cruas do banco', () => {
        const r = redigirCamposSensiveis({ cpf_indice: 'x', data_nascimento: '1990-03-15' })!
        expect(JSON.stringify(r)).not.toContain('1990-03-15')
        expect(JSON.stringify(r)).not.toContain('"x"')
    })

    it('mantém a detecção de mudança: valores diferentes geram marcas diferentes', () => {
        const a = redigirCamposSensiveis({ cpf: '12345678901' })!
        const b = redigirCamposSensiveis({ cpf: '98765432100' })!
        expect(a.cpf).not.toBe(b.cpf)
    })

    it('mantém a estabilidade: o mesmo valor gera a mesma marca', () => {
        const a = redigirCamposSensiveis({ cpf: '12345678901' })!
        const b = redigirCamposSensiveis({ cpf: '12345678901' })!
        expect(a.cpf).toBe(b.cpf)
    })

    it('deixa nulo e vazio como estão — ausência de valor não é dado sensível', () => {
        const r = redigirCamposSensiveis({ cpf: null, cep: '', dataNascimento: undefined })!
        expect(r.cpf).toBeNull()
        expect(r.cep).toBe('')
        expect(r.dataNascimento).toBeUndefined()
    })

    it('devolve null para snapshot ausente', () => {
        expect(redigirCamposSensiveis(null)).toBeNull()
        expect(redigirCamposSensiveis(undefined)).toBeNull()
    })

    it('não muta o snapshot recebido', () => {
        const entrada = { cpf: '12345678901' }
        redigirCamposSensiveis(entrada)
        expect(entrada.cpf).toBe('12345678901')
    })
})
