'use server'

import { revalidateTag, updateTag } from 'next/cache'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { CACHE_TAGS, PERFIL_REVALIDACAO } from '@/src/shared/cache'
import { erroAction, serializar, type ResultadoAction } from '@/src/shared/kernel'
import { withAudit } from '@/src/modules/auditoria'
import type { Role } from '@/src/shared/auth/roles'
import { comAtorDaSessao, obterSessao } from '@/src/shared/auth/sessao'
import { CATEGORIAS_ITEM, CONDICOES_ITEM, UNIDADES_MEDIDA } from '../../domain/item'
import type { Kit } from '../../application/ports/estoque-repository'
import {
    descarteRepository,
    entradaRepository,
    itemRepository,
    kitRepository,
    saidaRepository
} from '../../infrastructure/drizzle/estoque-repository'
import { RegistrarEntradaUseCase } from '../../application/use-cases/registrar-entrada'
import { RegistrarSaidaUseCase } from '../../application/use-cases/registrar-saida'
import { RegistrarDescarteUseCase } from '../../application/use-cases/registrar-descarte'

/**
 * Matriz de permissões do BRD §2 / DESIGN.md §6.2:
 * - entrada e saída: Membro Defesa Civil, Coordenador, Administrador;
 * - descarte e receita de kit: só Coordenador e Administrador.
 */
const ROLES_OPERACAO: readonly Role[] = ['membro_defesa_civil', 'coordenador', 'administrador']
const ROLES_COORDENACAO: readonly Role[] = ['coordenador', 'administrador']

async function exigir(roles: readonly Role[]) {
    const ator = await obterSessao()
    return ator && roles.includes(ator.role) ? ator : null
}

/** Invalida tudo que depende do saldo — inclusive o painel de crise. */
function invalidarSaldo() {
    updateTag(CACHE_TAGS.estoqueSaldo)
    updateTag(CACHE_TAGS.estoqueListagem)
    revalidateTag(CACHE_TAGS.dashboardKits, PERFIL_REVALIDACAO)
}

// -- Autocomplete de item (BR-EST-01) -----------------------------------------

/**
 * Busca por similaridade trigram. É uma Server Action (e não uma query
 * cacheada) porque o termo muda a cada tecla: cachear por termo encheria o
 * cache de entradas de uso único.
 */
export async function buscarItens(termo: string) {
    const ator = await exigir(ROLES_OPERACAO)
    if (!ator) return []
    return itemRepository.buscarPorNome(termo, 10)
}

// -- Entrada (EST-04) ---------------------------------------------------------

const esquemaEntrada = z.object({
    itemId: z.uuid().nullable().optional(),
    novoItem: z
        .object({
            nome: z.string().min(1),
            categoria: z.enum(CATEGORIAS_ITEM),
            unidadeMedida: z.enum(UNIDADES_MEDIDA)
        })
        .nullable()
        .optional(),
    quantidade: z.number().positive(),
    condicao: z.enum(CONDICOES_ITEM),
    perecivel: z.boolean(),
    dataValidade: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
    kitDestinoId: z.uuid().nullable().optional()
})

export type EntradaFormularioEntrada = z.infer<typeof esquemaEntrada>

export async function registrarEntrada(
    entrada: EntradaFormularioEntrada
): Promise<ResultadoAction<{ entradaId: string; itemId: string }>> {
    const ator = await exigir(ROLES_OPERACAO)
    if (!ator) return erroAction('nao_autorizado', 'Você não tem permissão para registrar entradas.')

    const parse = esquemaEntrada.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Revise os campos do formulário.')

    const useCase = new RegistrarEntradaUseCase(entradaRepository)
    const resultado = await comAtorDaSessao(ator, () => useCase.executar({ ...parse.data, registradoPor: ator.userId }))

    if (resultado.ok) {
        invalidarSaldo()
        // Item novo entra no catálogo do autocomplete imediatamente.
        updateTag(CACHE_TAGS.estoqueItens)
    }

    return serializar(resultado)
}

// -- Saída (EST-08/09) --------------------------------------------------------

const esquemaSaida = z.object({
    tipo: z.enum(['avulso', 'kit']),
    destino: z.string().min(1),
    responsavelTransporte: z.string().min(1),
    avulsos: z.array(z.object({ itemId: z.uuid(), quantidade: z.number().positive() })).optional(),
    kits: z.array(z.object({ kitId: z.uuid(), quantidade: z.number().positive() })).optional()
})

export type EntradaFormularioSaida = z.infer<typeof esquemaSaida>

/**
 * **Uma única** Server Action com o payload em lote (DESIGN.md §8): o Next
 * despacha Server Actions sequencialmente por cliente, e fatiar a saída em
 * várias chamadas destruiria a atomicidade exigida pelo BR-EST-04.
 */
