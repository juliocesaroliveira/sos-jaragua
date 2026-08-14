import { HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { podeAcessar } from '@/src/shared/auth/rotas'
import { exigirAcessoA } from '@/src/shared/auth/sessao'
import { normalizarPaginacao } from '@/src/shared/paginacao/esquema'
import { chaveEstoque, chaveSaidas } from '@/src/shared/query'
import { estadoHidratado } from '@/src/shared/query/hidratacao'
import { listarEstoque, listarSaidas } from '@/src/modules/estoque/presentation/queries/estoque'
import { PainelRelatorios } from './painel-relatorios'

export const metadata: Metadata = {
    title: 'Relatórios — SOS Jaraguá'
}

/** BR-REL-01 (REL-03) + BR-CON-01 (CON-02). */
type Props = {
    searchParams: Promise<{
        invPage?: string
        invPageSize?: string
        saidasPage?: string
        saidasPageSize?: string
    }>
}

export default function RelatoriosPage({ searchParams }: Props) {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Relatórios</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Inventário e histórico de saídas para prestação de contas, em CSV ou XLSX.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={6} />}>
                <Conteudo searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

async function Conteudo({ searchParams }: Props) {
    // Relatório é retrato do **momento** — por isso as queries não são
    // cacheadas. Sem `connection()`, o Next tentaria prerenderizar isto e
    // falharia no `randomBytes` do handshake WebSocket do driver Neon;
    // declarar a renderização em tempo de requisição é o correto aqui.
    await connection()

    // O pacote de contingência (BR-CON-01) tem autorização própria, diferente
    // da tela: quem abre relatórios não necessariamente pode gerá-lo. Sem esta
    // checagem, o botão apareceria e daria 403 — mostrar ação que leva a
    // negativa é o defeito que a matriz de navegação existe para evitar.
    // Checagem autoritativa: o `proxy.ts` deixa passar quando o cache de sessão
    // em cookie não está disponível, e `(staff)/layout.tsx` só exige
    // ROLES_STAFF (DESIGN.md §6.2).
    const ator = await exigirAcessoA('/relatorios')
    const podeGerarContingencia = podeAcessar('/api/contingencia/export', ator.role)

    // As tabelas de tela usam as leituras **paginadas**; as de exportação
    // (`inventarioParaExportacao`/`saidasParaExportacao`) continuam existindo,
    // servindo só ao Route Handler de download, que precisa do conjunto inteiro.
    const params = await searchParams
    const consultaInventario = normalizarPaginacao({ page: params.invPage, pageSize: params.invPageSize })
    const consultaSaidas = normalizarPaginacao({ page: params.saidasPage, pageSize: params.saidasPageSize })

    const [inventario, saidas] = await Promise.all([listarEstoque(consultaInventario), listarSaidas(consultaSaidas)])

    return (
        <HydrationBoundary
            state={estadoHidratado([
                { chave: chaveEstoque(consultaInventario), dados: inventario },
                { chave: chaveSaidas(consultaSaidas), dados: saidas }
            ])}
        >
            <PainelRelatorios podeGerarContingencia={podeGerarContingencia} />
        </HydrationBoundary>
    )
}
