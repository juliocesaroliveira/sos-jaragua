import { randomInt, randomUUID } from 'node:crypto'
import { inArray } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import {
    alocacao,
    atividade,
    atividadeCategoria,
    habilidade,
    turno,
    voluntarioHabilidade,
    voluntarioPerfil
} from '@/db/schema/voluntariado'
import { intervaloUtc } from '@/src/modules/contingencia/domain/periodo'
import type { Disponibilidade, TipoVeiculo } from '../../domain/candidatura'
import {
    capacidadeRelatorio,
    contarOcupacaoTurnos,
    contarParticipacao,
    contarTriagem,
    contarVoluntariosRelatorio,
    ocupacaoTurnosRelatorio,
    participacaoRelatorio,
    triagemRelatorio,
    voluntariosRelatorio
} from './relatorios'

/**
 * Consultas de Voluntariado da central de relatórios contra o Neon de
 * desenvolvimento (specs/023-central-relatorios, T038).
 *
 * O banco é compartilhado: cada teste isola o que criou por um **bairro
 * único** (R-09, R-11) ou por datas em **2020** (R-10, R-12, R-13), anteriores
 * à existência do sistema e sem horário de verão.
 */

const TUDO = { limite: 100_000, deslocamento: 0 }
const MAIO_2020 = intervaloUtc({ de: '2020-05-01', ate: '2020-05-31' })

const criados = {
    usuarios: [] as string[],
    habilidades: [] as string[],
    categorias: [] as string[],
    atividades: [] as string[]
}

afterEach(async () => {
    // Atividade leva turnos e alocações (cascade); usuário leva perfis e as
    // habilidades declaradas (cascade). Habilidade é `restrict`: vem depois.
    if (criados.atividades.length > 0) await db.delete(atividade).where(inArray(atividade.id, criados.atividades))
    if (criados.categorias.length > 0) {
        await db.delete(atividadeCategoria).where(inArray(atividadeCategoria.id, criados.categorias))
    }
    if (criados.usuarios.length > 0) await db.delete(user).where(inArray(user.id, criados.usuarios))
    if (criados.habilidades.length > 0) await db.delete(habilidade).where(inArray(habilidade.id, criados.habilidades))
    for (const lista of Object.values(criados)) lista.length = 0
})

const sufixo = () => randomUUID().slice(0, 8)

async function criarUsuario(nome = 'Pessoa teste') {
    const id = randomUUID()
    await db
        .insert(user)
        .values({ id, name: nome, email: `rel-vol-${id.slice(0, 8)}@exemplo.test`, emailVerified: true })
    criados.usuarios.push(id)
    return id
}

async function criarHabilidade(nome: string) {
    const [linha] = await db
        .insert(habilidade)
        .values({ nome: `${nome} ${sufixo()}` })
        .returning()
    criados.habilidades.push(linha.id)
    return linha
}

async function criarVoluntario(dados: {
    nome: string
    bairro: string
    status?: 'pendente' | 'aprovado' | 'rejeitado'
    habilidades?: string[]
    tipoVeiculo?: TipoVeiculo
    disponibilidade?: Disponibilidade[]
    criadoEm?: string
    atualizadoEm?: string
    aprovadoEm?: string | null
}) {
    const userId = await criarUsuario(dados.nome)
    const [perfil] = await db
        .insert(voluntarioPerfil)
        .values({
            userId,
            nomeCompleto: dados.nome,
            dataNascimento: '1990-01-01',
            // CPF único por teste — o índice é único e o banco é compartilhado.
            cpf: String(randomInt(10 ** 10, 10 ** 11 - 1)),
            telefone: '47999990000',
            cep: '89250000',
            bairro: dados.bairro,
            profissao: 'Enfermeira',
            restricoesSaude: 'Alergia a dipirona',
            veiculoProprio: dados.tipoVeiculo !== undefined,
            tipoVeiculo: dados.tipoVeiculo ?? null,
            disponibilidade: dados.disponibilidade ?? ['manha'],
            status: dados.status ?? 'aprovado',
            criadoEm: dados.criadoEm ? new Date(dados.criadoEm) : undefined,
            atualizadoEm: dados.atualizadoEm ? new Date(dados.atualizadoEm) : undefined,
            aprovadoEm: dados.aprovadoEm ? new Date(dados.aprovadoEm) : null
        })
        .returning()
    if (dados.habilidades?.length) {
        await db
            .insert(voluntarioHabilidade)
            .values(dados.habilidades.map((habilidadeId) => ({ voluntarioPerfilId: perfil.id, habilidadeId })))
    }
    return { userId, perfil }
}

