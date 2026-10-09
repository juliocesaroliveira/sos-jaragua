import { HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { camposComErro } from '@/src/shared/kernel'
import { exigirAcessoA } from '@/src/shared/auth/sessao'
import { normalizarPaginacao } from '@/src/shared/paginacao/esquema'
import { chaveRelatorio } from '@/src/shared/query'
import { estadoHidratado } from '@/src/shared/query/hidratacao'
import { SkeletonLista } from '@/src/shared/ui/skeleton/skeleton'
import { DESCRICOES_RELATORIO, ehSlugRelatorio } from '@/src/modules/contingencia/domain/catalogo'
import { hojeEmSaoPaulo, validarPeriodo } from '@/src/modules/contingencia/domain/periodo'
import { obterRelatorio } from '@/src/modules/contingencia/application/definicoes'
import type { RelatorioRegistrado } from '@/src/modules/contingencia/application/definicao-relatorio'
import { GerarRelatorioUseCase } from '@/src/modules/contingencia/application/gerar-relatorio'
import { FiltrosRelatorio } from './filtros-relatorio'
import { PainelRelatorio } from './painel-relatorio'

/**
 * O segmento lê sessão para a checagem granular de role, então não é
 * prerenderizável — mesmo racional de `(staff)/layout.tsx`.
 */
export const instant = false

type Props = {
    params: Promise<{ relatorio: string }>
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
    const { relatorio } = await params
    const nome = ehSlugRelatorio(relatorio) ? DESCRICOES_RELATORIO[relatorio].nome : 'Relatório'
    return { title: `${nome} — SOS Jaraguá` }
}

/**
 * Página de um relatório da central (specs/023-central-relatorios,
 * contracts/consulta-e-rotas.md e contracts/ui-central.md).
 *
 * Uma página genérica para os 17 relatórios: filtros, avisos, resumo,
 * exportação e prévia saem da definição registrada. Filtros e página vivem na
 * URL (FR-012), então um relatório filtrado pode ser reaberto ou repassado.
 */
export default async function RelatorioPage({ params, searchParams }: Props) {
    const { relatorio: slug } = await params

    // A autorização vem antes do 404: quem não pode abrir relatórios não fica
    // sabendo quais existem. Para slug desconhecido vale a regra de `/relatorios`.
    await exigirAcessoA(`/relatorios/${slug}`)

    const relatorio = obterRelatorio(slug)
    if (!relatorio) notFound()

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <nav aria-label="Trilha de navegação" className="text-sm text-neutral-500 dark:text-neutral-400">
                    <Link href="/relatorios" className="hover:underline">
                        Relatórios
                    </Link>
                    <span aria-hidden> / </span>
                    <span>{relatorio.nome}</span>
                </nav>
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">{relatorio.nome}</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">{relatorio.pergunta}</p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={6} />}>
                <Conteudo relatorio={relatorio} searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

async function Conteudo({
    relatorio,
    searchParams
}: {
    relatorio: RelatorioRegistrado
    searchParams: Props['searchParams']
}) {
    // Relatório é retrato do **momento** (FR-009) — nada aqui é cacheado. Sem
    // `connection()`, o Next tentaria prerenderizar e falharia no
    // `randomBytes` do handshake WebSocket do driver Neon.
    await connection()

    const parametros = primeiroValor(await searchParams)
    const filtros = filtrosDaUrl(relatorio, parametros)
    const paginacao = normalizarPaginacao(parametros)
    const agora = new Date()

    const [opcoes, resultado] = await Promise.all([
        relatorio.opcoesFiltros(),
        new GerarRelatorioUseCase(obterRelatorio).pagina(relatorio.slug, { ...filtros, ...paginacao }, agora)
    ])

    // O formulário mostra o período efetivo — inclusive o padrão de 30 dias
    // quando a URL não traz nenhum —, para a pessoa saber o que está vendo.
    const periodo = relatorio.usaPeriodo ? validarPeriodo({ de: filtros.de, ate: filtros.ate }, agora) : null
    const erroDeValidacao = !resultado.ok && resultado.erro.codigo === 'validacao'

    const formulario = (
        <FiltrosRelatorio
            // Remonta quando a URL muda (voltar/avançar, link compartilhado):
            // o rascunho do formulário não pode sobreviver a filtros que já
            // não são os da tela.
            key={JSON.stringify(filtros)}
            usaPeriodo={relatorio.usaPeriodo}
            periodo={periodo?.ok ? periodo.periodo : { de: filtros.de ?? '', ate: filtros.ate ?? '' }}
            campos={relatorio.camposFiltro}
            opcoes={opcoes}
            valores={filtros}
            erros={erroDeValidacao ? camposComErro(resultado.erro.paraObjeto()) : {}}
            hoje={hojeEmSaoPaulo(agora)}
        />
    )

    // Filtro inválido: o formulário com a mensagem no campo, e nada consultado
    // (caso de borda "período inválido").
    if (erroDeValidacao) return formulario

    // Qualquer outra falha (ex.: base de auditoria fora do ar) não é hidratada:
    // o painel busca de novo no cliente e mostra o erro com "Tentar novamente".
    const filtrosDaConsulta = { relatorio: relatorio.slug, ...filtros }
    const estado = resultado.ok
        ? estadoHidratado([
              { chave: chaveRelatorio(relatorio.slug, { ...paginacao, ...filtrosDaConsulta }), dados: resultado.valor }
          ])
        : undefined

    return (
        <div className="flex flex-col gap-6">
            {formulario}
            <HydrationBoundary state={estado}>
                <PainelRelatorio
                    slug={relatorio.slug}
                    nome={relatorio.nome}
                    colunas={relatorio.colunas.map((c) => c.cabecalho)}
                    avisos={relatorio.avisos}
                    contemDadosSensiveis={relatorio.contemDadosSensiveis}
                    filtros={filtrosDaConsulta}
                />
            </HydrationBoundary>
        </div>
    )
}

/** `?x=a&x=b` chega como array; um filtro é sempre um valor só. */
function primeiroValor(parametros: Record<string, string | string[] | undefined>): Record<string, string> {
    const saida: Record<string, string> = {}
    for (const [chave, valor] of Object.entries(parametros)) {
        const primeiro = Array.isArray(valor) ? valor[0] : valor
        if (primeiro !== undefined && primeiro !== '') saida[chave] = primeiro
    }
    return saida
}

/**
 * Só os filtros que o relatório conhece, sem paginação. É o mesmo objeto que
 * entra na `queryKey` no cliente — qualquer chave a mais aqui viraria um POST
 * redundante no primeiro render (`hidratacao.ts`).
 */
function filtrosDaUrl(relatorio: RelatorioRegistrado, parametros: Record<string, string>): Record<string, string> {
    const nomes = [...(relatorio.usaPeriodo ? ['de', 'ate'] : []), ...relatorio.camposFiltro.map((c) => c.nome)]
    const filtros: Record<string, string> = {}
    for (const nome of nomes) {
        if (parametros[nome] !== undefined) filtros[nome] = parametros[nome]
    }
    return filtros
}
