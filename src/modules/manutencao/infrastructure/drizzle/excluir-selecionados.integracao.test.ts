import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { alocacao, atividade, atividadeCategoria, turno } from '@/db/schema/voluntariado'
import { entrada, item, saldoEstoque } from '@/db/schema/estoque'
import { REGISTROS_SISTEMA } from '@/src/shared/kernel/registros-sistema'
import { GerarPreviaUseCase } from '../../application/use-cases/gerar-previa'
import { ExecutarAcaoUseCase } from '../../application/use-cases/executar-acao'
import type { RegistroExecucaoManutencao } from '../../application/ports/registro-execucao'
import type { PedidoAcao } from '../../domain/previa'
import { criarExecutorConjuntos } from './executor-conjuntos'
import { criarLeitorEsquema } from './leitor-esquema'

/**
 * Exclusão de selecionados contra o Neon de desenvolvimento (026, T036).
 *
 * O banco é **compartilhado**: o teste só apaga linhas que ele mesmo cria, e
 * nunca reseta tabela inteira (quickstart). Pressupõe a migração 0012 aplicada
 * (índice parcial de `alocacao` + registros padrão).
 *
 * A auditoria é um dublê: a ordem e a política dela são cobertas pelos testes
 * de `executar-acao` e de `registro-manutencao`; aqui o que importa é o banco.
 */

const criados = {
    usuarios: [] as string[],
    categorias: [] as string[],
    atividades: [] as string[],
    itens: [] as string[]
}

afterAll(async () => {
    // Movimentações e alocações redirecionadas para o registro padrão também
    // são do teste — saem pelo id do pai original guardado em `criados`.
    await db.delete(alocacao).where(
        inArray(
            alocacao.turnoId,
            db
                .select({ id: turno.id })
                .from(turno)
                .where(
                    inArray(
                        turno.atividadeId,
                        criados.atividades.length ? criados.atividades : ['00000000-0000-0000-0000-000000000000']
                    )
                )
        )
    )
    if (criados.atividades.length) {
        await db.delete(turno).where(inArray(turno.atividadeId, criados.atividades))
        await db.delete(atividade).where(inArray(atividade.id, criados.atividades))
    }
    if (criados.itens.length) {
        await db.delete(entrada).where(inArray(entrada.itemId, criados.itens))
        await db.delete(saldoEstoque).where(inArray(saldoEstoque.itemId, criados.itens))
        await db.delete(item).where(inArray(item.id, criados.itens))
    }
    if (criados.categorias.length)
        await db.delete(atividadeCategoria).where(inArray(atividadeCategoria.id, criados.categorias))
    if (criados.usuarios.length) await db.delete(user).where(inArray(user.id, criados.usuarios))
})

vi.spyOn(console, 'info').mockImplementation(() => {})

function registroFalso(falharInicio = false) {
    const fases: string[] = []
    const registro: RegistroExecucaoManutencao = {
        verificarDisponibilidade: async () => {},
        registrarInicio: async (evento, linhas) => {
            if (falharInicio) throw new Error('mongo caiu')
            fases.push(evento.fase)
            for await (const _ of linhas) void _
        },
        registrarDesfecho: async (evento) => void fases.push(evento.fase)
    }
    return { registro, fases }
}

async function novoUsuario(role: 'administrador' | 'coordenador' = 'coordenador') {
    const id = randomUUID()
    await db.insert(user).values({
        id,
        name: `DZ ${role} ${id.slice(0, 6)}`,
        email: `dz-${id.slice(0, 8)}@exemplo.test`,
        emailVerified: true,
        role
    })
    criados.usuarios.push(id)
    return id
}

/** Um usuário com histórico: atividade criada por ele, turno, alocação dele e uma entrada registrada por ele. */
async function cenario() {
    const pessoa = await novoUsuario()
    const [categoria] = await db
        .insert(atividadeCategoria)
        .values({ nome: `DZ cat ${randomUUID().slice(0, 8)}` })
        .returning()
    criados.categorias.push(categoria.id)
    const [ativ] = await db
        .insert(atividade)
        .values({ titulo: 'DZ atividade', categoriaId: categoria.id, local: 'Teste', criadoPor: pessoa })
        .returning()
    criados.atividades.push(ativ.id)
    const [t] = await db
        .insert(turno)
        .values({
            atividadeId: ativ.id,
            inicio: new Date('2030-01-01T10:00:00Z'),
            fim: new Date('2030-01-01T12:00:00Z'),
            vagas: 3
        })
        .returning()
    const [aloc] = await db
        .insert(alocacao)
        .values({ turnoId: t.id, participanteUserId: pessoa, alocadoPor: pessoa })
        .returning()
    const [it_] = await db
        .insert(item)
        .values({ nome: `DZ item ${randomUUID().slice(0, 6)}`, categoria: 'outros', unidadeMedida: 'unidade' })
        .returning()
    criados.itens.push(it_.id)
    const [ent] = await db
        .insert(entrada)
        .values({ itemId: it_.id, quantidade: '5', condicao: 'novo', perecivel: false, registradoPor: pessoa })
        .returning()
    await db.insert(saldoEstoque).values({ itemId: it_.id, quantidadeAtual: '5' })
    return { pessoa, atividade: ativ.id, turno: t.id, alocacao: aloc.id, item: it_.id, entrada: ent.id }
}

