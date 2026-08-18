import type { ReactNode } from 'react'
import { cn } from '../cn'

/**
 * Moldura compartilhada de campo de formulário: rótulo, texto de apoio e
 * mensagem de erro, com a fiação de `aria-describedby`/`aria-invalid` exigida
 * por DESIGN_SYSTEM.md §4.2.
 *
 * Não é um componente da lista da §5 — é o pedaço comum de `Input`, `Textarea`,
 * `NumberInput`, `Select`, `Combobox` e `DatePicker`, extraído para que a
 * marcação de erro seja idêntica em todos eles.
 */
export interface IdsCampo {
    idControle: string
    idErro?: string
    idApoio?: string
    describedBy?: string
}

export function idsCampo(id: string, temErro: boolean, temApoio: boolean): IdsCampo {
    const idErro = temErro ? `${id}-erro` : undefined

    /**
     * Com erro presente, o apoio **não é renderizado** — o erro toma o lugar
     * dele. Logo o id do apoio também não pode continuar no `aria-describedby`:
     * apontar para um elemento inexistente faz o leitor de tela não anunciar
     * nada no lugar da dica, e o usuário perderia justamente a mensagem de erro
     * por causa de uma referência quebrada antes dela.
     */
    const idApoio = temApoio && !temErro ? `${id}-apoio` : undefined

    const describedBy = [idApoio, idErro].filter(Boolean).join(' ') || undefined
    return { idControle: id, idErro, idApoio, describedBy }
}

/**
 * A faixa de mensagem isolada do resto da moldura (016-formularios-rhf-zod,
 * FR-008/FR-010).
 *
 * Existe porque `CheckboxGroup`, `RadioGroup` e `Switch` **não podem** usar o
 * `Campo` inteiro: ele emite um `<label htmlFor>`, e um grupo de opções não tem
 * um controle único para o rótulo apontar — o rótulo correto ali é
 * `<legend>`/`Ark.Label`. Antes disso, os três reimplementavam a faixa por
 * conta própria, sem `apoio` e sem a regra de exclusão, e a mensagem de erro
 * acabava diferente da dos campos de texto na mesma tela.
 */
export interface FaixaMensagemProps {
    ids: IdsCampo
    apoio?: string
    erro?: string
    className?: string
}

export function FaixaMensagem({ ids, apoio, erro, className }: FaixaMensagemProps) {
    if (erro) {
        return (
            <p id={ids.idErro} role="alert" className={cn('text-sm text-danger-600 dark:text-danger-400', className)}>
                {erro}
            </p>
        )
    }
    if (apoio) {
        return (
            <p id={ids.idApoio} className={cn('text-sm text-neutral-500 dark:text-neutral-400', className)}>
                {apoio}
            </p>
        )
    }
    return null
}

export interface CampoProps {
    id: string
    label: string
    /** Texto de apoio abaixo do rótulo (opcional). */
    apoio?: string
    erro?: string
    obrigatorio?: boolean
    /**
     * Mantém o rótulo apenas para leitores de tela. Para controles cujo
     * propósito já é evidente pelo contexto visual — o seletor de registros por
     * página dentro do rodapé da tabela —, o rótulo impresso só ocuparia
     * espaço, mas removê-lo do DOM quebraria a navegação por leitor de tela.
     */
    rotuloOculto?: boolean
    children: ReactNode
}

export function Campo({ id, label, apoio, erro, obrigatorio, rotuloOculto, children }: CampoProps) {
    const ids = idsCampo(id, Boolean(erro), Boolean(apoio))
    return (
        <div className={cn('flex flex-col', rotuloOculto ? 'gap-0' : 'gap-1.5')}>
            <label htmlFor={id} className={cn('text-sm font-medium text-foreground', rotuloOculto && 'sr-only')}>
                {label}
                {obrigatorio && (
                    <span aria-hidden className="ml-1 text-danger-600 dark:text-danger-400">
                        *
                    </span>
                )}
                {obrigatorio && <span className="sr-only"> (obrigatório)</span>}
            </label>
            {children}

            {/*
              Apoio e erro dividem **a mesma faixa**, abaixo do controle: o erro
              substitui o apoio quando existe, em vez de os dois se empilharem.
              Duas razões:
              - O erro é a informação acionável do momento; competindo com a
                dica, ele perde destaque justamente quando mais importa.
              - Sem substituição, o campo mudaria de altura ao ganhar erro,
                empurrando o restante do formulário para baixo a cada validação.

              A dica volta a aparecer assim que o erro é corrigido.

              `mt-1.5` com `rotuloOculto`: nesse modo o contêiner usa `gap-0`,
              porque o rótulo `sr-only` é posicionado de forma absoluta e não
              conta como item flex — sem a margem, a mensagem encostaria no
              controle. Enquanto o apoio ficava acima, esse caso não existia.
            */}
            <FaixaMensagem ids={ids} apoio={apoio} erro={erro} className={cn(rotuloOculto && 'mt-1.5')} />
        </div>
    )
}

/** Classes base compartilhadas por todo controle de texto (§4.2). */
export const CLASSES_CONTROLE_TEXTO =
    'w-full rounded-lg border bg-surface px-3 text-base text-foreground placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:opacity-50'

export function bordaControle(temErro: boolean): string {
    return temErro ? 'border-danger-500' : 'border-border'
}

/**
 * Campo preenchido pela conta do usuário e não editável
 * (011-auto-cadastro-provedor, FR-015/FR-022).
 *
 * **Deliberadamente não usa `disabled`.** Duas razões:
 *
 * 1. **Contraste.** O `disabled:opacity-50` acima derruba `text-foreground`
 *    abaixo da razão 4.5:1 exigida pelo WCAG AA — pior ainda no tema escuro.
 *    Aqui o texto fica em contraste pleno e a distinção vem do fundo.
 * 2. **Leitor de tela.** Um campo `disabled` sai da ordem de foco e costuma não
 *    ser anunciado; `readOnly` é lido normalmente, **com seu valor**. Quem
 *    navega por leitor de tela precisa saber sob qual e-mail está se
 *    candidatando, não encontrar um campo mudo.
 *
 * Opacidade comunicaria "indisponível/quebrado"; o que queremos comunicar é
 * "isto já sabemos, veio da sua conta".
 */
export const CLASSES_CONTROLE_SOMENTE_LEITURA =
    'cursor-default bg-neutral-100 text-foreground dark:bg-neutral-800 read-only:focus:ring-0 read-only:focus:ring-offset-0'
