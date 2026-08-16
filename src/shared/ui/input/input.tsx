import type { InputHTMLAttributes, Ref } from 'react'
import { ALTURA_POR_TAMANHO, ANEL_FOCO, cn, type TamanhoControle } from '../cn'
import {
    Campo,
    CLASSES_CONTROLE_SOMENTE_LEITURA,
    CLASSES_CONTROLE_TEXTO,
    bordaControle,
    idsCampo
} from '../campo/campo'

/**
 * Input de texto (DESIGN_SYSTEM.md §4.2) — elemento nativo estilizado, já que
 * Ark UI não tem primitivo de texto simples.
 */
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'size' | 'id'> {
    id: string
    label: string
    apoio?: string
    erro?: string
    obrigatorio?: boolean
    size?: TamanhoControle
    /**
     * Campo preenchido pela conta do usuário e não editável — somente leitura,
     * **não** `disabled` (011-auto-cadastro-provedor, FR-015/FR-022). Mantém
     * contraste pleno e continua anunciado com seu valor por leitores de tela.
     */
    vemDaConta?: boolean
    /** React 19: `ref` é uma prop comum — necessário para o `register` do RHF. */
    ref?: Ref<HTMLInputElement>
}

export function Input({ id, label, apoio, erro, obrigatorio, size = 'md', vemDaConta, ...props }: InputProps) {
    const ids = idsCampo(id, Boolean(erro), Boolean(apoio))
    return (
        <Campo id={id} label={label} apoio={apoio} erro={erro} obrigatorio={obrigatorio}>
            <input
                {...props}
                id={id}
                readOnly={vemDaConta || props.readOnly}
                aria-readonly={vemDaConta || undefined}
                // Sem `required` em campo somente leitura: o valor já está lá, e
                // a validação nativa só produziria um bloqueio sem saída se por
                // algum motivo o campo chegasse vazio.
                required={vemDaConta ? undefined : obrigatorio}
                aria-invalid={erro ? true : undefined}
                aria-describedby={ids.describedBy}
                className={cn(
                    CLASSES_CONTROLE_TEXTO,
                    bordaControle(Boolean(erro)),
                    ALTURA_POR_TAMANHO[size],
                    ANEL_FOCO,
                    vemDaConta && CLASSES_CONTROLE_SOMENTE_LEITURA
                )}
            />
        </Campo>
    )
}
