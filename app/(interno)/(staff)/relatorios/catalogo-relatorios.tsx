import Link from 'next/link'
import {
    Boxes,
    Download,
    HandHeart,
    LifeBuoy,
    Megaphone,
    ShieldCheck,
    TriangleAlert,
    type LucideIcon
} from 'lucide-react'
import { Alert } from '@/src/shared/ui/alert/alert'
import { ANEL_FOCO, cn } from '@/src/shared/ui/cn'
import type { IdGrupoRelatorio, SecaoCatalogo } from '@/src/modules/contingencia/domain/catalogo'

/**
 * Catálogo da central (contracts/ui-central.md).
 *
 * Server Component: os cards são links — não há estado no cliente, e o
 * catálogo já chega filtrado pelo perfil.
 */

const ICONE_GRUPO: Record<IdGrupoRelatorio, LucideIcon> = {
    estoque: Boxes,
    voluntariado: HandHeart,
    crise: TriangleAlert,
    comunicacao: Megaphone,
    auditoria: ShieldCheck
}

export function CatalogoRelatorios({
    secoes,
    podeGerarContingencia
}: {
    secoes: SecaoCatalogo[]
    /** Decidido no servidor: o pacote de contingência tem autorização própria. */
    podeGerarContingencia: boolean
}) {
    return (
        <div className="flex flex-col gap-8">
            {secoes.length === 0 ? (
                <Alert tom="info" titulo="Nenhum relatório disponível">
                    Não há relatórios liberados para o seu perfil no momento.
                </Alert>
            ) : (
                secoes.map(({ grupo, relatorios }) => {
                    const Icone = ICONE_GRUPO[grupo.id]
                    const idTitulo = `grupo-${grupo.id}`
                    return (
                        <section key={grupo.id} aria-labelledby={idTitulo} className="flex flex-col gap-3">
                            <h2 id={idTitulo} className="flex items-center gap-2 text-xl font-semibold text-foreground">
                                <Icone aria-hidden className="size-5 text-primary-600 dark:text-primary-400" />
                                {grupo.rotulo}
                            </h2>
                            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {relatorios.map((relatorio) => (
                                    <li key={relatorio.slug} className="flex">
                                        <Link
                                            href={relatorio.rota}
                                            className={cn(
                                                'flex w-full flex-col gap-2 rounded-xl border border-border bg-surface p-5 shadow-sm',
                                                'hover:bg-surface-muted',
                                                ANEL_FOCO
                                            )}
                                        >
                                            <span className="text-lg font-semibold text-foreground">
                                                {relatorio.nome}
                                            </span>
                                            <span className="text-sm text-neutral-600 dark:text-neutral-300">
                                                {relatorio.pergunta}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )
                })
            )}

            {podeGerarContingencia && <PacoteContingencia />}
        </div>
    )
}

/** CON-02 — link simples, nunca cacheado (DESIGN.md §15). Texto e destino inalterados (FR-004). */
function PacoteContingencia() {
    return (
        <section className="flex flex-col gap-3 rounded-xl border border-warning-300 bg-warning-50 p-4 dark:border-warning-800 dark:bg-warning-950">
            <div className="flex items-start gap-3">
                <LifeBuoy aria-hidden className="size-6 shrink-0 text-warning-600 dark:text-warning-400" />
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-semibold text-warning-900 dark:text-warning-100">
                        Pacote de contingência
                    </h2>
                    <p className="text-sm text-warning-900 dark:text-warning-100">
                        Planilha com o saldo exato deste momento e formulários em branco para anotar entradas, saídas e
                        turnos à mão. Gere e imprima <strong>antes</strong> de perder energia ou conexão.
                    </p>
                </div>
            </div>
            <div>
                <a
                    href="/api/contingencia/export"
                    download
                    className="inline-flex h-11 items-center gap-2 rounded-lg bg-warning-600 px-4 text-base font-medium text-white hover:bg-warning-700"
                >
                    <Download aria-hidden className="size-5" />
                    Gerar pacote de contingência
                </a>
            </div>
        </section>
    )
}
