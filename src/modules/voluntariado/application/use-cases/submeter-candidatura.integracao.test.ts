import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { voluntarioPerfil } from '@/db/schema/voluntariado'
import { unidadeDeTrabalho } from '../../infrastructure/drizzle/voluntario-repository'
import { SubmeterCandidaturaUseCase } from './submeter-candidatura'
import type { DadosCandidatura } from '../../domain/candidatura'

/**
 * 011-auto-cadastro-provedor, FR-016 (data-model.md R2).
 *
 * O que só um teste de integração pega: `voluntario_perfil` e
 * `user.data_nascimento` precisam ser gravados na **mesma transação**, e o
 * UPDATE condicional (`... AND data_nascimento IS NULL`) precisa ser realmente
 * idempotente no banco. Um repositório falso não prova nenhuma das duas coisas.
 */
vi.mock('@/src/modules/auditoria', () => ({
    withAudit: <T>(_o: unknown, fn: () => Promise<T>) => fn()
}))

/**
 * CPF sintético **válido** com dígitos verificadores corretos: o domínio recusa
 * CPF inválido antes de chegar ao banco, e o índice único não pode colidir
 * entre execuções.
 */
function cpfValidoAleatorio(): string {
    const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))

    const digito = (digitos: number[]) => {
        const peso = digitos.length + 1
        const soma = digitos.reduce((acc, d, i) => acc + d * (peso - i), 0)
        const resto = (soma * 10) % 11
        return resto === 10 ? 0 : resto
    }

    const d1 = digito(base)
    const d2 = digito([...base, d1])
    return [...base, d1, d2].join('')
}

function dadosCandidatura(overrides: Partial<DadosCandidatura> = {}): DadosCandidatura {
    return {
        nomeCompleto: 'Candidato de Teste',
        dataNascimento: '1990-05-20',
        cpf: cpfValidoAleatorio(),
        telefone: '47991234567',
        cep: '89250000',
        bairro: 'Centro',
        profissao: 'Testes',
        restricoesSaude: null,
        veiculoProprio: false,
        tipoVeiculo: null,
        disponibilidade: ['manha'],
        habilidadeIds: [],
        ...overrides
    }
}

const criados: string[] = []

/** Conta descartável, com ou sem data de nascimento já registrada. */
async function criarConta(dataNascimento: string | null = null) {
    const userId = randomUUID()
    const sufixo = userId.slice(0, 8)

    await db.insert(user).values({
        id: userId,
        name: `Teste ${sufixo}`,
        email: `teste-${sufixo}@exemplo.test`,
        emailVerified: true,
        role: 'usuario',
        dataNascimento
    })

    criados.push(userId)
    return userId
}

async function lerDataNascimentoDaConta(userId: string) {
    const [conta] = await db.select({ dataNascimento: user.dataNascimento }).from(user).where(eq(user.id, userId))
    return conta?.dataNascimento ?? null
}

afterEach(async () => {
    // `voluntario_perfil` cai por cascade do `user`.
    for (const userId of criados.splice(0)) {
        await db.delete(user).where(eq(user.id, userId))
    }
})

describe('SubmeterCandidaturaUseCase (integração)', () => {
    it('grava o perfil e a data de nascimento da conta na mesma transação (FR-016)', async () => {
        const userId = await criarConta(null)
        const useCase = new SubmeterCandidaturaUseCase(unidadeDeTrabalho)

        const r = await useCase.executar({
            userId,
            dados: dadosCandidatura(),
            dataNascimentoDaConta: null
        })

        expect(r.ok).toBe(true)
        if (!r.ok) return

        const [perfil] = await db
            .select({ status: voluntarioPerfil.status, dataNascimento: voluntarioPerfil.dataNascimento })
            .from(voluntarioPerfil)
            .where(eq(voluntarioPerfil.id, r.valor.id))

        expect(perfil.status).toBe('pendente')
        expect(perfil.dataNascimento).toBe('1990-05-20')
        // O ponto do teste: a conta saiu da transação já com a data.
        expect(await lerDataNascimentoDaConta(userId)).toBe('1990-05-20')
    })

    it('não sobrescreve a data já registrada na conta em um reenvio', async () => {
        const userId = await criarConta('1990-05-20')
        const useCase = new SubmeterCandidaturaUseCase(unidadeDeTrabalho)
        const cpf = cpfValidoAleatorio()

        await useCase.executar({
            userId,
            dados: dadosCandidatura({ cpf }),
            dataNascimentoDaConta: '1990-05-20'
        })

        // Reenvio com outra data forjada no corpo e a conta já preenchida.
        const r = await useCase.executar({
            userId,
            dados: dadosCandidatura({ cpf, dataNascimento: '2000-01-01' }),
            dataNascimentoDaConta: '1990-05-20'
        })

        expect(r.ok).toBe(true)
        expect(await lerDataNascimentoDaConta(userId)).toBe('1990-05-20')

        const [perfil] = await db
            .select({ dataNascimento: voluntarioPerfil.dataNascimento })
            .from(voluntarioPerfil)
            .where(eq(voluntarioPerfil.userId, userId))
        expect(perfil.dataNascimento).toBe('1990-05-20')
    })

    it('o UPDATE condicional é idempotente: a segunda gravação não altera o valor', async () => {
        const userId = await criarConta(null)

        await unidadeDeTrabalho.executar(({ usuarios }) =>
            usuarios.definirDataNascimentoSeAusente(userId, '1990-05-20')
        )
        // Segunda chamada com valor diferente — o `IS NULL` no WHERE já não casa.
        await unidadeDeTrabalho.executar(({ usuarios }) =>
            usuarios.definirDataNascimentoSeAusente(userId, '2000-01-01')
        )

        expect(await lerDataNascimentoDaConta(userId)).toBe('1990-05-20')
    })

    it('não grava nada na conta quando a candidatura é recusada', async () => {
        const dono = await criarConta(null)
        const intruso = await criarConta(null)
        const cpf = cpfValidoAleatorio()

        const useCase = new SubmeterCandidaturaUseCase(unidadeDeTrabalho)
        await useCase.executar({ userId: dono, dados: dadosCandidatura({ cpf }), dataNascimentoDaConta: null })

        // Mesmo CPF, outra conta — recusado antes de qualquer escrita.
        const r = await useCase.executar({
            userId: intruso,
            dados: dadosCandidatura({ cpf }),
            dataNascimentoDaConta: null
        })

        expect(r.ok).toBe(false)
        expect(await lerDataNascimentoDaConta(intruso)).toBeNull()
    })
})
