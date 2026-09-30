import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `withAudit` é infraestrutura (Mongo + `server-only`) e não é o que estes
 * testes exercem — o contrato auditado já tem cobertura própria em
 * `auditoria.test.ts`. Aqui ele vira passagem direta.
 */
vi.mock('@/src/modules/auditoria', () => ({
    withAudit: <T,>(_opcoes: unknown, fn: () => Promise<T>) => fn()
}))

const { CriarHabilidadeUseCase, EditarHabilidadeUseCase, ExcluirHabilidadeUseCase } = await import('./gerir-habilidade')
const { DuplicadoError, VinculoExistenteError } = await import('../../domain/habilidade')

import type { Habilidade, HabilidadeRepository } from '../ports/habilidade-repository'

/** Repositório falso em memória — o suficiente para as regras de negócio. */
function repositorioFalso(iniciais: Habilidade[] = [], vinculos: Record<string, number> = {}) {
    const linhas = [...iniciais]
    let proximoId = linhas.length + 1

    const repo: HabilidadeRepository = {
        listar: vi.fn(async () => ({
            rows: linhas.map((l) => ({ ...l, voluntariosVinculados: vinculos[l.id] ?? 0 })),
            totalCount: linhas.length
        })),
        buscarPorId: vi.fn(async (id) => linhas.find((l) => l.id === id) ?? null),
        buscarPorNomeNormalizado: vi.fn(
            async (nome, ignorarId) =>
                linhas.find((l) => l.nome.toLowerCase() === nome.toLowerCase() && l.id !== ignorarId) ?? null
        ),
        contarVinculos: vi.fn(async (id) => vinculos[id] ?? 0),
        criar: vi.fn(async ({ nome }) => {
            const nova: Habilidade = { id: `h${proximoId++}`, nome, criadoEm: new Date().toISOString() }
            linhas.push(nova)
            return nova
        }),
        atualizar: vi.fn(async ({ id, nome }) => {
            const alvo = linhas.find((l) => l.id === id)
            if (!alvo) return null
            alvo.nome = nome
            return { ...alvo }
        }),
        excluir: vi.fn(async (id) => {
            const indice = linhas.findIndex((l) => l.id === id)
            if (indice < 0) return false
            linhas.splice(indice, 1)
            return true
        })
    }

    return { repo, linhas }
}

const MOTOSSERRA: Habilidade = { id: 'h1', nome: 'Motosserra', criadoEm: '2026-01-01T00:00:00.000Z' }

beforeEach(() => vi.clearAllMocks())

describe('CriarHabilidadeUseCase', () => {
    it('cria uma habilidade com nome válido', async () => {
        const { repo } = repositorioFalso()
        const resultado = await new CriarHabilidadeUseCase(repo).executar({ nome: 'Operação de drone' })

        expect(resultado.ok).toBe(true)
        expect(repo.criar).toHaveBeenCalledWith({ nome: 'Operação de drone' })
    })

    it('normaliza o nome antes de persistir', async () => {
        const { repo } = repositorioFalso()
        await new CriarHabilidadeUseCase(repo).executar({ nome: '  Primeiros    Socorros  ' })

        expect(repo.criar).toHaveBeenCalledWith({ nome: 'Primeiros Socorros' })
    })

    it('checa duplicidade sobre o nome já normalizado', async () => {
        const { repo } = repositorioFalso([MOTOSSERRA])
        await new CriarHabilidadeUseCase(repo).executar({ nome: '  Motosserra  ' })

        expect(repo.buscarPorNomeNormalizado).toHaveBeenCalledWith('Motosserra', undefined)
    })

    it('recusa nome vazio sem tocar no repositório', async () => {
        const { repo } = repositorioFalso()
        const resultado = await new CriarHabilidadeUseCase(repo).executar({ nome: '   ' })

        expect(resultado.ok).toBe(false)
        expect(repo.criar).not.toHaveBeenCalled()
    })

    it('recusa nome abaixo do mínimo com erro no campo `nome`', async () => {
        const { repo } = repositorioFalso()
        const resultado = await new CriarHabilidadeUseCase(repo).executar({ nome: 'A' })

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(resultado.erro.codigo).toBe('validacao')
        expect((resultado.erro.detalhes?.campos as Record<string, string>).nome).toBeTruthy()
    })

    it('recusa nome acima do máximo', async () => {
        const { repo } = repositorioFalso()
        const resultado = await new CriarHabilidadeUseCase(repo).executar({ nome: 'x'.repeat(81) })

        expect(resultado.ok).toBe(false)
        expect(repo.criar).not.toHaveBeenCalled()
    })

    it('recusa duplicata ignorando caixa', async () => {
        const { repo } = repositorioFalso([MOTOSSERRA])
        const resultado = await new CriarHabilidadeUseCase(repo).executar({ nome: 'motosserra' })

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(resultado.erro).toBeInstanceOf(DuplicadoError)
        expect(resultado.erro.codigo).toBe('duplicado')
        expect(repo.criar).not.toHaveBeenCalled()
    })

    it('propaga como falha a duplicata detectada só pelo índice único (corrida)', async () => {
        const { repo } = repositorioFalso()
        // Passa pela checagem prévia e só o banco recusa — é a corrida de SC-004.
        vi.mocked(repo.criar).mockRejectedValueOnce(new DuplicadoError())

        const resultado = await new CriarHabilidadeUseCase(repo).executar({ nome: 'Motosserra' })

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(resultado.erro.codigo).toBe('duplicado')
    })
})

