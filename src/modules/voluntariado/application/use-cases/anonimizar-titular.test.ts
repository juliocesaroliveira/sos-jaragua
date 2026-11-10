import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImpactoExclusao, UnidadeDeTrabalho, VoluntarioRepository } from '../ports/voluntario-repository'
import { AnonimizarTitularUseCase } from './anonimizar-titular'

const auditorias: unknown[] = []

vi.mock('@/src/modules/auditoria', () => ({
    withAudit: async <T>(opcoes: { extrair: (r: T) => unknown }, fn: () => Promise<T>) => {
        const r = await fn()
        auditorias.push(opcoes.extrair(r))
        return r
    }
}))

const IMPACTO: ImpactoExclusao = {
    turnosFuturosConfirmados: 2,
    turnosPassados: 7,
    temPerfilVoluntario: true,
    jaAnonimizado: false
}

function montar(impacto: Partial<ImpactoExclusao> = {}) {
    const anonimizarPerfil = vi.fn().mockResolvedValue({ perfilId: 'p-1' })
    const anonimizarConta = vi.fn().mockResolvedValue(undefined)
    const leitura = {
        impactoDaExclusao: vi.fn().mockResolvedValue({ ...IMPACTO, ...impacto })
    } as unknown as VoluntarioRepository
    const uow: UnidadeDeTrabalho = {
        executar: (fn) =>
            fn({
                voluntarios: { anonimizarPerfil } as unknown as never,
                usuarios: { anonimizarConta } as unknown as never
            })
    }
    return { caso: new AnonimizarTitularUseCase(uow, leitura), anonimizarPerfil, anonimizarConta }
}

const TITULAR = { titular: { userId: 'u-1', role: 'voluntario' as const } }

beforeEach(() => {
    auditorias.length = 0
})

describe('impacto antes da confirmação (FR-021)', () => {
    it('devolve os números que a confirmação precisa mostrar', async () => {
        const { caso } = montar()
        expect(await caso.impacto('u-1')).toMatchObject({
            turnosFuturosConfirmados: 2,
            turnosPassados: 7,
            temPerfilVoluntario: true
        })
    })
})

describe('anonimização (FR-022, FR-023)', () => {
    it('anonimiza perfil e conta na mesma unidade de trabalho', async () => {
        const { caso, anonimizarPerfil, anonimizarConta } = montar()
        expect(await caso.executar(TITULAR)).toEqual({ ok: true, jaAnonimizado: false })
        expect(anonimizarPerfil).toHaveBeenCalledWith('u-1')
        expect(anonimizarConta).toHaveBeenCalledWith('u-1')
    })

    it('conclui para titular sem perfil de voluntário — conta sem cadastro não é erro', async () => {
        const { caso, anonimizarConta } = montar({ temPerfilVoluntario: false })
        expect(await caso.executar(TITULAR)).toEqual({ ok: true, jaAnonimizado: false })
        expect(anonimizarConta).toHaveBeenCalledWith('u-1')
    })
})

describe('idempotência (FR-025, FR-030)', () => {
    it('segunda solicitação conclui sem erro e sem efeito colateral', async () => {
        const { caso, anonimizarPerfil, anonimizarConta } = montar({ jaAnonimizado: true })

        expect(await caso.executar(TITULAR)).toEqual({ ok: true, jaAnonimizado: true })
        expect(anonimizarPerfil).not.toHaveBeenCalled()
        expect(anonimizarConta).not.toHaveBeenCalled()
        expect(auditorias).toHaveLength(0)
    })
})

describe('auditoria da eliminação (FR-024, FR-029, SC-004)', () => {
    it('registra o pedido com o alcance, sem reproduzir dado pessoal', async () => {
        const { caso } = montar()
        await caso.executar(TITULAR)

        expect(auditorias).toHaveLength(1)
        expect(auditorias[0]).toMatchObject({
            entidadeId: 'p-1',
            dadosNovos: {
                turnosFuturosCancelados: 2,
                turnosPassadosPreservados: 7,
                tinhaPerfilVoluntario: true
            }
        })
    })

    it('não reintroduz na trilha os dados que acabou de eliminar (FR-029)', async () => {
        const { caso } = montar()
        await caso.executar(TITULAR)

        const serializado = JSON.stringify(auditorias)
        // Nenhum snapshot de "antes": seria exatamente o dado eliminado.
        expect(serializado).not.toContain('cpf')
        expect(serializado).not.toContain('nomeCompleto')
    })
})
