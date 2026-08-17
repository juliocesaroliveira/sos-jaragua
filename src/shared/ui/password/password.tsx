'use client'

import { PasswordInput, usePasswordInputContext } from '@ark-ui/react/password-input'
import { Eye, EyeOff } from 'lucide-react'
import type { ChangeEventHandler, FocusEventHandler, KeyboardEvent, Ref } from 'react'
import { ALTURA_POR_TAMANHO, ANEL_FOCO, cn, type TamanhoControle } from '../cn'
import { Campo, CLASSES_CONTROLE_TEXTO, bordaControle, idsCampo } from '../campo/campo'

/**
 * Campo de senha com alternância de visibilidade (DESIGN_SYSTEM.md §4.2,
 * 014-redesign-tela-login FR-029 a FR-036).
 *
 * Base: `PasswordInput` do Ark UI. A API espelha a de `Input` de propósito —
 * trocar `<Input type="password">` por `<Password>` deve ser mecânico.
 *
 * Ausente de propósito: `value`/`defaultValue` (a máquina do Ark é não
 * controlada), `type` (é sempre senha) e `vemDaConta` (senha nunca vem
 * preenchida pela conta).
 */
export interface PasswordProps {
    id: string
    label: string
    apoio?: string
    erro?: string
    obrigatorio?: boolean
    size?: TamanhoControle
    /**
     * Sem padrão implícito: quem usa declara. Errar aqui faz o gerenciador de
     * senha sugerir a coisa errada — oferecer uma senha nova em uma tela de
     * login, ou reaproveitar a antiga em uma tela de redefinição.
     */
    autoComplete: 'current-password' | 'new-password'
    name?: string
    onChange?: ChangeEventHandler<HTMLInputElement>
    onBlur?: FocusEventHandler<HTMLInputElement>
    placeholder?: string
    disabled?: boolean
    /** React 19: `ref` é prop comum — necessário para o `register` do RHF. */
    ref?: Ref<HTMLInputElement>
}

/**
 * Rótulo do gatilho: descreve a **ação disponível**, não o estado atual.
 *
 * Sem isto o Ark deixa o `aria-label` como `undefined` e o botão é anunciado
 * apenas como "botão", sem dizer o que faz (FR-032).
 */
const TRADUCOES = {
    visibilityTrigger: (visivel: boolean) => (visivel ? 'Ocultar senha' : 'Mostrar senha')
}

export function Password({
    id,
    label,
    apoio,
    erro,
    obrigatorio,
    size = 'md',
    autoComplete,
    name,
    onChange,
    onBlur,
    placeholder,
    disabled,
    ref
}: PasswordProps) {
    const ids = idsCampo(id, Boolean(erro), Boolean(apoio))

    return (
        <Campo id={id} label={label} apoio={apoio} erro={erro} obrigatorio={obrigatorio}>
            {/*
              `ids={{ input: id }}` não é opcional: sem ele o Ark gera um id
              próprio para o input, e o `htmlFor={id}` que o `Campo` renderiza
              apontaria para um elemento inexistente — o rótulo pararia de
              funcionar para clique e para leitor de tela.

              Não usamos `PasswordInput.Label`: quem renderiza rótulo, marcação
              de obrigatório e faixa de apoio/erro é o `Campo`, como em todos os
              outros campos do design system. Dois rótulos seria pior que um.
            */}
            <PasswordInput.Root
                ids={{ input: id }}
                autoComplete={autoComplete}
                name={name}
                required={obrigatorio}
                invalid={Boolean(erro)}
                disabled={disabled}
                translations={TRADUCOES}
            >
                {/*
                  A caixa visual passa a ser o `Control`, não o `<input>`: o
                  gatilho precisa viver dentro da mesma borda, à direita. Por
                  isso o anel de foco vem por `focus-within` aqui, e não no
                  input.

                  `pr-1` reserva a folga do gatilho contra a borda direita; o
                  input não precisa de padding de fuga porque o gatilho é
                  **irmão** dele no flex, não está sobreposto — o texto digitado
                  não tem como passar por baixo (FR-036).
                */}
                <PasswordInput.Control
                    className={cn(
                        'flex items-center gap-1 pr-1',
                        CLASSES_CONTROLE_TEXTO,
                        bordaControle(Boolean(erro)),
                        ALTURA_POR_TAMANHO[size],
                        'outline-none focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 focus-within:ring-offset-surface dark:focus-within:ring-primary-400',
                        disabled && 'cursor-not-allowed opacity-50'
                    )}
                >
                    <PasswordInput.Input
                        ref={ref}
                        onChange={onChange}
                        onBlur={onBlur}
                        placeholder={placeholder}
                        // O Ark não emite `aria-describedby`; a faixa de mensagem
                        // do `Campo` depende dele para ser anunciada.
                        aria-describedby={ids.describedBy}
                        className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed"
                    />

                    <GatilhoVisibilidade />
                </PasswordInput.Control>
            </PasswordInput.Root>
        </Campo>
    )
}

/**
 * Gatilho de visibilidade — **corrige a acessibilidade da biblioteca**.
 *
 * `getVisibilityTriggerProps()` do `@zag-js/password-input` emite
 * `tabIndex: -1` e trata apenas `onPointerDown`. Não há manipulador de teclado
 * algum: como vem, o botão é inalcançável por Tab e inoperável por Enter ou
 * Espaço. Isso viola a FR-033 e a diretriz de foco visível da
 * DESIGN_SYSTEM.md §6.
 *
 * A biblioteca provavelmente tira o botão da ordem de tabulação para encurtar a
 * travessia do formulário, sob o argumento de que quem digita sabe o que
 * digitou. Aqui o argumento não vale: quem navega por teclado inclui quem usa
 * leitor de tela e quer conferir o que foi digitado.
 *
 * **`onKeyDown`, nunca `onClick`.** O Zag chama `preventDefault()` no
 * `pointerdown` — o que impede o foco, mas **não** impede o `click` que vem
 * depois. Um `onClick` adicional dispararia junto com o `TRIGGER.CLICK` que o
 * `pointerdown` já enviou, e a visibilidade alternaria duas vezes no clique de
 * mouse, voltando ao estado inicial. Com `onKeyDown` os dois caminhos ficam
 * disjuntos: ponteiro é do Zag, teclado é nosso.
 */
function GatilhoVisibilidade() {
    const api = usePasswordInputContext()

    function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>) {
        if (evento.key !== 'Enter' && evento.key !== ' ') return
        // Sem isto, Espaço rola a página junto com a alternância.
        evento.preventDefault()
        api.toggleVisible()
    }

    return (
        <PasswordInput.VisibilityTrigger
            tabIndex={0}
            onKeyDown={aoTeclar}
            className={cn(
                // 44×44 (§1.3) — o ícone tem 20px, a área de toque não.
                'flex size-11 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed dark:text-neutral-400',
                ANEL_FOCO
            )}
        >
            <PasswordInput.Indicator fallback={<Eye className="size-5" />}>
                <EyeOff className="size-5" />
            </PasswordInput.Indicator>
        </PasswordInput.VisibilityTrigger>
    )
}