async function criarAtividade(titulo: string) {
    const autor = await criarUsuario('Coordenação')
    const [categoria] = await db
        .insert(atividadeCategoria)
        .values({ nome: `Categoria ${sufixo()}` })
        .returning()
    criados.categorias.push(categoria.id)
    const [linha] = await db
        .insert(atividade)
        .values({ titulo: `${titulo} ${sufixo()}`, categoriaId: categoria.id, local: 'Galpão', criadoPor: autor })
        .returning()
    criados.atividades.push(linha.id)
    return { ...linha, categoriaNome: categoria.nome, autor }
}

async function criarTurno(atividadeId: string, inicio: string, vagas: number) {
    const comeco = new Date(inicio)
    const [linha] = await db
        .insert(turno)
        .values({ atividadeId, inicio: comeco, fim: new Date(comeco.getTime() + 4 * 3600_000), vagas })
        .returning()
    return linha
}

async function alocar(
    turnoId: string,
    participanteUserId: string,
    alocadoPor: string,
    status: 'confirmado' | 'cancelado' = 'confirmado'
) {
    await db.insert(alocacao).values({ turnoId, participanteUserId, alocadoPor, status })
}

describe('voluntariosRelatorio (R-09)', () => {
    it('traz CPF e restrições completos, habilidades agregadas, e filtra por status, bairro, habilidade, veículo e disponibilidade', async () => {
        const bairro = `Bairro ${sufixo()}`
        const barco = await criarHabilidade('Embarcação')
        const socorro = await criarHabilidade('Primeiros socorros')
        const ana = await criarVoluntario({
            nome: 'Ana',
            bairro,
            habilidades: [socorro.id, barco.id],
            tipoVeiculo: 'barco',
            disponibilidade: ['noite', 'fim_de_semana']
        })
        await criarVoluntario({ nome: 'Bruno', bairro: ` ${bairro.toUpperCase()} `, status: 'pendente' })

        const todos = await voluntariosRelatorio({ bairro }, TUDO)
        expect(todos.map((l) => l.nomeCompleto)).toEqual(['Ana', 'Bruno'])
        expect(todos[0]).toMatchObject({
            cpf: ana.perfil.cpf,
            restricoesSaude: 'Alergia a dipirona',
            habilidades: [barco.nome, socorro.nome].sort().join(', '),
            tipoVeiculo: 'barco',
            disponibilidade: ['noite', 'fim_de_semana']
        })

        expect(await contarVoluntariosRelatorio({ bairro, status: 'pendente' })).toBe(1)
        expect(
            (await voluntariosRelatorio({ bairro, habilidadeId: barco.id }, TUDO)).map((l) => l.nomeCompleto)
        ).toEqual(['Ana'])
        expect(await contarVoluntariosRelatorio({ bairro, tipoVeiculo: 'barco' })).toBe(1)
        expect(await contarVoluntariosRelatorio({ bairro, disponibilidade: 'noite' })).toBe(1)
        expect(await contarVoluntariosRelatorio({ bairro, disponibilidade: 'tarde' })).toBe(0)
    })
})

describe('triagemRelatorio (R-10)', () => {
    it('usa o último envio para pendentes e o primeiro para decididas; pendentes primeiro, da mais antiga', async () => {
        const bairro = `Bairro ${sufixo()}`
        const antiga = await criarVoluntario({
            nome: 'Pendente antiga',
            bairro,
            status: 'pendente',
            criadoEm: '2020-04-01T12:00:00Z', // primeiro envio fora do período…
            atualizadoEm: '2020-05-02T12:00:00Z' // …mas reenviada dentro dele
        })
        const nova = await criarVoluntario({
            nome: 'Pendente nova',
            bairro,
            status: 'pendente',
            criadoEm: '2020-05-20T12:00:00Z',
            atualizadoEm: '2020-05-20T12:00:00Z'
        })
        const aprovada = await criarVoluntario({
            nome: 'Aprovada',
            bairro,
            status: 'aprovado',
            criadoEm: '2020-05-10T12:00:00Z',
            atualizadoEm: '2020-06-10T12:00:00Z', // decisão fora do período não importa
            aprovadoEm: '2020-05-12T12:00:00Z'
        })
        // Decidida com primeiro envio fora do período: fica de fora.
        await criarVoluntario({
            nome: 'Fora',
            bairro,
            status: 'rejeitado',
            criadoEm: '2020-04-01T12:00:00Z',
            atualizadoEm: '2020-05-15T12:00:00Z',
            aprovadoEm: '2020-05-15T12:00:00Z'
        })

        const linhas = await triagemRelatorio(MAIO_2020, TUDO)
        expect(linhas.map((l) => l.id)).toEqual([antiga.perfil.id, nova.perfil.id, aprovada.perfil.id])
        expect(linhas[0].enviadoEm.toISOString()).toBe('2020-05-02T12:00:00.000Z')
        expect(linhas[0].primeiroEnvio.toISOString()).toBe('2020-04-01T12:00:00.000Z')
        expect(linhas[2].decididoEm?.toISOString()).toBe('2020-05-12T12:00:00.000Z')
        expect(await contarTriagem(MAIO_2020)).toBe(3)
    })
})

