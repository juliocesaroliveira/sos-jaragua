import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { habilidade, voluntarioHabilidade, voluntarioPerfil } from '@/db/schema/voluntariado'
import { DuplicadoError, VinculoExistenteError } from '../../domain/habilidade'
import { criarHabilidadeRepository } from './habilidade-repository'

/**
 * As duas invariantes de Gestão de Habilidades que **só o banco real prova**
 * (017-gestao-habilidades, research.md D9):
 *
 * - **SC-004 / INV-01**: o índice único sobre `lower(nome)` recusa a segunda
 *   criação concorrente. Um repositório falso não tem corrida para perder.
 * - **SC-008 / INV-04**: a FK `RESTRICT` recusa excluir habilidade vinculada.
 *   Com o `CASCADE` anterior, o `DELETE` teria sucesso apagando em silêncio a
 *   declaração dos voluntários — exatamente o que a spec proíbe.
 */
const repositorio = criarHabilidadeRepository()

const habilidadesCriadas: string[] = []
const usuariosCriados: string[] = []

/** Nome único por execução — os testes rodam contra um banco compartilhado. */
function nomeDescartavel() {
    return `Teste ${randomUUID().slice(0, 8)}`
}

async function criarVoluntarioDescartavel() {
    const userId = randomUUID()
    const sufixo = userId.slice(0, 8)

    await db.insert(user).values({
        id: userId,
        name: `Teste ${sufixo}`,
        email: `habilidade-${sufixo}@exemplo.test`,
        emailVerified: true,
        role: 'voluntario'
    })
    usuariosCriados.push(userId)

    const [perfil] = await db
        .insert(voluntarioPerfil)
        .values({
            userId,
            nomeCompleto: `Teste ${sufixo}`,
            dataNascimento: '1990-01-01',
            cpf: `${Date.now()}`.slice(-11).padStart(11, '0'),
            telefone: '47999999999',
            cep: '89250000',
            bairro: 'Centro',
            profissao: 'Teste',
            veiculoProprio: false,
            disponibilidade: ['integral'],
            status: 'aprovado'
        })
        .returning({ id: voluntarioPerfil.id })

    return perfil!.id
}

afterEach(async () => {
    if (habilidadesCriadas.length > 0) {
        await db.delete(voluntarioHabilidade).where(inArray(voluntarioHabilidade.habilidadeId, habilidadesCriadas))
        await db.delete(habilidade).where(inArray(habilidade.id, habilidadesCriadas))
        habilidadesCriadas.length = 0
    }
    if (usuariosCriados.length > 0) {
        // `voluntario_perfil` cai por cascata a partir de `user`.
        await db.delete(user).where(inArray(user.id, usuariosCriados))
        usuariosCriados.length = 0
    }
})

describe('INV-01 — unicidade insensível a caixa (SC-004)', () => {
    it('recusa criar duas habilidades cujos nomes diferem só na caixa', async () => {
        const nome = nomeDescartavel()

        const primeira = await repositorio.criar({ nome })
        habilidadesCriadas.push(primeira.id)

        await expect(repositorio.criar({ nome: nome.toUpperCase() })).rejects.toBeInstanceOf(DuplicadoError)
    })

    it('em criações concorrentes do mesmo nome, exatamente uma vence', async () => {
        const nome = nomeDescartavel()

        const resultados = await Promise.allSettled([
            repositorio.criar({ nome }),
            repositorio.criar({ nome: nome.toLowerCase() })
        ])

        const vencedoras = resultados.filter((r) => r.status === 'fulfilled')
        const recusadas = resultados.filter((r) => r.status === 'rejected')

        expect(vencedoras).toHaveLength(1)
        expect(recusadas).toHaveLength(1)
        // O erro chega traduzido, não como erro bruto do driver.
        expect((recusadas[0] as PromiseRejectedResult).reason).toBeInstanceOf(DuplicadoError)

        habilidadesCriadas.push((vencedoras[0] as PromiseFulfilledResult<{ id: string }>).value.id)
    })

    it('permite renomear para o próprio nome com outra caixa', async () => {
        const nome = nomeDescartavel()
        const criada = await repositorio.criar({ nome })
        habilidadesCriadas.push(criada.id)

        const atualizada = await repositorio.atualizar({ id: criada.id, nome: nome.toUpperCase() })

        expect(atualizada?.nome).toBe(nome.toUpperCase())
    })
})

describe('INV-04 — exclusão de habilidade vinculada é recusada (SC-008)', () => {
    it('recusa o DELETE e preserva todos os vínculos', async () => {
        const criada = await repositorio.criar({ nome: nomeDescartavel() })
        habilidadesCriadas.push(criada.id)

        const voluntarioPerfilId = await criarVoluntarioDescartavel()
        await db.insert(voluntarioHabilidade).values({ voluntarioPerfilId, habilidadeId: criada.id })

        const antes = await repositorio.contarVinculos(criada.id)
        expect(antes).toBe(1)

        await expect(repositorio.excluir(criada.id)).rejects.toBeInstanceOf(VinculoExistenteError)

        // O ponto do teste: nenhum vínculo desapareceu na tentativa recusada.
        expect(await repositorio.contarVinculos(criada.id)).toBe(antes)
        expect(await repositorio.buscarPorId(criada.id)).not.toBeNull()
    })

    it('exclui normalmente quando não há vínculo', async () => {
        const criada = await repositorio.criar({ nome: nomeDescartavel() })

        await expect(repositorio.excluir(criada.id)).resolves.toBe(true)
        expect(await repositorio.buscarPorId(criada.id)).toBeNull()
    })

    it('devolve `false` ao excluir um id inexistente', async () => {
        await expect(repositorio.excluir(randomUUID())).resolves.toBe(false)
    })
})

describe('listagem', () => {
    it('traz a contagem de vínculos agregada, inclusive zero', async () => {
        const criada = await repositorio.criar({ nome: nomeDescartavel() })
        habilidadesCriadas.push(criada.id)

        const { rows } = await repositorio.listar({ page: 1, pageSize: 50 })
        const linha = rows.find((r) => r.id === criada.id)

        expect(linha?.voluntariosVinculados).toBe(0)
    })

    it('ordena por nome ascendente', async () => {
        const { rows } = await repositorio.listar({ page: 1, pageSize: 50 })
        const nomes = rows.map((r) => r.nome)

        expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')))
    })
})

describe('buscarPorNomeNormalizado', () => {
    it('encontra ignorando caixa e exclui a própria linha quando pedido', async () => {
        const nome = nomeDescartavel()
        const criada = await repositorio.criar({ nome })
        habilidadesCriadas.push(criada.id)

        expect(await repositorio.buscarPorNomeNormalizado(nome.toLowerCase())).not.toBeNull()
        expect(await repositorio.buscarPorNomeNormalizado(nome.toLowerCase(), criada.id)).toBeNull()
    })

    it('não encontra habilidade removida', async () => {
        const nome = nomeDescartavel()
        const criada = await repositorio.criar({ nome })
        await db.delete(habilidade).where(eq(habilidade.id, criada.id))

        expect(await repositorio.buscarPorNomeNormalizado(nome)).toBeNull()
    })
})