async function ator() {
    return {
        userId: await novoUsuario('administrador'),
        role: 'administrador' as const,
        sessionToken: `tok-${randomUUID()}`,
        sessaoCriadaEm: new Date()
    }
}

async function previaEExecucao(pedido: PedidoAcao, falharInicio = false) {
    const executor = criarExecutorConjuntos()
    const leitor = criarLeitorEsquema()
    const quem = await ator()
    const previa = await new GerarPreviaUseCase({ leitor, executor }).executar({
        pedido,
        ator: quem,
        ambiente: 'development'
    })
    if (!previa.ok) throw new Error(previa.erro.message)
    const { registro, fases } = registroFalso(falharInicio)
    const resultado = await new ExecutarAcaoUseCase({ leitor, executor, registro }).executar({
        pedido,
        impressaoDigital: previa.valor.impressaoDigital,
        confirmacao: previa.valor.textoConfirmacao,
        ator: quem,
        ambiente: 'development'
    })
    return { previa: previa.valor, resultado, fases }
}

describe('excluir selecionados — preservação', () => {
    it('apaga o usuário e redireciona o histórico para "Usuário removido"', async () => {
        const c = await cenario()
        const { previa, resultado } = await previaEExecucao({
            acao: 'excluir_selecionados',
            tabela: 'user',
            chaves: [c.pessoa],
            modo: 'preservacao'
        })

        expect(previa.temDependentes).toBe(true)
        expect(resultado.ok).toBe(true)
        if (!resultado.ok) return
        // SC-001: o executado é o que a prévia mostrou.
        expect(resultado.valor.contagens.user.apagar).toBe(1)
        expect(resultado.valor.contagens.alocacao.redirecionar).toEqual(previa.impressaoDigital.alocacao.redirecionar)

        expect(await db.select().from(user).where(eq(user.id, c.pessoa))).toHaveLength(0)
        const [a] = await db.select().from(alocacao).where(eq(alocacao.id, c.alocacao))
        expect(a.participanteUserId).toBe(REGISTROS_SISTEMA.usuario)
        expect(a.alocadoPor).toBe(REGISTROS_SISTEMA.usuario)
        const [at] = await db.select().from(atividade).where(eq(atividade.id, c.atividade))
        expect(at.criadoPor).toBe(REGISTROS_SISTEMA.usuario)
        const [e] = await db.select().from(entrada).where(eq(entrada.id, c.entrada))
        expect(e.registradoPor).toBe(REGISTROS_SISTEMA.usuario)
    })

    it('dois usuários do mesmo turno preservados não colidem no índice de alocação (research D5)', async () => {
        const c = await cenario()
        const outro = await novoUsuario()
        await db.insert(alocacao).values({ turnoId: c.turno, participanteUserId: outro, alocadoPor: outro })

        const { resultado } = await previaEExecucao({
            acao: 'excluir_selecionados',
            tabela: 'user',
            chaves: [c.pessoa, outro],
            modo: 'preservacao'
        })
        expect(resultado.ok).toBe(true)
        const doTurno = await db.select().from(alocacao).where(eq(alocacao.turnoId, c.turno))
        expect(doTurno.map((a) => a.participanteUserId)).toEqual([REGISTROS_SISTEMA.usuario, REGISTROS_SISTEMA.usuario])
    })
})

describe('excluir selecionados — cascata', () => {
    it('leva junto alocações, atividades e entradas, e recalcula o saldo', async () => {
        const c = await cenario()
        const { resultado } = await previaEExecucao({
            acao: 'excluir_selecionados',
            tabela: 'user',
            chaves: [c.pessoa],
            modo: 'cascata'
        })
        expect(resultado.ok).toBe(true)
        expect(await db.select().from(alocacao).where(eq(alocacao.id, c.alocacao))).toHaveLength(0)
        expect(await db.select().from(atividade).where(eq(atividade.id, c.atividade))).toHaveLength(0)
        expect(await db.select().from(entrada).where(eq(entrada.id, c.entrada))).toHaveLength(0)
        const [s] = await db.select().from(saldoEstoque).where(eq(saldoEstoque.itemId, c.item))
        expect(Number(s.quantidadeAtual)).toBe(0)
    })
})

describe('recusas', () => {
    it('registro padrão na seleção → registro_protegido', async () => {
        const quem = await ator()
        const r = await new GerarPreviaUseCase({
            leitor: criarLeitorEsquema(),
            executor: criarExecutorConjuntos()
        }).executar({
            pedido: { acao: 'excluir_selecionados', tabela: 'item', chaves: [REGISTROS_SISTEMA.item] },
            ator: quem,
            ambiente: 'development'
        })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.erro.codigo).toBe('registro_protegido')
    })

    it('auditoria falha no início → nada muda no banco (SC-007)', async () => {
        const c = await cenario()
        const { resultado } = await previaEExecucao(
            { acao: 'excluir_selecionados', tabela: 'user', chaves: [c.pessoa], modo: 'cascata' },
            true
        )
        expect(resultado.ok).toBe(false)
        if (!resultado.ok) expect(resultado.erro.codigo).toBe('auditoria_indisponivel')
        expect(await db.select().from(user).where(eq(user.id, c.pessoa))).toHaveLength(1)
        expect(await db.select().from(alocacao).where(eq(alocacao.id, c.alocacao))).toHaveLength(1)
    })
})