describe('EditarHabilidadeUseCase', () => {
    it('renomeia uma habilidade existente', async () => {
        const { repo, linhas } = repositorioFalso([MOTOSSERRA])
        const resultado = await new EditarHabilidadeUseCase(repo).executar({ id: 'h1', nome: 'Motosserra elétrica' })

        expect(resultado.ok).toBe(true)
        expect(linhas[0]!.nome).toBe('Motosserra elétrica')
    })

    it('normaliza o nome antes de persistir', async () => {
        const { repo } = repositorioFalso([MOTOSSERRA])
        await new EditarHabilidadeUseCase(repo).executar({ id: 'h1', nome: '  Motosserra   elétrica  ' })

        expect(repo.atualizar).toHaveBeenCalledWith({ id: 'h1', nome: 'Motosserra elétrica' })
    })

    it('permite renomear para o próprio nome com caixa diferente', async () => {
        const { repo } = repositorioFalso([MOTOSSERRA])
        const resultado = await new EditarHabilidadeUseCase(repo).executar({ id: 'h1', nome: 'motosserra' })

        expect(resultado.ok).toBe(true)
        // A checagem exclui a própria linha — sem isso, renomear seria impossível.
        expect(repo.buscarPorNomeNormalizado).toHaveBeenCalledWith('motosserra', 'h1')
    })

    it('recusa colidir com o nome de outra habilidade', async () => {
        const { repo } = repositorioFalso([
            MOTOSSERRA,
            { id: 'h2', nome: 'Embarcação', criadoEm: '2026-01-02T00:00:00.000Z' }
        ])
        const resultado = await new EditarHabilidadeUseCase(repo).executar({ id: 'h2', nome: 'MOTOSSERRA' })

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(resultado.erro.codigo).toBe('duplicado')
        expect(repo.atualizar).not.toHaveBeenCalled()
    })

    it('recusa id inexistente com `nao_encontrado`', async () => {
        const { repo } = repositorioFalso([MOTOSSERRA])
        const resultado = await new EditarHabilidadeUseCase(repo).executar({ id: 'inexistente', nome: 'Qualquer' })

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(resultado.erro.codigo).toBe('nao_encontrado')
    })

    it('recusa nome inválido sem tocar no repositório', async () => {
        const { repo } = repositorioFalso([MOTOSSERRA])
        const resultado = await new EditarHabilidadeUseCase(repo).executar({ id: 'h1', nome: 'A' })

        expect(resultado.ok).toBe(false)
        expect(repo.atualizar).not.toHaveBeenCalled()
    })

    it('preserva a data de cadastro (INV-06)', async () => {
        const { repo, linhas } = repositorioFalso([MOTOSSERRA])
        await new EditarHabilidadeUseCase(repo).executar({ id: 'h1', nome: 'Motosserra elétrica' })

        expect(linhas[0]!.criadoEm).toBe(MOTOSSERRA.criadoEm)
    })

    it('não remove nenhum vínculo ao renomear (INV-05)', async () => {
        const { repo } = repositorioFalso([MOTOSSERRA], { h1: 3 })
        await new EditarHabilidadeUseCase(repo).executar({ id: 'h1', nome: 'Motosserra elétrica' })

        expect(await repo.contarVinculos('h1')).toBe(3)
    })
})

describe('ExcluirHabilidadeUseCase', () => {
    it('exclui habilidade sem vínculos', async () => {
        const { repo, linhas } = repositorioFalso([MOTOSSERRA])
        const resultado = await new ExcluirHabilidadeUseCase(repo).executar({ id: 'h1' })

        expect(resultado.ok).toBe(true)
        expect(linhas).toHaveLength(0)
    })

    it('recusa id inexistente com `nao_encontrado`', async () => {
        const { repo } = repositorioFalso([MOTOSSERRA])
        const resultado = await new ExcluirHabilidadeUseCase(repo).executar({ id: 'inexistente' })

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(resultado.erro.codigo).toBe('nao_encontrado')
        expect(repo.excluir).not.toHaveBeenCalled()
    })

    it('recusa habilidade vinculada sem chamar o `DELETE` (INV-04)', async () => {
        const { repo, linhas } = repositorioFalso([MOTOSSERRA], { h1: 3 })
        const resultado = await new ExcluirHabilidadeUseCase(repo).executar({ id: 'h1' })

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(resultado.erro).toBeInstanceOf(VinculoExistenteError)
        expect(resultado.erro.codigo).toBe('vinculo_existente')
        expect(repo.excluir).not.toHaveBeenCalled()
        expect(linhas).toHaveLength(1)
    })

    it('cita a quantidade de voluntários na mensagem, no plural', async () => {
        const { repo } = repositorioFalso([MOTOSSERRA], { h1: 3 })
        const resultado = await new ExcluirHabilidadeUseCase(repo).executar({ id: 'h1' })

        if (resultado.ok) throw new Error('deveria ter recusado')
        expect(resultado.erro.message).toContain('3 voluntários')
    })

    it('usa o singular quando há exatamente um voluntário', async () => {
        const { repo } = repositorioFalso([MOTOSSERRA], { h1: 1 })
        const resultado = await new ExcluirHabilidadeUseCase(repo).executar({ id: 'h1' })

        if (resultado.ok) throw new Error('deveria ter recusado')
        expect(resultado.erro.message).toContain('1 voluntário.')
        expect(resultado.erro.message).not.toContain('voluntários')
    })

    it('propaga a recusa do banco na corrida entre a contagem e o DELETE', async () => {
        const { repo } = repositorioFalso([MOTOSSERRA])
        // A contagem devolveu 0, mas um vínculo nasceu antes do DELETE — só o
        // `RESTRICT` pega esse caso (X-01.3).
        vi.mocked(repo.excluir).mockRejectedValueOnce(new VinculoExistenteError())

        const resultado = await new ExcluirHabilidadeUseCase(repo).executar({ id: 'h1' })

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(resultado.erro.codigo).toBe('vinculo_existente')
    })
})
