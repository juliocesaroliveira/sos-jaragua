import { describe, expect, it } from 'vitest'
import { diaDoTurno, filtrarAtividadesAbertas } from './filtros-atividades-abertas'
import { montarVitrine, type AtividadeNaVitrine } from './vitrine-atividades-abertas'
import type { AtividadeAberta } from './queries/atividades'

/** 018-inscricao-atividades — montagem da vitrine (FR-006/FR-007) e filtros (US5). */

const iso = (dia: number, hora: number, minuto = 0) =>
    new Date(
        `2026-10-${String(dia).padStart(2, '0')}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00-03:00`
    ).toISOString()

function atividade(id: string, categoriaId: string, turnos: AtividadeAberta['turnos']): AtividadeAberta {
    return { id, titulo: `Atividade ${id}`, categoriaId, categoria: categoriaId, local: 'Centro', turnos }
}

const turno = (id: string, dia: number, hora: number, vagas = 5, preenchidas = 0) => ({
    id,
    inicio: iso(dia, hora),
    fim: iso(dia, hora + 4),
    vagas,
    preenchidas
})

describe('montarVitrine', () => {
    const agora = new Date(iso(6, 6))

    it('descarta turnos terminados e atividades que ficam sem turno', () => {
        const vitrine = montarVitrine(
            [
                atividade('a', 'c1', [turno('velho', 5, 8), turno('novo', 6, 8)]),
                atividade('b', 'c1', [turno('x', 5, 8)])
            ],
            [],
            agora
        )
        expect(vitrine.map((a) => a.id)).toEqual(['a'])
        expect(vitrine[0].turnos.map((t) => t.id)).toEqual(['novo'])
    })

    it('ordena atividades pelo turno mais próximo (FR-007)', () => {
        const vitrine = montarVitrine(
            [atividade('tarde', 'c1', [turno('t2', 6, 14)]), atividade('manha', 'c1', [turno('t1', 6, 8)])],
            [],
            agora
        )
        expect(vitrine.map((a) => a.id)).toEqual(['manha', 'tarde'])
    })

    it('marca inscrito, guarda a alocação e calcula o prazo de desistência', () => {
        const meus = [{ turnoId: 't1', alocacaoId: 'aloc', atividadeId: 'a', inicio: iso(6, 8), fim: iso(6, 12) }]
        const longe = montarVitrine([atividade('a', 'c1', [turno('t1', 6, 8)])], meus, agora)[0].turnos[0]
        expect(longe).toMatchObject({ estado: 'inscrito', alocacaoId: 'aloc', podeDesistir: true })

        const perto = montarVitrine([atividade('a', 'c1', [turno('t1', 6, 8)])], meus, new Date(iso(6, 7, 45)))[0]
            .turnos[0]
        expect(perto.podeDesistir).toBe(false)
    })

    it('calcula o estado de quem não está inscrito', () => {
        const vitrine = montarVitrine(
            [atividade('a', 'c1', [turno('lotado', 6, 8, 5, 5), turno('livre', 6, 12, 10, 0)])],
            [],
            agora
        )
        expect(vitrine[0].turnos.map((t) => t.estado)).toEqual(['lotado', 'com_vagas'])
    })
})

describe('filtrarAtividadesAbertas', () => {
    const agora = new Date(iso(6, 6))
    const meus = [
        { turnoId: 'inscritoLotado', alocacaoId: 'aloc', atividadeId: 'a', inicio: iso(6, 8), fim: iso(6, 12) }
    ]
    const vitrine: AtividadeNaVitrine[] = montarVitrine(
        [
            atividade('a', 'limpeza', [turno('inscritoLotado', 6, 8, 2, 2), turno('lotado', 7, 8, 2, 2)]),
            atividade('b', 'doacoes', [turno('livre', 7, 12)])
        ],
        meus,
        agora
    )

    it('sem filtros devolve tudo', () => {
        expect(filtrarAtividadesAbertas(vitrine, { somenteComVagas: false })).toEqual(vitrine)
    })

    it('filtra por categoria', () => {
        expect(
            filtrarAtividadesAbertas(vitrine, { categoriaId: 'doacoes', somenteComVagas: false }).map((a) => a.id)
        ).toEqual(['b'])
    })

    it('filtra por dia em horário de Brasília', () => {
        const r = filtrarAtividadesAbertas(vitrine, { dia: '2026-10-07', somenteComVagas: false })
        expect(r.flatMap((a) => a.turnos.map((t) => t.id))).toEqual(['lotado', 'livre'])
    })

    it('"somente com vagas" esconde lotados mas mantém o turno inscrito', () => {
        const r = filtrarAtividadesAbertas(vitrine, { somenteComVagas: true })
        expect(r.flatMap((a) => a.turnos.map((t) => t.id))).toEqual(['inscritoLotado', 'livre'])
    })

    it('atividade que fica sem turno some', () => {
        const r = filtrarAtividadesAbertas(vitrine, {
            dia: '2026-10-06',
            categoriaId: 'doacoes',
            somenteComVagas: false
        })
        expect(r).toEqual([])
    })

    it('diaDoTurno usa o fuso de Brasília, não UTC', () => {
        // 22h em Brasília já é dia seguinte em UTC.
        expect(diaDoTurno(iso(6, 22))).toBe('2026-10-06')
    })
})
