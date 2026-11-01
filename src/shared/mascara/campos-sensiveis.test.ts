import { describe, expect, it } from 'vitest'
import { ROLES, type Role } from '@/src/shared/auth/roles'
import { CAMPOS_SENSIVEIS, type CampoSensivel, campoVisivelPara } from './campos-sensiveis'

/**
 * Espelho literal da Matriz de Visibilidade da spec (decisão Q2):
 * coordenador e administrador veem os três campos; o membro da defesa civil
 * vê apenas o CEP; usuário e voluntário não veem nada de terceiros.
 */
const MATRIZ: Record<CampoSensivel, readonly Role[]> = {
    cpf: ['coordenador', 'administrador'],
    dataNascimento: ['coordenador', 'administrador'],
    cep: ['membro_defesa_civil', 'coordenador', 'administrador']
}

describe('campoVisivelPara — dados de terceiros', () => {
    for (const campo of CAMPOS_SENSIVEIS) {
        for (const role of ROLES) {
            const esperado = MATRIZ[campo].includes(role)
            it(`${role} ${esperado ? 'VÊ' : 'não vê'} ${campo}`, () => {
                expect(campoVisivelPara(campo, role, false)).toBe(esperado)
            })
        }
    }
})

describe('campoVisivelPara — o titular vê os próprios dados (FR-019)', () => {
    for (const campo of CAMPOS_SENSIVEIS) {
        for (const role of ROLES) {
            it(`${role} vê o próprio ${campo}`, () => {
                expect(campoVisivelPara(campo, role, true)).toBe(true)
            })
        }
    }
})

describe('casos de borda da matriz', () => {
    it('o membro da defesa civil vê CEP mas NÃO vê CPF — a decisão é por campo (FR-015)', () => {
        expect(campoVisivelPara('cep', 'membro_defesa_civil', false)).toBe(true)
        expect(campoVisivelPara('cpf', 'membro_defesa_civil', false)).toBe(false)
    })

    it('recusa quando a role é desconhecida ou ausente', () => {
        expect(campoVisivelPara('cpf', undefined, false)).toBe(false)
    })

    it('declara exatamente os três campos de Q1', () => {
        expect([...CAMPOS_SENSIVEIS]).toEqual(['cpf', 'dataNascimento', 'cep'])
    })
})
