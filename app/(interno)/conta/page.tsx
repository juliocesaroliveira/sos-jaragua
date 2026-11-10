import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Alert } from '@/src/shared/ui/alert/alert'
import { SkeletonLista } from '@/src/shared/ui/skeleton/skeleton'
import { exigirSessao } from '@/src/shared/auth/sessao'
import { formatarCep, formatarCpf, formatarTelefone } from '@/src/modules/identidade/domain'
import { dadosDaConta, impactoDaExclusao } from '@/src/modules/voluntariado/presentation/queries/conta'
import { ExcluirMeusDados } from './excluir-dados'

export const metadata: Metadata = {
    title: 'Minha conta — SOS Jaraguá'
}

/**
 * Área de conta do titular (feature 025, US4) — LGPD art. 18, II e VI.
 *
 * Fica **fora de `(staff)`** de propósito: qualquer pessoa autenticada acessa a
 * sua, e o gate de `(interno)/layout.tsx` já exige sessão válida. Rotas ausentes
 * do mapa de roles exigem apenas sessão (Princípio IV), que é exatamente o que
 * esta tela precisa — não faria sentido inscrevê-la na matriz de atores.
 *
 * Depende de quem está autenticado, então o segmento não é prerenderizável
 * (`DESIGN.md` §7). É também o que permite exibir os valores **completos** ao
 * titular sem que passem por cache algum.
 */
export const instant = false

export default function ContaPage() {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Minha conta</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Seus dados como estão cadastrados no sistema, e o que você pode fazer com eles.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={2} altura="h-40" />}>
                <Conteudo />
            </Suspense>
        </div>
    )
}

async function Conteudo() {
    const ator = await exigirSessao()
    const dados = await dadosDaConta(ator.userId)

    if (!dados) {
        return (
            <Alert tom="danger" titulo="Conta não encontrada">
                Entre novamente para continuar.
            </Alert>
        )
    }

    const impacto = await impactoDaExclusao(ator.userId)

    return (
        <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold text-foreground">Seus dados</h2>

                {/*
                    Valores COMPLETOS, sem máscara e sem ação de revelar: o titular
                    tem direito de acesso aos próprios dados (FR-019). A máscara
                    existe para proteger dado de terceiros, não o seu do seu olhar.
                */}
                <dl className="grid gap-x-6 gap-y-3 rounded-lg border border-neutral-200 p-4 sm:grid-cols-2 dark:border-neutral-800">
                    <Campo rotulo="Nome" valor={dados.nome} />
                    <Campo rotulo="E-mail" valor={dados.email} />
                    {dados.temPerfilVoluntario && (
                        <>
                            <Campo rotulo="CPF" valor={dados.cpf ? formatarCpf(dados.cpf) : null} />
                            <Campo rotulo="Data de nascimento" valor={formatarDataBR(dados.dataNascimento)} />
                            <Campo
                                rotulo="Telefone"
                                valor={dados.telefone ? formatarTelefone(dados.telefone) : null}
                            />
                            <Campo rotulo="CEP" valor={dados.cep ? formatarCep(dados.cep) : null} />
                            <Campo rotulo="Bairro" valor={dados.bairro} />
                            <Campo rotulo="Profissão / formação" valor={dados.profissao} />
                        </>
                    )}
                </dl>

                {dados.algumIlegivel && (
                    <Alert tom="warning" titulo="Alguns dados não puderam ser lidos">
                        Isso indica um problema de configuração do sistema, não um cadastro incompleto. Avise a
                        coordenação.
                    </Alert>
                )}
            </section>

            <ExcluirMeusDados
                turnosFuturosConfirmados={impacto.turnosFuturosConfirmados}
                turnosPassados={impacto.turnosPassados}
                jaAnonimizado={impacto.jaAnonimizado}
            />
        </div>
    )
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
    return (
        <div className="flex flex-col">
            <dt className="text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
                {rotulo}
            </dt>
            <dd className="text-base text-foreground">
                {valor ?? <span className="text-neutral-500 dark:text-neutral-400">Não informado</span>}
            </dd>
        </div>
    )
}

/** `1990-03-15` → `15/03/1990`. */
function formatarDataBR(iso: string | null): string | null {
    if (!iso) return null
    const [ano, mes, dia] = iso.slice(0, 10).split('-')
    return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso
}
