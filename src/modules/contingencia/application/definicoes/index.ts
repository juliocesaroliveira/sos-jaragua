import 'server-only'
import { ehSlugRelatorio, type SlugRelatorio } from '../../domain/catalogo'
import type { RelatorioRegistrado } from '../definicao-relatorio'
import { RELATORIOS_AUDITORIA } from './auditoria'
import { RELATORIOS_CONSOLIDADOS } from './consolidados'
import { RELATORIOS_ALERTAS_ESTOQUE } from './estoque-alertas'
import { RELATORIOS_PRESTACAO } from './estoque-prestacao'
import { RELATORIOS_VOLUNTARIADO } from './voluntariado'

/**
 * Registro dos relatórios implementados (specs/023-central-relatorios).
 *
 * O catálogo (`domain/catalogo.ts`) descreve os 17; este registro diz quais já
 * têm definição. O catálogo da tela mostra só os registrados, e
 * `/relatorios/<slug>` sem registro responde 404 — nunca um card que leva a
 * uma página vazia.
 */
const RELATORIOS: readonly RelatorioRegistrado[] = [
    // US1 — prestação de contas de doações (R-01 a R-04)
    ...RELATORIOS_PRESTACAO,
    // US2 — antecipar falta e perda de estoque (R-05, R-06)
    ...RELATORIOS_ALERTAS_ESTOQUE,
    // US3 — força voluntária (R-09 a R-13)
    ...RELATORIOS_VOLUNTARIADO,
    // US5 — consolidados para o comando (R-07, R-08, R-14, R-15, R-16)
    ...RELATORIOS_CONSOLIDADOS,
    // US4 — trilha de auditoria (R-17), só administrador
    ...RELATORIOS_AUDITORIA
]

const REGISTRADOS: ReadonlyMap<SlugRelatorio, RelatorioRegistrado> = new Map(RELATORIOS.map((r) => [r.slug, r]))

export function obterRelatorio(slug: unknown): RelatorioRegistrado | undefined {
    return ehSlugRelatorio(slug) ? REGISTRADOS.get(slug) : undefined
}

export function slugsDisponiveis(): SlugRelatorio[] {
    return [...REGISTRADOS.keys()]
}
