'use client'

import { Avatar as Ark } from '@ark-ui/react/avatar'
import { cn } from '../cn'

/**
 * Avatar sobre o primitivo Ark (DESIGN_SYSTEM.md §4.11).
 * Foto ou iniciais do usuário — header e listagem de voluntários.
 */
export interface AvatarProps {
    nome: string
    src?: string | null
    tamanho?: 'sm' | 'md' | 'lg'
}

const DIMENSAO = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-base' } as const

/** Duas iniciais no máximo: primeiro e último nome. */
export function iniciaisDe(nome: string): string {
    const partes = nome.trim().split(/\s+/).filter(Boolean)
    if (partes.length === 0) return '?'
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export function Avatar({ nome, src, tamanho = 'md' }: AvatarProps) {
    return (
        <Ark.Root
            className={cn(
                'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700',
                DIMENSAO[tamanho]
            )}
        >
            <Ark.Fallback className="font-medium text-neutral-700 dark:text-neutral-200">
                {iniciaisDe(nome)}
            </Ark.Fallback>
            {src && <Ark.Image src={src} alt={nome} className="size-full object-cover" />}
        </Ark.Root>
    )
}
