import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { listarKitsComReceita } from '@/src/modules/estoque/presentation/queries/estoque'
import {
    historicoDaCrise,
    metricasConfiguradas,
    projecaoDeCrise
} from '@/src/modules/logistica/presentation/queries/dashboard'
import { GestaoCrise } from './gestao-crise'

export const metadata: Metadata = {
    title: 'Variáveis da crise — SOS Jaraguá'
}

/** BRD §5 (LOG-02) + BR-INT-01 (LOG-03) — insumos do cálculo de demanda. */
export default function CrisePage() {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Variáveis da crise</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Números oficiais do evento e a métrica que converte esses números em demanda de kits.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={5} altura="h-20" />}>
                <Conteudo />
            </Suspense>
        </div>
    )
}

async function Conteudo() {
    const [projecao, historico, kits, metricas] = await Promise.all([
        projecaoDeCrise(),
        historicoDaCrise(),
        listarKitsComReceita(),
        metricasConfiguradas()
    ])

    const vigente = projecao.criseAtualizadaEm
        ? {
              id: 'vigente',
              totalFamiliasAfetadas: projecao.crise.totalFamiliasAfetadas,
              totalPessoasAfetadas: projecao.crise.totalPessoasAfetadas,
              atualizadoEm: projecao.criseAtualizadaEm
          }
        : null

    return (
        <GestaoCrise
            vigente={vigente}
            historico={historico}
            kits={kits.map((k) => ({ id: k.id, nome: k.nome, ativo: k.ativo }))}
            metricas={metricas}
        />
    )
}