export async function registrarSaida(entrada: EntradaFormularioSaida): Promise<ResultadoAction<{ saidaId: string }>> {
    const ator = await exigir(ROLES_OPERACAO)
    if (!ator) return erroAction('nao_autorizado', 'Você não tem permissão para registrar saídas.')

    const parse = esquemaSaida.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Revise os campos do formulário.')

    // A receita é lida no servidor, nunca aceita do cliente: senão bastaria
    // forjar o payload para deduzir menos do que o kit realmente consome.
    const kitsComReceita = await Promise.all(
        (parse.data.kits ?? []).map(async (k) => ({
            kitId: k.kitId,
            nome: (await kitRepository.buscarPorId(k.kitId))?.nome ?? 'Kit',
            quantidade: k.quantidade,
            componentes: await kitRepository.receita(k.kitId)
        }))
    )

    const useCase = new RegistrarSaidaUseCase(saidaRepository)
    const resultado = await comAtorDaSessao(ator, () =>
        useCase.executar({
            tipo: parse.data.tipo,
            destino: parse.data.destino,
            responsavelTransporte: parse.data.responsavelTransporte,
            registradoPor: ator.userId,
            avulsos: parse.data.avulsos,
            kits: kitsComReceita
        })
    )

    if (resultado.ok) invalidarSaldo()

    return serializar(resultado)
}

// -- Descarte (EST-11) --------------------------------------------------------

const esquemaDescarte = z.object({
    itemId: z.uuid(),
    quantidade: z.number().positive(),
    motivo: z.string().nullable().optional()
})

export async function registrarDescarte(
    entrada: z.infer<typeof esquemaDescarte>
): Promise<ResultadoAction<{ descarteId: string }>> {
    const ator = await exigir(ROLES_COORDENACAO)
    if (!ator) return erroAction('nao_autorizado', 'Somente coordenação pode registrar descartes.')

    const parse = esquemaDescarte.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Revise os campos do formulário.')

    const useCase = new RegistrarDescarteUseCase(descarteRepository)
    const resultado = await comAtorDaSessao(ator, () => useCase.executar({ ...parse.data, registradoPor: ator.userId }))

    if (resultado.ok) invalidarSaldo()

    return serializar(resultado)
}

// -- Kits e receitas (EST-06) -------------------------------------------------

const esquemaKit = z.object({
    id: z.uuid().optional(),
    nome: z.string().min(1),
    descricao: z.string().nullable().optional(),
    ativo: z.boolean().optional(),
    componentes: z.array(z.object({ itemId: z.uuid(), quantidadePorKit: z.number().positive() }))
})

export type EntradaFormularioKit = z.infer<typeof esquemaKit>

export async function salvarKit(entrada: EntradaFormularioKit): Promise<ResultadoAction<{ id: string }>> {
    const ator = await exigir(ROLES_COORDENACAO)
    if (!ator) return erroAction('nao_autorizado', 'Somente coordenação pode gerir kits.')

    const parse = esquemaKit.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Revise os campos do formulário.')

    const { id, nome, descricao, ativo, componentes } = parse.data

    // Um item repetido na receita violaria `unique(kitId, itemId)` no banco;
    // barramos antes para devolver uma mensagem em vez de um erro de constraint.
    const ids = new Set(componentes.map((c) => c.itemId))
    if (ids.size !== componentes.length) {
        return erroAction('validacao', 'Há itens repetidos na receita do kit.')
    }

    // Receita de kit entra na auditoria de `Doacao` (DB_SCHEMA.md §10): mudar a
    // receita muda o que é deduzido do estoque em cada saída.
    const kit = await comAtorDaSessao(ator, () =>
        // Genérico explícito: `withAudit` recebe as opções antes de `fn`, então
        // o TypeScript não tem como inferir o tipo do resultado a partir delas.
        withAudit<Kit | null>(
            {
                entidade: 'Doacao',
                acao: id ? 'update' : 'create',
                tabela: 'kit',
                dadosAnteriores: async () => {
                    if (!id) return null
                    const anterior = await kitRepository.buscarPorId(id)
                    if (!anterior) return null
                    return { ...anterior, receita: await kitRepository.receita(id) }
                },
                extrair: (salvo) => ({
                    entidadeId: salvo?.id ?? id ?? 'desconhecido',
                    dadosNovos: salvo ? { ...salvo, receita: componentes } : null
                })
            },
            async () => {
                const salvo = id
                    ? await kitRepository.atualizar({ id, nome, descricao, ativo: ativo ?? true })
                    : await kitRepository.criar({ nome, descricao })
                if (salvo) await kitRepository.definirReceita(salvo.id, componentes)
                return salvo
            }
        )
    )

    if (!kit) return erroAction('nao_encontrado', 'Kit não encontrado.')

    updateTag(CACHE_TAGS.estoqueKits)
    // Mudar a receita muda quantos kits são montáveis (BR-INT-02).
    revalidateTag(CACHE_TAGS.dashboardKits, PERFIL_REVALIDACAO)

    return { ok: true, valor: { id: kit.id } }
}
