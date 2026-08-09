import type { Ref, TextareaHTMLAttributes } from 'react'
import { ANEL_FOCO, cn } from '../cn'
import { Campo, CLASSES_CONTROLE_TEXTO, bordaControle, idsCampo } from '../campo/campo'

/** Textarea (DESIGN_SYSTEM.md §4.2) — elemento nativo estilizado. */
export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'id'> {
    id: string
    label: string
    apoio?: string
    erro?: string
    obrigatorio?: boolean
    /** React 19: `ref` é uma prop comum — necessário para o `register` do RHF. */
    ref?: Ref<HTMLTextAreaElement>
}

export function Textarea({ id, label, apoio, erro, obrigatorio, rows = 4, ...props }: TextareaProps) {
    const ids = idsCampo(id, Boolean(erro), Boolean(apoio))
    return (
        <Campo id={id} label={label} apoio={apoio} erro={erro} obrigatorio={obrigatorio}>
            <textarea
                {...props}
                id={id}
                rows={rows}
                required={obrigatorio}
                aria-invalid={erro ? true : undefined}
                aria-describedby={ids.describedBy}
                className={cn(CLASSES_CONTROLE_TEXTO, bordaControle(Boolean(erro)), 'py-2.5', ANEL_FOCO)}
            />
        </Campo>
    )
}
