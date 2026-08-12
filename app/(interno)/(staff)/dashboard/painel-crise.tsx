import Link from 'next/link'
import { Boxes, PackageCheck, TriangleAlert, Users } from 'lucide-react'
import { Alert, Badge, Progress, StatCard } from '@/src/shared/ui'
import type { Projecao } from '@/src/modules/logistica/application/use-cases/projetar-demanda'
import { ROTULO_BASE_DEMANDA } from '@/src/modules/logistica/domain/projecao'

/**
 * Painel de crise (BR-INT-02, LOG-06).
 *
 * Server Component: os indicadores são derivados de dados já cacheados sob
 * `dashboard:kits`, e não há interação — enviar isso ao cliente só adicionaria
 * JavaScript sem benefício.
 */
export function PainelCrise({ projecao }: { projecao: Projecao }) {
    const { crise, criseAtualizadaEm, kits, totalNecessarios, totalPossiveis, percentualGeral, kitsEmDeficit } =
        projecao

    const semCrise = criseAtualizadaEm === null
    const comMetrica = kits.filter((k) => k.ativo && k.baseDemanda !== null)

    return (
        <div className="flex flex-col gap-6">
            {semCrise && (
                <Alert
                    tom="info"
                    titulo="Os números da crise ainda não foram informados"
                    acao={
                        <Link
                            href="/crise"
                            className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-base font-medium text-foreground hover:bg-surface-muted"
                        >
                            Informar agora
                        </Link>
                    }
                >
                    Sem o total de famílias e pessoas afetadas, a demanda de kits não pode ser projetada.
                </Alert>
            )}

            {kitsEmDeficit > 0 && (
                <Alert tom="danger" titulo="Déficit de atendimento">
                    {kitsEmDeficit === 1
                        ? '1 kit está com capacidade abaixo da demanda projetada.'
                        : `${kitsEmDeficit} kits estão com capacidade abaixo da demanda projetada.`}
                </Alert>
            )}

            {/* Os dois grandes indicadores exigidos pelo BR-INT-02. */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Kits necessários"
                    valor={totalNecessarios}
                    unidade="kits"
                    apoio="Demanda projetada a partir dos números da crise"
                    icone={<Boxes aria-hidden className="size-6" />}
                />
                <StatCard
                    label="Kits possíveis"
                    valor={totalPossiveis}
                    unidade="kits"
                    tom={kitsEmDeficit > 0 ? 'danger' : 'success'}
                    apoio="Capacidade de montagem com o saldo atual"
                    icone={<PackageCheck aria-hidden className="size-6" />}
                >
                    {percentualGeral !== null && (
                        <Progress
                            label="Cobertura da demanda"
                            value={percentualGeral}
                            tom={corDaCobertura(percentualGeral)}
                        />
                    )}
                </StatCard>
                <StatCard
                    label="Famílias afetadas"
                    valor={crise.totalFamiliasAfetadas}
                    apoio={criseAtualizadaEm ? `Atualizado em ${formatarDataHora(criseAtualizadaEm)}` : 'Não informado'}
                    icone={<Users aria-hidden className="size-6" />}
                />
                <StatCard
                    label="Pessoas afetadas"
                    valor={crise.totalPessoasAfetadas}
                    apoio={criseAtualizadaEm ? `Atualizado em ${formatarDataHora(criseAtualizadaEm)}` : 'Não informado'}
                    icone={<TriangleAlert aria-hidden className="size-6" />}
                />
            </div>

            <section className="flex flex-col gap-3">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Projeção por kit</h2>

                {kits.length === 0 ? (
                    <Alert tom="info" titulo="Nenhum kit cadastrado">
                        Cadastre kits e suas receitas para acompanhar demanda e capacidade.
                    </Alert>
                ) : (
                    <ul className="grid gap-3 lg:grid-cols-2">
                        {kits.map((kit) => (
                            <li
                                key={kit.kitId}
                                className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-sm"
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-lg font-semibold text-foreground">{kit.nome}</p>
                                    {!kit.ativo && <Badge cor="neutral">Inativo</Badge>}
                                    {kit.deficit && <Badge cor="danger">Déficit</Badge>}
                                    {kit.baseDemanda === null && <Badge cor="warning">Sem métrica</Badge>}
                                </div>

                                {kit.baseDemanda !== null && (
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                        {ROTULO_BASE_DEMANDA[kit.baseDemanda]} · {kit.proporcao} por unidade
                                    </p>
                                )}

                                <dl className="flex gap-6">
                                    <div>
                                        <dt className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                                            Necessários
                                        </dt>
                                        <dd className="text-2xl font-bold text-foreground">{kit.necessarios}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                                            Possíveis
                                        </dt>
                                        <dd
                                            className={
                                                kit.deficit
                                                    ? 'text-2xl font-bold text-danger-700 dark:text-danger-400'
                                                    : 'text-2xl font-bold text-foreground'
                                            }
                                        >
                                            {kit.possiveis}
                                        </dd>
                                    </div>
                                </dl>

                                {!kit.temReceita ? (
                                    <p className="text-sm text-warning-700 dark:text-warning-400">
                                        Sem receita — não é montável.
                                    </p>
                                ) : (
                                    kit.gargalo && (
                                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                            Limitado por <span className="text-foreground">{kit.gargalo}</span>
                                        </p>
                                    )
                                )}

                                {kit.percentualAtendido !== null && (
                                    <Progress
                                        label="Cobertura"
                                        value={kit.percentualAtendido}
                                        tom={corDaCobertura(kit.percentualAtendido)}
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                {comMetrica.length === 0 && kits.length > 0 && (
                    <Alert tom="warning" titulo="Nenhum kit tem métrica de demanda configurada">
                        Sem métrica, o kit não entra no total de &quot;Kits necessários&quot;. Configure em{' '}
                        <Link href="/crise" className="underline">
                            Variáveis da crise
                        </Link>
                        .
                    </Alert>
                )}
            </section>
        </div>
    )
}

/** Verde cobre a demanda, âmbar chega perto, vermelho está longe (§3). */
function corDaCobertura(percentual: number): 'success' | 'warning' | 'danger' {
    if (percentual >= 100) return 'success'
    if (percentual >= 50) return 'warning'
    return 'danger'
}

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo'
})

function formatarDataHora(iso: string) {
    return DATA_HORA.format(new Date(iso))
}
