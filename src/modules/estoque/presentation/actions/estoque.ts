'use server'

import { revalidateTag, updateTag } from 'next/cache'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { CACHE_TAGS, PERFIL_REVALIDACAO } from '@/src/shared/cache'
import { erroAction, serializar, type ResultadoAction } from '@/src/shared/kernel'
import { agendarAlertasDeEstoque } from '@/src/modules/notificacoes/presentation/alertas'
import type { Role } from '@/src/shared/auth/roles'
import { comAtorDaSessao, obterSessao } from '@/src/shared/auth/sessao'
import { CATEGORIAS_ITEM, CONDICOES_ITEM, UNIDADES_MEDIDA } from '../../domain/item'
import type { ComponenteInformado } from '../../domain/receita-kit'
import {
    descarteRepository,
    entradaRepository,
    itemRepository,
    kitRepository,
    nomesDeKits,
    receitasDeKits,
    saidaRepository
} from '../../infrastructure/drizzle/estoque-repository'
import { RegistrarEntradaUseCase } from '../../application/use-cases/registrar-entrada'
import { RegistrarSaidaUseCase } from '../../application/use-cases/registrar-saida'
import { RegistrarDescarteUseCase } from '../../application/use-cases/registrar-descarte'
import { DefinirEstoqueMinimoUseCase } from '../../application/use-cases/definir-estoque-minimo'
import { SalvarKitUseCase } from '../../application/use-cases/salvar-kit'

/**
 * Matriz de permissões do BRD §2 / DESIGN.md §6.2:
 * - entrada, saída e estoque mínimo do item: Membro Defesa Civil, Coordenador,
 *   Administrador (o mínimo, pela decisão I1 da feature 020);
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

// -- Entrada (EST-04) ---------------------------------------------------------

const esquemaEntrada = z.object({
    itemId: z.uuid().nullable().optional(),
    novoItem: z
        .object({
            nome: z.string().min(1),
            categoria: z.enum(CATEGORIAS_ITEM),
            unidadeMedida: z.enum(UNIDADES_MEDIDA),
            // Validação completa (casas decimais, limite) fica no domínio.
            estoqueMinimo: z.number().min(0).nullable().optional()
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
        // Item novo aparece nas buscas do Lookup sem invalidação de cache: essas
        // leituras não são cacheadas no servidor (021, queries/estoque.ts).
        invalidarSaldo()
        // Item novo pode nascer já abaixo do mínimo informado (feature 020).
        if (parse.data.novoItem && !parse.data.itemId) agendarAlertasDeEstoque({ estoqueCritico: true })
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
    // Duas consultas em lote para todos os kits, e não duas por kit.
    const kits = parse.data.kits ?? []
    const kitIds = [...new Set(kits.map((k) => k.kitId))]
    const [receitas, nomes] = await Promise.all([receitasDeKits(kitIds), nomesDeKits(kitIds)])
    const kitsComReceita = kits.map((k) => ({
        kitId: k.kitId,
        nome: nomes.get(k.kitId) ?? 'Kit',
        quantidade: k.quantidade,
        componentes: receitas.get(k.kitId) ?? []
    }))

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

    if (resultado.ok) {
        invalidarSaldo()
        // A aba "Saídas" de /relatorios lista as saídas registradas; sem isto
        // ela seguiria mostrando o histórico anterior até o cache expirar.
        revalidateTag(CACHE_TAGS.estoqueSaidas, PERFIL_REVALIDACAO)
        agendarAlertasDeEstoque({ estoqueCritico: true })
    }

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

    if (resultado.ok) {
        invalidarSaldo()
        agendarAlertasDeEstoque({ estoqueCritico: true })
    }

    return serializar(resultado)
}

// -- Estoque mínimo do item (feature 020, Q3 / I1) ---------------------------

const esquemaEstoqueMinimo = z.object({
    itemId: z.uuid(),
    // Validação completa (casas decimais, limite) fica no domínio.
    estoqueMinimo: z.number().min(0).nullable()
})

export type EntradaFormularioEstoqueMinimo = z.infer<typeof esquemaEstoqueMinimo>

export async function definirEstoqueMinimo(
    entrada: EntradaFormularioEstoqueMinimo
): Promise<ResultadoAction<{ itemId: string; estoqueMinimo: number | null }>> {
    const ator = await exigir(ROLES_OPERACAO)
    if (!ator) return erroAction('nao_autorizado', 'Você não tem permissão para definir o estoque mínimo.')

    const parse = esquemaEstoqueMinimo.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Revise os campos do formulário.')

    const useCase = new DefinirEstoqueMinimoUseCase(itemRepository)
    const resultado = await comAtorDaSessao(ator, () => useCase.executar(parse.data))

    if (resultado.ok) {
        // O saldo não muda, só a listagem (coluna "Mínimo").
        updateTag(CACHE_TAGS.estoqueListagem)
        // Subir ou baixar o mínimo pode criar ou encerrar a condição de alerta.
        agendarAlertasDeEstoque({ estoqueCritico: true })
    }

    return serializar(resultado)
}

// -- Kits e receitas (EST-06) -------------------------------------------------

/**
 * Cada componente é um item escolhido **ou** um item a criar (feature 022). O
 * `.strict()` recusa o componente que traz os dois — sem ele, o Zod aceitaria
 * a primeira forma e descartaria o `novoItem` em silêncio. O payload antigo,
 * só com `itemId`, continua válido (contracts S-01, S-02).
 */
