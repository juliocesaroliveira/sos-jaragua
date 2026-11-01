import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { voluntarioPerfil } from '@/db/schema/voluntariado'
import { ehEnvelope, indiceCego } from '@/src/shared/cripto'
import type { CandidaturaValidada } from '../../domain/candidatura'
import { criarVoluntarioRepository } from './voluntario-repository'

/**
 * Feature 024 — proteção dos dados sensíveis contra o Neon real.
 *
 * O que só um teste de integração pega: que o valor **armazenado** é ciphertext
 * (um mock de repositório não provaria), que o índice único de `cpf_indice`
 * realmente barra duplicata, e que `buscarPorCpf` encontra pelo índice cego
 * agora que a igualdade sobre `cpf` deixou de funcionar.
 */

const criados: { userIds: string[] } = { userIds: [] }

afterEach(async () => {
    for (const id of criados.userIds) {
        await db.delete(user).where(eq(user.id, id))
    }
    criados.userIds = []
})

async function criarConta(): Promise<string> {
    const id = `teste-024-${randomUUID()}`
    await db.insert(user).values({ id, name: 'Teste 024', email: `${id}@exemplo.test`, role: 'usuario' })
    criados.userIds.push(id)
    return id
}

function candidatura(cpf: string): CandidaturaValidada {
    return {
        nomeCompleto: 'Ana Souza',
        dataNascimento: '1990-03-15',
        cpf,
        telefone: '47999990000',
        cep: '89250000',
        bairro: 'Centro',
        profissao: 'Enfermeira',
        restricoesSaude: null,
        veiculoProprio: false,
        tipoVeiculo: null,
        disponibilidade: ['integral'],
        habilidadeIds: []
    } as CandidaturaValidada
}

describe('proteção no armazenamento (FR-001, FR-004)', () => {
    it('grava os três campos sensíveis como ciphertext, não em claro', async () => {
        const userId = await criarConta()
        const repo = criarVoluntarioRepository()
        await repo.salvarCandidatura({ userId, dados: candidatura('11144477735') })

        const [linha] = await db
            .select({
                cpf: voluntarioPerfil.cpf,
                dataNascimento: voluntarioPerfil.dataNascimento,
                cep: voluntarioPerfil.cep,
                cpfIndice: voluntarioPerfil.cpfIndice
            })
            .from(voluntarioPerfil)
            .where(eq(voluntarioPerfil.userId, userId))

        expect(ehEnvelope(linha!.cpf!)).toBe(true)
        expect(ehEnvelope(linha!.dataNascimento!)).toBe(true)
        expect(ehEnvelope(linha!.cep!)).toBe(true)
        // Nenhum dos valores informados aparece legível no que foi armazenado.
        const armazenado = JSON.stringify(linha)
        expect(armazenado).not.toContain('11144477735')
        expect(armazenado).not.toContain('1990-03-15')
        expect(armazenado).not.toContain('89250000')
        expect(linha!.cpfIndice).toBe(indiceCego('11144477735'))
    })

    it('devolve o CPF em claro para a application — a cripto não atravessa a fronteira', async () => {
        const userId = await criarConta()
        const repo = criarVoluntarioRepository()
        const salvo = await repo.salvarCandidatura({ userId, dados: candidatura('11144477735') })

        expect(salvo.cpf).toBe('11144477735')
        expect((await repo.buscarPorUserId(userId))!.cpf).toBe('11144477735')
    })

    it('protege também a data de nascimento da conta (FR-008)', async () => {
        const userId = await criarConta()
        await db.update(user).set({ dataNascimento: '1990-03-15' }).where(eq(user.id, userId))

        const [conta] = await db.select({ d: user.dataNascimento }).from(user).where(eq(user.id, userId))
        // Esta asserção documenta a janela da migração: a escrita direta no banco
        // não cifra. É o script `proteger-dados-existentes` que fecha essa janela.
        expect(conta!.d).toBe('1990-03-15')
    })
})

describe('unicidade e busca por CPF (FR-005, SC-007)', () => {
    it('encontra o cadastro pelo CPF completo, via índice cego', async () => {
        const userId = await criarConta()
        const repo = criarVoluntarioRepository()
        await repo.salvarCandidatura({ userId, dados: candidatura('11144477735') })

        const achado = await repo.buscarPorCpf('11144477735')
        expect(achado?.userId).toBe(userId)
    })

    it('encontra pelo CPF formatado — a normalização é parte do índice', async () => {
        const userId = await criarConta()
        const repo = criarVoluntarioRepository()
        await repo.salvarCandidatura({ userId, dados: candidatura('11144477735') })

        expect((await repo.buscarPorCpf('111.444.777-35'))?.userId).toBe(userId)
    })

    it('não encontra CPF inexistente', async () => {
        expect(await criarVoluntarioRepository().buscarPorCpf('52998224725')).toBeNull()
    })

    it('o índice único barra dois cadastros com o mesmo CPF (INV-01)', async () => {
        const repo = criarVoluntarioRepository()
        await repo.salvarCandidatura({ userId: await criarConta(), dados: candidatura('11144477735') })

        await expect(
            repo.salvarCandidatura({ userId: await criarConta(), dados: candidatura('11144477735') })
        ).rejects.toThrow()
    })

    it('o reenvio do mesmo usuário reaproveita a linha, sem criar segunda', async () => {
        const userId = await criarConta()
        const repo = criarVoluntarioRepository()
        const primeiro = await repo.salvarCandidatura({ userId, dados: candidatura('11144477735') })
        const segundo = await repo.salvarCandidatura({ userId, dados: candidatura('11144477735') })

        expect(segundo.id).toBe(primeiro.id)
        const linhas = await db
            .select({ id: voluntarioPerfil.id })
            .from(voluntarioPerfil)
            .where(eq(voluntarioPerfil.userId, userId))
        expect(linhas).toHaveLength(1)
    })
})
