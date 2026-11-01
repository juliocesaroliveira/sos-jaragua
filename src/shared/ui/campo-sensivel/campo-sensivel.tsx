'use client'

import { useState, useTransition } from 'react'
import { Eye, EyeOff, TriangleAlert } from 'lucide-react'
import type { ApresentacaoCampo } from '@/src/shared/mascara'
import type { CampoSensivel as Campo } from '@/src/shared/mascara/campos-sensiveis'
import { cn } from '../cn'

/**
 * Exibição de um dado sensível de voluntário (feature 024, FR-010 a FR-016).
 *
 * Renderiza os **três estados** que a query entrega, e é por eles serem
 * distintos na tela que a operação não confunde "não deu para ler" com "campo
 * vazio" — confusão que levaria alguém a concluir que um cadastro está
 * incompleto quando o que houve foi chave trocada (FR-013, FR-014).
 *
 * Quando `onRevelar` é passado, oferece a revelação sob demanda. A autorização
 * **não** está aqui: a presença do botão é conveniência de interface, e a
 * decisão real acontece no servidor, dentro do caso de uso que confere a Matriz
 * de Visibilidade e audita. Botão visível indevidamente não concede acesso —
 * a mesma defesa em profundidade que o Princípio IV já aplica em `proxy.ts` +
 * `layout.tsx`.
 */

export type CampoSensivelProps = {
    /** Forma de apresentação vinda da query — nunca o valor completo. */
    apresentacao: ApresentacaoCampo
    /** Qual campo é, para o rótulo do botão e para a chamada de revelação. */
    campo: Campo
    /** Formatação aplicada ao valor completo depois de revelado (ex.: `formatarCpf`). */
    formatar?: (valor: string) => string
    /**
     * Busca o valor completo no servidor. Ausente = sem permissão para este
     * campo, e então nem o controle aparece.
     */
    onRevelar?: () => Promise<{ ok: true; valor: string } | { ok: false; erro: string }>
    /** Texto exibido quando não há valor. Segue o padrão já usado no sistema. */
    textoAusente?: string
}

export function CampoSensivel({
    apresentacao,
    campo,
    formatar,
    onRevelar,
    textoAusente = 'Não informado'
}: CampoSensivelProps) {
    const [revelado, setRevelado] = useState<string | null>(null)
    const [erro, setErro] = useState<string | null>(null)
    const [carregando, iniciar] = useTransition()

    if (apresentacao.estado === 'ausente') {
        return <span className="text-neutral-500 dark:text-neutral-400">{textoAusente}</span>
    }

    if (apresentacao.estado === 'ilegivel') {
        return (
            <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <TriangleAlert aria-hidden className="size-4 shrink-0" />
                <span>Não foi possível ler este dado</span>
            </span>
        )
    }

    function revelar() {
        if (!onRevelar) return
        setErro(null)
        iniciar(async () => {
            const r = await onRevelar()
            if (r.ok) setRevelado(r.valor)
            else setErro(r.erro)
        })
    }

    const mostrandoCompleto = revelado !== null
    const texto = mostrandoCompleto ? (formatar ? formatar(revelado) : revelado) : apresentacao.exibicao

    return (
        <span className="inline-flex items-center gap-2">
            <span className={cn(!mostrandoCompleto && 'tabular-nums tracking-wide')}>{texto}</span>

            {onRevelar && (
                <button
                    type="button"
                    onClick={() => (mostrandoCompleto ? setRevelado(null) : revelar())}
                    disabled={carregando}
                    // O rótulo nomeia o campo porque a tela mostra vários destes
                    // controles lado a lado — "Revelar" sozinho não distingue qual.
                    aria-label={mostrandoCompleto ? `Ocultar ${campo}` : `Revelar ${campo} completo`}
                    className="cursor-pointer rounded text-neutral-500 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:text-foreground"
                >
                    {mostrandoCompleto ? (
                        <EyeOff aria-hidden className="size-4" />
                    ) : (
                        <Eye aria-hidden className="size-4" />
                    )}
                </button>
            )}

            {erro && (
                <span role="status" className="text-xs text-red-700 dark:text-red-400">
                    {erro}
                </span>
            )}
        </span>
    )
}
