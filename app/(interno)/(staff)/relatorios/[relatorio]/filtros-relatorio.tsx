'use client'

import { Filter, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition, type FormEvent } from 'react'
import { Button } from '@/src/shared/ui/button/button'
import { Formulario } from '@/src/shared/ui/formulario/formulario'
import { DatePicker } from '@/src/shared/ui/date-picker/date-picker'
import { Input } from '@/src/shared/ui/input/input'
import { NumberInput } from '@/src/shared/ui/number-input/number-input'
import { Select } from '@/src/shared/ui/select/select'
import { Switch } from '@/src/shared/ui/switch/switch'
import type { CampoFiltro, OpcaoFiltro } from '@/src/modules/contingencia/domain/catalogo'
import {
    ATALHOS_PERIODO,
    ROTULO_ATALHO_PERIODO,
    periodoDoAtalho,
    type AtalhoPeriodo,
    type Periodo
} from '@/src/modules/contingencia/domain/periodo'

/**
 * Formulário de filtros de um relatório (contracts/ui-central.md).
 *
 * Os filtros vivem na URL (FR-012): "Aplicar" reescreve a query e volta para a
 * página 1; a página do servidor relê os parâmetros e a prévia acompanha. O
 * formulário só guarda o rascunho até o clique.
 */
export function FiltrosRelatorio({
    usaPeriodo,
    periodo,
    campos,
    opcoes,
    valores,
    erros,
    hoje
}: {
    usaPeriodo: boolean
    /** Período efetivo — o padrão de 30 dias aparece preenchido. */
    periodo: Periodo
    campos: readonly CampoFiltro[]
    /** Opções dinâmicas carregadas no servidor, por nome de campo. */
    opcoes: Record<string, OpcaoFiltro[]>
    /** Valores atuais da URL. */
    valores: Record<string, string>
    /** Mensagens de validação por campo. */
    erros: Record<string, string>
    hoje: string
}) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [aplicando, iniciarTransicao] = useTransition()

    const [rascunho, setRascunho] = useState<Record<string, string>>(() => ({
        ...valores,
        ...(usaPeriodo ? { de: periodo.de, ate: periodo.ate } : {})
    }))

    const definir = (nome: string, valor: string | undefined) =>
        setRascunho((atual) => {
            const proximo = { ...atual }
            if (valor) proximo[nome] = valor
            else delete proximo[nome]
            return proximo
        })

    function navegar(filtros: Record<string, string>) {
        const params = new URLSearchParams()
        for (const [chave, valor] of Object.entries(filtros)) {
            if (valor) params.set(chave, valor)
        }
        // O tamanho de página é preferência de leitura, não filtro: sobrevive.
        const pageSize = searchParams.get('pageSize')
        if (pageSize) params.set('pageSize', pageSize)
        const query = params.toString()
        iniciarTransicao(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }))
    }

    function aplicar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault()
        navegar(rascunho)
    }

    function aplicarAtalho(atalho: AtalhoPeriodo) {
        const { de, ate } = periodoDoAtalho(atalho)
        const proximo = { ...rascunho, de, ate }
        setRascunho(proximo)
        navegar(proximo)
    }

    function limpar() {
        setRascunho({})
        navegar({})
    }

    if (!usaPeriodo && campos.length === 0) return null

    return (
        <Formulario
            onSubmit={aplicar}
            aria-label="Filtros do relatório"
            className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4"
        >
            {usaPeriodo && (
                <fieldset className="flex flex-col gap-3">
                    <legend className="mb-2 text-sm font-semibold text-foreground">Período</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <DatePicker
                            id="filtro-de"
                            label="De"
                            value={rascunho.de}
                            onValueChange={(valor) => definir('de', valor)}
                            max={hoje}
                            erro={erros.de}
                        />
                        <DatePicker
                            id="filtro-ate"
                            label="Até"
                            value={rascunho.ate}
                            onValueChange={(valor) => definir('ate', valor)}
                            erro={erros.ate}
                        />
                    </div>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Atalhos de período">
                        {ATALHOS_PERIODO.map((atalho) => (
                            <Button
                                key={atalho}
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => aplicarAtalho(atalho)}
                                disabled={aplicando}
                            >
                                {ROTULO_ATALHO_PERIODO[atalho]}
                            </Button>
                        ))}
                    </div>
                </fieldset>
            )}

            {campos.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {campos.map((campo) => (
                        <CampoDoFiltro
                            key={campo.nome}
                            campo={campo}
                            opcoes={campo.opcoes ?? opcoes[campo.nome] ?? []}
                            valor={rascunho[campo.nome]}
                            erro={erros[campo.nome]}
                            onChange={(valor) => definir(campo.nome, valor)}
                        />
                    ))}
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                <Button type="submit" iconeInicio={<Filter className="size-4" />} loading={aplicando}>
                    Aplicar
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    iconeInicio={<X className="size-4" />}
                    onClick={limpar}
                    disabled={aplicando}
                >
                    Limpar filtros
                </Button>
            </div>
        </Formulario>
    )
}

function CampoDoFiltro({
    campo,
    opcoes,
    valor,
    erro,
    onChange
}: {
    campo: CampoFiltro
    opcoes: readonly OpcaoFiltro[]
    valor: string | undefined
    erro: string | undefined
    onChange: (valor: string | undefined) => void
}) {
    const id = `filtro-${campo.nome}`

    switch (campo.tipo) {
        case 'select':
            return (
                <Select
                    id={id}
                    label={campo.rotulo}
                    apoio={campo.apoio}
                    erro={erro}
                    placeholder={campo.placeholder ?? 'Todos'}
                    opcoes={opcoes.map((o) => ({ value: o.valor, label: o.rotulo }))}
                    value={valor ? [valor] : []}
                    onValueChange={(valores) => onChange(valores[0])}
                />
            )
        case 'numero':
            return (
                <NumberInput
                    id={id}
                    label={campo.rotulo}
                    apoio={campo.apoio}
                    erro={erro}
                    min={campo.min}
                    max={campo.max}
                    casasDecimais={0}
                    value={valor ?? ''}
                    onValueChange={(novo) => onChange(novo || undefined)}
                />
            )
        case 'booleano':
            return (
                <Switch
                    id={id}
                    label={campo.rotulo}
                    apoio={campo.apoio}
                    erro={erro}
                    checked={valor === 'true'}
                    onCheckedChange={(marcado) => onChange(marcado ? 'true' : undefined)}
                />
            )
        case 'texto':
            return (
                <Input
                    id={id}
                    label={campo.rotulo}
                    apoio={campo.apoio}
                    erro={erro}
                    placeholder={campo.placeholder}
                    value={valor ?? ''}
                    onChange={(evento) => onChange(evento.target.value || undefined)}
                />
            )
    }
}
