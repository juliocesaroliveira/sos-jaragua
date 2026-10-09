import type { Metadata } from 'next'
import { podeAcessar } from '@/src/shared/auth/rotas'
import { exigirAcessoA } from '@/src/shared/auth/sessao'
import { gruposVisiveisRelatorios } from '@/src/modules/contingencia/domain/catalogo'
import { slugsDisponiveis } from '@/src/modules/contingencia/application/definicoes'
import { CatalogoRelatorios } from './catalogo-relatorios'

export const metadata: Metadata = {
    title: 'Relatórios — SOS Jaraguá'
}

/**
 * O segmento lê sessão para a checagem granular de role, então não é
 * prerenderizável — mesmo racional de `(staff)/layout.tsx`.
 */
export const instant = false

/**
 * Central de relatórios (specs/023-central-relatorios, contracts/ui-central.md).
 *
 * O catálogo é montado no servidor a partir do perfil: cada relatório só
 * aparece para quem pode abri-lo, e um grupo sem relatório visível não é
 * renderizado — é assim que "Auditoria" some para o membro da Defesa Civil
 * (FR-020). O pacote de contingência (BR-CON-01) continua aqui, com a sua
 * própria regra de acesso.
 */
export default async function RelatoriosPage() {
    // Checagem autoritativa: o `proxy.ts` deixa passar quando o cache de sessão
    // em cookie não está disponível, e `(staff)/layout.tsx` só exige
    // ROLES_STAFF (DESIGN.md §6.2) — a coordenação passaria por ele.
    const ator = await exigirAcessoA('/relatorios')

    return (
        <div className="flex flex-col gap-8">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Relatórios</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Consulte e exporte dados da operação para prestação de contas.
                </p>
            </header>

            <CatalogoRelatorios
                secoes={gruposVisiveisRelatorios(ator.role, slugsDisponiveis())}
                podeGerarContingencia={podeAcessar('/api/contingencia/export', ator.role)}
            />
        </div>
    )
}
