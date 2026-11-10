import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ValorIlegivelError } from '@/src/shared/cripto/erros'
import type { DadosSensiveisPerfil, VoluntarioRepository } from '../ports/voluntario-repository'
import { RevelarDadoSensivelUseCase } from './revelar-dado-sensivel'

const auditorias: unknown[] = []
let falharAuditoria = false

vi.mock('@/src/modules/auditoria', () => ({
    withAudit: async <T>(opcoes: { extrair: (r: T) => unknown }, fn: () => Promise<T>) => {
        const r = await fn()
        if (falharAuditoria) throw new Error('mongo indisponível')
        auditorias.push(opcoes.extrair(r))
        return r
    }
}))

const DADOS: DadosSensiveisPerfil = {
    userId: 'u-titular',
    cpf: '11144477735',
    dataNascimento: '1990-03-15',
    cep: '89250000',
    anonimizadoEm: null
}

function repo(sobrepor: Partial<VoluntarioRepository> = {}): VoluntarioRepository {
    return {
        buscarPorCpf: vi.fn(),
        buscarPorId: vi.fn(),
        buscarPorUserId: vi.fn(),
        buscarDadosSensiveis: vi.fn().mockResolvedValue(DADOS),
        salvarCandidatura: vi.fn(),
        aprovar: vi.fn(),
        rejeitar: vi.fn(),
        ...sobrepor
    } as unknown as VoluntarioRepository
}

beforeEach(() => {
    auditorias.length = 0
    falharAuditoria = false
})

describe('Matriz de Visibilidade (FR-015)', () => {
    it('coordenador revela o CPF', async () => {
        const r = await new RevelarDadoSensivelUseCase(repo()).executar({
            perfilId: 'p-1',
            campo: 'cpf',
            ator: { userId: 'u-coord', role: 'coordenador' }
        })
        expect(r).toEqual({ ok: true, valor: '11144477735' })
    })

    it('membro da defesa civil revela o CEP mas é recusado no CPF — decisão por campo', async () => {
        const caso = new RevelarDadoSensivelUseCase(repo())
        const ator = { userId: 'u-dc', role: 'membro_defesa_civil' as const }

        expect(await caso.executar({ perfilId: 'p-1', campo: 'cep', ator })).toEqual({
            ok: true,
            valor: '89250000'
        })
        expect(await caso.executar({ perfilId: 'p-1', campo: 'cpf', ator })).toEqual({
            ok: false,
            erro: 'sem_permissao'
        })
    })

    it('voluntário é recusado nos dados de terceiros', async () => {
        const r = await new RevelarDadoSensivelUseCase(repo()).executar({
            perfilId: 'p-1',
            campo: 'cpf',
            ator: { userId: 'u-outro', role: 'voluntario' }
        })
        expect(r).toEqual({ ok: false, erro: 'sem_permissao' })
    })

    it('o titular revela os próprios dados, qualquer que seja a role (FR-019)', async () => {
        const r = await new RevelarDadoSensivelUseCase(repo()).executar({
            perfilId: 'p-1',
            campo: 'cpf',
            ator: { userId: 'u-titular', role: 'usuario' }
        })
        expect(r).toEqual({ ok: true, valor: '11144477735' })
    })
})

describe('falhas', () => {
    it('devolve "ilegivel" quando a decifragem falha (FR-014)', async () => {
        const r = await new RevelarDadoSensivelUseCase(
            repo({ buscarDadosSensiveis: vi.fn().mockRejectedValue(new ValorIlegivelError('chave não confere')) })
        ).executar({ perfilId: 'p-1', campo: 'cpf', ator: { userId: 'u-c', role: 'coordenador' } })

        expect(r).toEqual({ ok: false, erro: 'ilegivel' })
    })

    it('devolve "nao_encontrado" para perfil inexistente', async () => {
        const r = await new RevelarDadoSensivelUseCase(
            repo({ buscarDadosSensiveis: vi.fn().mockResolvedValue(null) })
        ).executar({ perfilId: 'p-x', campo: 'cpf', ator: { userId: 'u-c', role: 'coordenador' } })

        expect(r).toEqual({ ok: false, erro: 'nao_encontrado' })
    })

    it('trata titular anonimizado como inexistente — não confirma que a pessoa existiu', async () => {
        const r = await new RevelarDadoSensivelUseCase(
            repo({
                buscarDadosSensiveis: vi.fn().mockResolvedValue({ ...DADOS, anonimizadoEm: new Date() })
            })
        ).executar({ perfilId: 'p-1', campo: 'cpf', ator: { userId: 'u-c', role: 'coordenador' } })

        expect(r).toEqual({ ok: false, erro: 'nao_encontrado' })
    })

    it('propaga erro que não seja de leitura — não engole falha inesperada', async () => {
        await expect(
            new RevelarDadoSensivelUseCase(
                repo({ buscarDadosSensiveis: vi.fn().mockRejectedValue(new Error('conexão caiu')) })
            ).executar({ perfilId: 'p-1', campo: 'cpf', ator: { userId: 'u-c', role: 'coordenador' } })
        ).rejects.toThrow('conexão caiu')
    })
})

describe('auditoria da revelação (FR-017, FR-026, SC-004)', () => {
    it('registra ator, perfil e nome do campo', async () => {
        await new RevelarDadoSensivelUseCase(repo()).executar({
            perfilId: 'p-1',
            campo: 'cpf',
            ator: { userId: 'u-coord', role: 'coordenador' }
        })

        expect(auditorias).toHaveLength(1)
        expect(auditorias[0]).toMatchObject({
            entidadeId: 'p-1',
            dadosNovos: { campoRevelado: 'cpf', rotulo: 'CPF', proprioTitular: false }
        })
    })

    it('NÃO registra o valor revelado — a trilha de FR-017 não pode violar FR-026', async () => {
        await new RevelarDadoSensivelUseCase(repo()).executar({
            perfilId: 'p-1',
            campo: 'cpf',
            ator: { userId: 'u-coord', role: 'coordenador' }
        })

        expect(JSON.stringify(auditorias)).not.toContain('11144477735')
    })

    it('NÃO registra leitura quando a revelação é recusada — não houve acesso', async () => {
        await new RevelarDadoSensivelUseCase(repo()).executar({
            perfilId: 'p-1',
            campo: 'cpf',
            ator: { userId: 'u-dc', role: 'membro_defesa_civil' }
        })

        expect(auditorias).toHaveLength(0)
    })

    it('falha de auditoria NÃO impede a revelação, e é registrada em log (Princípio V)', async () => {
        falharAuditoria = true
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        const r = await new RevelarDadoSensivelUseCase(repo()).executar({
            perfilId: 'p-1',
            campo: 'cpf',
            ator: { userId: 'u-coord', role: 'coordenador' }
        })

        // Quem confere documento em campo não pode ser bloqueado porque o Mongo
        // caiu — a lacuna de log é o menor dos dois males.
        expect(r).toEqual({ ok: true, valor: '11144477735' })
        expect(log).toHaveBeenCalled()

        // O log de contingência também não pode vazar o valor (FR-009).
        expect(JSON.stringify(log.mock.calls)).not.toContain('11144477735')
        log.mockRestore()
    })
})
