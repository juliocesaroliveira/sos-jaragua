import type { Metadata } from 'next'
import { ShieldAlert } from 'lucide-react'
import { exigirAcessoA } from '@/src/shared/auth/sessao'
import { ambienteAtual, ROTULO_AMBIENTE } from '@/src/modules/manutencao/presentation/ambiente'
import { cn } from '@/src/shared/ui/cn'
import { PainelDangerZone } from './painel-danger-zone'

export const metadata: Metadata = {
    title: 'Danger Zone — SOS Jaraguá'
}

/**
 * Lê sessão para a checagem granular de role — não prerenderizável, mesmo
 * racional de `(staff)/layout.tsx`.
 */
export const instant = false

type Props = { searchParams: Promise<{ aba?: string }> }

/**
 * Danger Zone (026-danger-zone-admin) — restrita a `administrador`.
 *
 * `(staff)/layout.tsx` exige `ROLES_STAFF`; `exigirAcessoA` estreita para
 * `administrador` a partir da regra `/admin` de `REGRAS_DE_ROTA` (FR-001,
 * research D13). Cada Server Action relê a sessão de novo — esta checagem não
 * protege as ações, só a página.
 */
export default async function DangerZonePage({ searchParams }: Props) {
    await exigirAcessoA('/admin/danger-zone')
    const ambiente = ambienteAtual()
    const { aba } = await searchParams

    return (
        <div className="flex flex-col gap-6">
            {/* U-01: o ambiente em destaque, antes de qualquer outra coisa (FR-002a). */}
            <div
                role="status"
                className={cn(
                    'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold',
                    ambiente === 'production'
                        ? 'bg-danger-600 text-white dark:bg-danger-500'
                        : 'bg-warning-100 text-warning-900 dark:bg-warning-950 dark:text-warning-200'
                )}
            >
                <ShieldAlert aria-hidden className="size-5 shrink-0" />
                Ambiente: {ROTULO_AMBIENTE[ambiente]}
            </div>

            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-danger-700 md:text-4xl dark:text-danger-400">
                    Danger Zone
                </h1>
                <p className="text-base text-neutral-600 dark:text-neutral-400">
                    Reset de tabelas e exclusão de registros. Toda ação mostra antes o impacto completo, exige
                    confirmação digitada e fica registrada na trilha de auditoria. Nada aqui pode ser desfeito pela
                    aplicação.
                </p>
            </header>

            <PainelDangerZone abaInicial={aba === 'historico' ? 'historico' : 'tabelas'} />
        </div>
    )
}
