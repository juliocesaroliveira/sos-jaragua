import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { podeAcessar } from '@/src/shared/auth/rotas'
import { exigirSessao } from '@/src/shared/auth/sessao'
import { listarItens } from '@/src/modules/estoque/presentation/queries/estoque'
import { projecaoDeCrise } from '@/src/modules/logistica/presentation/queries/dashboard'
import {
    avaliarDeficitAtendimento,
    avaliarEstoqueCritico
} from '@/src/modules/notificacoes/application/use-cases/alertas-coordenador'
import { PainelCrise } from './painel-crise'

export const metadata: Metadata = {
    title: 'Painel — SOS Jaraguá'
}

/**
 * Painel de crise (BR-INT-02, LOG-06).
 *
 * Os indicadores vêm de `projecaoDeCrise()`, cacheada sob `dashboard:kits` e
 * invalidada por entrada, saída, descarte, alteração de receita de kit e
 * mudança nas variáveis da crise ou nas métricas (DESIGN.md §7, §11).
 */
export default function DashboardPage() {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Painel de crise</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Demanda projetada e capacidade real de montagem de kits.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={4} altura="h-32" />}>
                <Indicadores />
            </Suspense>
        </div>
    )
}

async function Indicadores() {
    const projecao = await projecaoDeCrise()

    // Alertas gerados **em leitura** (NOT-08, DESIGN.md §12): quem carrega o
    // painel é quem avalia a condição. Ficam fora de `projecaoDeCrise()` de
    // propósito — aquela função é cacheada, e efeito colateral dentro de cache
    // dispararia de forma imprevisível.
    const itens = await listarItens()
    await Promise.all([
        avaliarDeficitAtendimento(projecao.totalNecessarios, projecao.totalPossiveis),
        avaliarEstoqueCritico(itens.map((i) => ({ nome: i.nome, saldo: i.saldo })))
    ])

    // O painel é visível a toda a staff, mas `/crise` pertence à Defesa Civil.
    // Sem esta checagem o coordenador veria atalhos para uma tela que lhe
    // devolveria `/sem-permissao` — mostrar ação que leva a negativa é o defeito
    // que a matriz de navegação existe para evitar.
    const ator = await exigirSessao()
    const podeEditarCrise = podeAcessar('/crise', ator.role)

    return <PainelCrise projecao={projecao} podeEditarCrise={podeEditarCrise} />
}
