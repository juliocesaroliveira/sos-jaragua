import type { FormEventHandler, FormHTMLAttributes, ReactNode } from 'react'

/**
 * O `<form>` da aplicação (016-formularios-rhf-zod, FR-003/TC-003).
 *
 * Sempre `noValidate`. A validação nativa do navegador fica desligada em toda a
 * aplicação, e o react-hook-form passa a ser a única autoridade no cliente.
 *
 * **Por que um componente e não uma convenção documentada**: "não esquecer o
 * `noValidate`" é exatamente o tipo de regra que a revisão manual deixa passar
 * — e já deixou. Antes desta feature, dois dos três formulários tinham o
 * atributo e o terceiro não, então o mesmo sistema exibia balão do navegador em
 * uma tela e mensagem própria nas outras, em idioma e estilo diferentes.
 * Centralizar torna a conformidade estrutural: não há como esquecer o que não
 * se digita.
 *
 * `noValidate` e `action` são **omitidos das props** de propósito:
 *
 * - `noValidate` não é configurável — é o requisito, não uma opção.
 * - `action` não é usado: a submissão do padrão é a chamada tipada da Server
 *   Action dentro do `onSubmit`, com `ResultadoAction<T>` de volta. O caminho
 *   `<form action={serverAction}>` do Next é a alternativa a esse modelo, não
 *   uma camada sobre ele — misturar os dois deixaria a validação e o foco de
 *   erro com dono indefinido (research.md D1).
 */
export interface FormularioProps extends Omit<
    FormHTMLAttributes<HTMLFormElement>,
    'noValidate' | 'action' | 'onSubmit'
> {
    /** Normalmente `handleSubmit(minhaFuncao)` do `useFormulario`. */
    onSubmit: FormEventHandler<HTMLFormElement>
    children: ReactNode
}

export function Formulario({ children, ...props }: FormularioProps) {
    return (
        <form {...props} noValidate>
            {children}
        </form>
    )
}