describe('capacidadeRelatorio (R-11)', () => {
    it('conta só aprovados do bairro, por habilidade (inclusive zero), veículo e disponibilidade', async () => {
        const bairro = `Bairro ${sufixo()}`
        const barco = await criarHabilidade('Embarcação')
        const motosserra = await criarHabilidade('Motosserra')
        await criarVoluntario({
            nome: 'A',
            bairro,
            habilidades: [barco.id],
            tipoVeiculo: 'barco',
            disponibilidade: ['manha', 'noite']
        })
        await criarVoluntario({ nome: 'B', bairro, habilidades: [barco.id], disponibilidade: ['manha'] })
        await criarVoluntario({
            nome: 'Pendente',
            bairro,
            status: 'pendente',
            habilidades: [motosserra.id],
            tipoVeiculo: 'carro'
        })

        const capacidade = await capacidadeRelatorio({ bairro })

        expect(capacidade.porHabilidade.find((h) => h.habilidade === barco.nome)?.total).toBe(2)
        expect(capacidade.porHabilidade.find((h) => h.habilidade === motosserra.nome)?.total).toBe(0)
        expect(capacidade.porVeiculo).toEqual([{ tipoVeiculo: 'barco', total: 1 }])
        expect(Object.fromEntries(capacidade.porDisponibilidade.map((d) => [d.disponibilidade, d.total]))).toEqual({
            manha: 2,
            noite: 1
        })
    })
})

describe('ocupacaoTurnosRelatorio (R-12) e participacaoRelatorio (R-13)', () => {
    it('ignora alocações canceladas, filtra por início do turno e soma as horas escaladas por pessoa', async () => {
        const ativ = await criarAtividade('Montagem de kits')
        const pessoa = await criarUsuario('Carla')
        const outra = await criarUsuario('Diego')

        const t1 = await criarTurno(ativ.id, '2020-05-05T12:00:00Z', 5)
        const t2 = await criarTurno(ativ.id, '2020-05-06T12:00:00Z', 2)
        const t3 = await criarTurno(ativ.id, '2020-05-07T12:00:00Z', 3)
        await criarTurno(ativ.id, '2020-06-07T12:00:00Z', 3) // fora do período

        await alocar(t1.id, pessoa, ativ.autor)
        await alocar(t2.id, pessoa, ativ.autor)
        await alocar(t3.id, pessoa, ativ.autor, 'cancelado')
        await alocar(t2.id, outra, ativ.autor)

        const turnos = await ocupacaoTurnosRelatorio({ intervalo: MAIO_2020, atividadeId: ativ.id }, TUDO)
        expect(turnos.map((t) => [t.vagas, t.confirmados])).toEqual([
            [5, 1],
            [2, 2],
            [3, 0]
        ])
        expect(turnos[0]).toMatchObject({
            atividade: ativ.titulo,
            categoria: ativ.categoriaNome,
            statusAtividade: 'aberta'
        })

        expect(await contarOcupacaoTurnos({ intervalo: MAIO_2020, atividadeId: ativ.id, apenasComVagas: true })).toBe(2)
        expect(await contarOcupacaoTurnos({ intervalo: MAIO_2020, categoriaAtividadeId: ativ.categoriaId })).toBe(3)

        const participacao = await participacaoRelatorio(MAIO_2020, TUDO)
        const daCarla = participacao.find((p) => p.participanteUserId === pessoa)
        const doDiego = participacao.find((p) => p.participanteUserId === outra)
        // 3 turnos de 4 h, 1 cancelado → 2 turnos, 8 h (cenário 4 da US3).
        expect(daCarla).toMatchObject({ turnos: 2, segundos: 8 * 3600, cpf: null })
        expect(doDiego).toMatchObject({ turnos: 1, segundos: 4 * 3600 })
        expect(await contarParticipacao(MAIO_2020)).toBeGreaterThanOrEqual(2)
    })
})