const esquemaComponente = z.union([
    z.object({ itemId: z.uuid(), quantidadePorKit: z.number().positive() }).strict(),
    z
        .object({
            novoItem: z.object({
                nome: z.string().trim().min(1),
                categoria: z.enum(CATEGORIAS_ITEM),
                unidadeMedida: z.enum(UNIDADES_MEDIDA),
                // Validação completa (casas decimais, limite) fica no domínio.
                estoqueMinimo: z.number().min(0).nullable().optional()
            }),
            quantidadePorKit: z.number().positive()
        })
        .strict()
])

const esquemaKit = z.object({
    id: z.uuid().optional(),
    nome: z.string().min(1),
    descricao: z.string().nullable().optional(),
    ativo: z.boolean().optional(),
    componentes: z.array(esquemaComponente)
})

export type EntradaFormularioKit = z.infer<typeof esquemaKit>

export async function salvarKit(
    entrada: EntradaFormularioKit
): Promise<ResultadoAction<{ id: string; itensCriados: number }>> {
    const ator = await exigir(ROLES_COORDENACAO)
    if (!ator) return erroAction('nao_autorizado', 'Somente coordenação pode gerir kits.')

    const parse = esquemaKit.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Revise os campos do formulário.')

    const { id, nome, descricao, ativo, componentes } = parse.data

    const useCase = new SalvarKitUseCase(kitRepository)
    const resultado = await comAtorDaSessao(ator, () =>
        useCase.executar({
            id,
            nome,
            descricao,
            ativo: ativo ?? true,
            componentes: componentes.map((c): ComponenteInformado =>
                'itemId' in c
                    ? { tipo: 'existente', itemId: c.itemId, quantidadePorKit: c.quantidadePorKit }
                    : {
                          tipo: 'novo',
                          novoItem: { ...c.novoItem, estoqueMinimo: c.novoItem.estoqueMinimo ?? null },
                          quantidadePorKit: c.quantidadePorKit
                      }
            )
        })
    )

    if (resultado.ok) {
        updateTag(CACHE_TAGS.estoqueKits)
        // Mudar a receita muda quantos kits são montáveis (BR-INT-02).
        revalidateTag(CACHE_TAGS.dashboardKits, PERFIL_REVALIDACAO)
        // Item nascido no kit aparece na tabela de estoque, com saldo 0. As
        // buscas do Lookup não têm cache no servidor (021).
        if (resultado.valor.itensCriados > 0) updateTag(CACHE_TAGS.estoqueListagem)
        // Item novo fica fora do alerta até a primeira entrada (FR-015), então
        // basta a reavaliação de kits.
        agendarAlertasDeEstoque({ estoqueCritico: false })
    }

    return serializar(resultado)
}
