import { describe, expect, it } from 'vitest'
import {
    estadoDoTurno,
    podeSeInscrever,
    turnosSobrepoem,
    validarDesistencia,
    validarInscricao,
    type EntradaValidarInscricao
} from './inscricao'

/**
 * 018-inscricao-atividades — regras puras de inscrição própria em turno
 * (research D4). `agora` é sempre injetado: nenhuma regra lê o relógio.
 */

/** 06/10/2026 em horário de Brasília — fuso explícito para a mensagem formatada não depender da máquina. */
const h = (hora: number, minuto = 0) =>
    new Date(`2026-10-06T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00-03:00`)
const TURNO = { inicio: h(8), fim: h(12), vagas: 5 }

function entrada(sobrescrever: Partial<EntradaValidarInscricao> = {}): EntradaValidarInscricao {
    return {
        turno: TURNO,
        atividadeAberta: true,
        confirmados: 2,
        jaInscrito: false,
        outrosTurnosDoParticipante: [],
        agora: h(6),
        ...sobrescrever
    }
}

describe('podeSeInscrever — elegibilidade (FR-011)', () => {
    it('equipe interna pode mesmo sem perfil de voluntário', () => {
        expect(podeSeInscrever({ equipeInterna: true, statusPerfil: null })).toBe(true)
    })

    it('equipe interna com perfil não aprovado continua podendo', () => {
        expect(podeSeInscrever({ equipeInterna: true, statusPerfil: 'pendente' })).toBe(true)
    })

    it('voluntário com perfil aprovado pode', () => {
        expect(podeSeInscrever({ equipeInterna: false, statusPerfil: 'aprovado' })).toBe(true)
    })

    it.each(['pendente', 'rejeitado', null] as const)('voluntário com perfil %s não pode', (status) => {
        expect(podeSeInscrever({ equipeInterna: false, statusPerfil: status })).toBe(false)
    })
})

describe('turnosSobrepoem — intervalos semiabertos [inicio, fim)', () => {
    it('sobreposição parcial conflita', () => {
        expect(turnosSobrepoem({ inicio: h(8), fim: h(12) }, { inicio: h(10), fim: h(14) })).toBe(true)
    })

    it('turno contido no outro conflita', () => {
        expect(turnosSobrepoem({ inicio: h(8), fim: h(16) }, { inicio: h(10), fim: h(12) })).toBe(true)
    })

    it('turnos encostados (08–12 e 12–16) não conflitam', () => {
        expect(turnosSobrepoem({ inicio: h(8), fim: h(12) }, { inicio: h(12), fim: h(16) })).toBe(false)
        expect(turnosSobrepoem({ inicio: h(12), fim: h(16) }, { inicio: h(8), fim: h(12) })).toBe(false)
    })
})

describe('validarInscricao — motivos de recusa (FR-014)', () => {
    function codigo(e: EntradaValidarInscricao) {
        const r = validarInscricao(e)
        return r.ok ? 'ok' : r.erro.codigo
    }

    it('aceita turno futuro com vaga', () => {
        expect(codigo(entrada())).toBe('ok')
    })

    it('recusa atividade que não está aberta', () => {
        const r = validarInscricao(entrada({ atividadeAberta: false }))
        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.erro.codigo).toBe('atividade_fechada')
        expect(r.erro.message).toBe('Esta atividade não está mais aberta para inscrições.')
    })

    it('recusa turno que começa exatamente agora', () => {
        expect(codigo(entrada({ agora: h(8) }))).toBe('turno_iniciado')
    })

    it('recusa turno já em andamento', () => {
        expect(codigo(entrada({ agora: h(9) }))).toBe('turno_iniciado')
    })

    it('recusa turno lotado', () => {
        const r = validarInscricao(entrada({ confirmados: 5 }))
        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.erro.codigo).toBe('lotado')
        expect(r.erro.message).toBe('Este turno acabou de ficar lotado.')
    })

    it('recusa turno que a gestão excedeu', () => {
        expect(codigo(entrada({ confirmados: 7 }))).toBe('lotado')
    })

    it('recusa quem já está inscrito — mesmo com o turno lotado', () => {
        expect(codigo(entrada({ jaInscrito: true }))).toBe('ja_inscrito')
        expect(codigo(entrada({ jaInscrito: true, confirmados: 5 }))).toBe('ja_inscrito')
    })

    it('recusa conflito de horário citando atividade e horário', () => {
        const r = validarInscricao(
            entrada({
                outrosTurnosDoParticipante: [{ titulo: 'Limpeza no Centro', inicio: h(10), fim: h(14) }]
            })
        )
        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.erro.codigo).toBe('conflito_horario')
        expect(r.erro.message).toContain('Limpeza no Centro')
        expect(r.erro.message).toContain('10:00')
        expect(r.erro.message).toContain('14:00')
    })

    it('turnos encostados do participante não são conflito', () => {
        expect(codigo(entrada({ outrosTurnosDoParticipante: [{ titulo: 'Outra', inicio: h(12), fim: h(16) }] }))).toBe(
            'ok'
        )
    })
})

describe('validarDesistencia — prazo de 30 minutos (FR-017/FR-018a)', () => {
    it('permite exatamente 30 minutos antes do início', () => {
        expect(validarDesistencia({ inicio: h(8), agora: h(7, 30) }).ok).toBe(true)
    })

    it('recusa 29min59s antes do início', () => {
        const agora = new Date(h(7, 30).getTime() + 1000)
        const r = validarDesistencia({ inicio: h(8), agora })
        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.erro.codigo).toBe('prazo_desistencia')
        expect(r.erro.message).toBe('Faltam menos de 30 minutos para o turno. Para desistir, fale com a coordenação.')
    })

    it('recusa turno já iniciado', () => {
        expect(validarDesistencia({ inicio: h(8), agora: h(9) }).ok).toBe(false)
    })
})

describe('estadoDoTurno — estado exibido na tela (FR-006)', () => {
    const base = { vagas: 10, preenchidas: 0, inicio: h(8), fim: h(12), inscrito: false, agora: h(6) }

    it('inscrito tem precedência sobre todos', () => {
        expect(estadoDoTurno({ ...base, inscrito: true, preenchidas: 10, agora: h(9) })).toBe('inscrito')
    })

    it('em andamento tem precedência sobre lotado', () => {
        expect(estadoDoTurno({ ...base, preenchidas: 10, agora: h(9) })).toBe('em_andamento')
    })

    it('lotado quando preenchidas ≥ vagas', () => {
        expect(estadoDoTurno({ ...base, preenchidas: 10 })).toBe('lotado')
        expect(estadoDoTurno({ ...base, preenchidas: 12 })).toBe('lotado')
    })

    it('últimas vagas quando restam até 20% (vagas = 10, restam 2)', () => {
        expect(estadoDoTurno({ ...base, preenchidas: 8 })).toBe('ultimas_vagas')
    })

    it('com vagas quando restam mais de 20% (vagas = 10, restam 3)', () => {
        expect(estadoDoTurno({ ...base, preenchidas: 7 })).toBe('com_vagas')
    })

    it('turno de 1 vaga vazio já é "últimas vagas"', () => {
        expect(estadoDoTurno({ ...base, vagas: 1, preenchidas: 0 })).toBe('ultimas_vagas')
    })
})
