import { describe, expect, it } from 'vitest'
import { fimDoTurno, gerarTurnosConsecutivos, validarTurno } from './turno'

/**
 * TEST-02 — BR-VOL-04: a atividade é fragmentada em turnos de **4 horas**.
 *
 * A regra vive no domínio e não como `CHECK` de banco (DESIGN.md §10.2)
 * justamente para poder ser testada assim, sem subir Postgres.
 */
const INICIO = new Date(2026, 7, 10, 8, 0) // 10/08/2026 08:00 local

describe('validarTurno — bloco de 4 horas', () => {
    it('aceita exatamente 4 horas', () => {
        const r = validarTurno({ inicio: INICIO, fim: new Date(2026, 7, 10, 12, 0), vagas: 5 })
        expect(r.ok).toBe(true)
    })

    it('rejeita bloco menor que 4 horas com mensagem específica', () => {
        const r = validarTurno({ inicio: INICIO, fim: new Date(2026, 7, 10, 11, 0), vagas: 5 })
        expect(r.ok).toBe(false)
        if (r.ok) return

        const campos = r.erro.detalhes?.campos as Record<string, string>
        // A mensagem precisa dizer quanto o turno tem — genérico não ajuda quem
        // está montando escala às pressas.
        expect(campos.fim).toContain('4 horas')
        expect(campos.fim).toContain('3h')
    })

    it('rejeita bloco maior que 4 horas', () => {
        const r = validarTurno({ inicio: INICIO, fim: new Date(2026, 7, 10, 14, 0), vagas: 5 })
        expect(r.ok).toBe(false)
    })

    it('rejeita fim anterior ao início', () => {
        const r = validarTurno({ inicio: INICIO, fim: new Date(2026, 7, 10, 6, 0), vagas: 5 })
        expect(r.ok).toBe(false)
        if (r.ok) return
        const campos = r.erro.detalhes?.campos as Record<string, string>
        expect(campos.fim).toContain('depois do início')
    })

    it('rejeita vagas não positivas ou fracionárias', () => {
        for (const vagas of [0, -3, 2.5]) {
            const r = validarTurno({ inicio: INICIO, fim: new Date(2026, 7, 10, 12, 0), vagas })
            expect(r.ok, `vagas=${vagas}`).toBe(false)
        }
    })

    it('acumula erros de duração e de vagas na mesma resposta', () => {
        const r = validarTurno({ inicio: INICIO, fim: new Date(2026, 7, 10, 9, 0), vagas: 0 })
        expect(r.ok).toBe(false)
        if (r.ok) return
        const campos = r.erro.detalhes?.campos as Record<string, string>
        expect(Object.keys(campos).sort()).toEqual(['fim', 'vagas'])
    })
})

describe('gerarTurnosConsecutivos', () => {
    it('encadeia turnos sem buraco nem sobreposição', () => {
        const turnos = gerarTurnosConsecutivos(INICIO, 3, 5)

        expect(turnos).toHaveLength(3)
        expect(turnos[0].inicio).toEqual(INICIO)
        expect(turnos[0].fim).toEqual(new Date(2026, 7, 10, 12, 0))
        // O fim de um turno é exatamente o início do próximo.
        expect(turnos[1].inicio).toEqual(turnos[0].fim)
        expect(turnos[2].fim).toEqual(new Date(2026, 7, 10, 20, 0))
    })

    it('gera turnos que passam na própria validação', () => {
        for (const turno of gerarTurnosConsecutivos(INICIO, 6, 3)) {
            expect(validarTurno(turno).ok).toBe(true)
        }
    })

    it('atravessa a virada do dia corretamente', () => {
        const noite = new Date(2026, 7, 10, 22, 0)
        const [primeiro, segundo] = gerarTurnosConsecutivos(noite, 2, 4)
        expect(primeiro.fim).toEqual(new Date(2026, 7, 11, 2, 0))
        expect(segundo.fim).toEqual(new Date(2026, 7, 11, 6, 0))
    })

    it('fimDoTurno soma 4 horas', () => {
        expect(fimDoTurno(INICIO)).toEqual(new Date(2026, 7, 10, 12, 0))
    })
})
