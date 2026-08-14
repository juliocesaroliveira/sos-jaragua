'use client'

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { ToastContainer, cssTransition, toast, type ToastContentProps } from 'react-toastify/unstyled'
import { ANEL_FOCO, cn } from '../cn'

/**
 * Toast (DESIGN_SYSTEM.md §4.8) sobre o `react-toastify`.
 *
 * A biblioteca é consumida pelo entry point **`unstyled`**, que entrega apenas
 * o comportamento — fila, limite, temporizador, pausa, desmontagem — e nenhuma
 * folha de estilo. Todo o pixel abaixo vem dos tokens do design system, e é por
 * isso que `react-toastify/ReactToastify.css` **não** é importado em lugar
 * nenhum: importá-lo traria a paleta própria da biblioteca (verde #07bc0c, raio
 * de 6px, sombra própria) para dentro da aplicação, que teríamos de combater
 * token a token (specs/010, decisão D1).
 *
 * O tema também não passa pela biblioteca: a prop `theme` dela fixa o valor no
 * instante em que o aviso nasce, o que deixaria um aviso já aberto com o tema
 * antigo quando o usuário alternasse claro/escuro. Aqui o tema sai das
 * variantes `dark:` do Tailwind, então a troca re-estiliza o que já está na
 * tela, em CSS puro (decisão D2).
 */
type TipoAviso = 'success' | 'error' | 'warning' | 'info'

/**
 * Ícone, cor e borda por tom (DESIGN_SYSTEM.md §3) — nunca cores ad-hoc por
 * tela. A duração acompanha o tom porque ler um erro custa mais que registrar
 * um sucesso.
 *
 * A assimetria do tom `warning` é proposital e foi conferida contra o
 * componente anterior: a borda usa `warning-500` e o ícone `warning-600`. Não
 * uniformizar.
 */
const ESTILO: Record<TipoAviso, { borda: string; icone: ReactNode; duracao: number }> = {
    success: {
        borda: 'border-l-4 border-l-success-600',
        icone: <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success-600 dark:text-success-400" />,
        duracao: 5000
    },
    error: {
        borda: 'border-l-4 border-l-danger-600',
        icone: <XCircle aria-hidden className="size-5 shrink-0 text-danger-600 dark:text-danger-400" />,
        duracao: 8000
    },
    warning: {
        borda: 'border-l-4 border-l-warning-500',
        icone: <AlertTriangle aria-hidden className="size-5 shrink-0 text-warning-600 dark:text-warning-400" />,
        duracao: 6000
    },
    info: {
        borda: 'border-l-4 border-l-info-600',
        icone: <Info aria-hidden className="size-5 shrink-0 text-info-600 dark:text-info-400" />,
        duracao: 5000
    }
}

/**
 * Transição própria: o build `unstyled` não traz animação, porque os keyframes
 * da biblioteca vivem no CSS que não importamos. As classes referenciadas estão
 * em `app/globals.css`, que também trata `prefers-reduced-motion`.
 */
const TRANSICAO = cssTransition({ enter: 'aviso-entrada', exit: 'aviso-saida' })

/**
 * O cartão inteiro é conteúdo nosso — inclusive o botão de fechar, que usa o
 * `closeToast` entregue pela biblioteca. Os slots visuais dela ficam
 * desligados (`icon: false`, `closeButton: false`), o que evita o estado
 * híbrido em que parte do visual vem de props da lib e parte do nosso conteúdo
 * — onde divergências nascem (decisão D4).
 */
function Aviso({
    tipo,
    titulo,
    descricao,
    closeToast
}: {
    tipo: TipoAviso
    titulo: string
    descricao?: string
} & Pick<ToastContentProps, 'closeToast'>) {
    return (
        <div
            className={cn(
                'pointer-events-auto flex w-[min(92vw,24rem)] items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-lg',
                ESTILO[tipo].borda
            )}
        >
            {ESTILO[tipo].icone}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-base font-semibold text-foreground">{titulo}</p>
                {descricao && <p className="text-sm text-neutral-600 dark:text-neutral-300">{descricao}</p>}
            </div>
            <button
                type="button"
                onClick={closeToast}
                aria-label="Fechar aviso"
                className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:cursor-pointer hover:bg-surface-muted',
                    ANEL_FOCO
                )}
            >
                <X aria-hidden className="size-5" />
            </button>
        </div>
    )
}

/**
 * Monte uma vez, no shell da aplicação.
 *
 * O posicionamento é nosso porque o build `unstyled` não traz nenhum: o
 * container é uma coluna fixa no canto inferior direito. A camada vem de
 * `CAMADA.toast` (`cn.ts`), que é o que mantém o aviso acima de diálogos e
 * gavetas.
 *
 * Coluna, e não pilha colapsada como no componente anterior: a pilha só
 * expandia no hover, e mobile não tem hover — em campo, no celular, os avisos
 * de baixo ficavam inalcançáveis (decisão D8).
 *
 * `pointer-events-none` no container com `pointer-events-auto` no cartão
 * (`Aviso`) resolve duas coisas de uma vez: a área vazia do container deixa de
 * interceptar cliques destinados à tela, e o aviso continua clicável mesmo
 * quando um `Dialog` do Ark marca o `<body>` inteiro como inerte
 * (`pointer-events: none`) — sem isso, o botão de fechar não responderia
 * enquanto houvesse um diálogo aberto.
 */
export function Toaster() {
    return (
        <ToastContainer
            position="bottom-right"
            limit={4}
            newestOnTop={false}
            transition={TRANSICAO}
            hideProgressBar
            closeButton={false}
            icon={false}
            closeOnClick={false}
            pauseOnHover
            pauseOnFocusLoss
            draggable={false}
            className="pointer-events-none fixed right-0 bottom-0 z-100 flex flex-col gap-2 p-4"
        />
    )
}

function criar(tipo: TipoAviso, titulo: string, descricao?: string) {
    toast((props: ToastContentProps) => <Aviso tipo={tipo} titulo={titulo} descricao={descricao} {...props} />, {
        autoClose: ESTILO[tipo].duracao
    })
}

/**
 * Atalhos em pt-BR para o disparo a partir das telas.
 *
 * A assinatura é fechada de propósito: duração, posição e tom são decisão do
 * design system, não da tela. É também o que permitiu trocar o motor sem tocar
 * em nenhum dos 26 pontos de chamada espalhados pela aplicação.
 */
export const avisar = {
    sucesso: (titulo: string, descricao?: string) => criar('success', titulo, descricao),
    erro: (titulo: string, descricao?: string) => criar('error', titulo, descricao),
    atencao: (titulo: string, descricao?: string) => criar('warning', titulo, descricao),
    info: (titulo: string, descricao?: string) => criar('info', titulo, descricao)
}
