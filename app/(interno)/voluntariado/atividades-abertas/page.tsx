import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui/skeleton/skeleton'
import { exigirAcessoA } from '@/src/shared/auth/sessao'
import {
    listarAtividadesAbertas,
    listarMeusTurnosConfirmados,
    obterElegibilidade
} from '@/src/modules/voluntariado/presentation/queries/atividades'
import { montarVitrine } from '@/src/modules/voluntariado/presentation/vitrine-atividades-abertas'
import { ListaAtividadesAbertas } from './lista-atividades-abertas'

export const metadata: Metadata = {
    title: 'Atividades abertas — SOS Jaraguá'
}

const ROTA = '/voluntariado/atividades-abertas'

/**
 * Vitrine de turnos com inscrição própria (018-inscricao-atividades).
 *
 * A leitura das atividades é cacheada e igual para todos; a marcação "Você
 * está inscrito" e a elegibilidade dependem da sessão, então o segmento não é
 * prerenderizável (DESIGN.md §7).
 */
export const instant = false

export default function AtividadesAbertasPage() {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Atividades abertas</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Escolha um turno com vaga e inscreva-se. Você pode desistir até 30 minutos antes do início.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={3} altura="h-40" />}>
                <Vitrine />
            </Suspense>
        </div>
    )
}

async function Vitrine() {
    // Mesma regra de REGRAS_DE_ROTA — defesa em profundidade além do proxy.
    const ator = await exigirAcessoA(ROTA)

    const [atividades, meusTurnos, elegibilidade] = await Promise.all([
        listarAtividadesAbertas(),
        listarMeusTurnosConfirmados(ator.userId),
        obterElegibilidade(ator.userId, ator.role)
    ])

    return (
        <ListaAtividadesAbertas
            atividades={montarVitrine(atividades, meusTurnos, new Date())}
            elegibilidade={elegibilidade}
        />
    )
}
