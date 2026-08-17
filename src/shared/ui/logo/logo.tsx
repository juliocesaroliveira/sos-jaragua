import Image from 'next/image'
import { cn } from '../cn'
import marca from '@/public/sos-logo.png'

/** Lados em `px` de cada tamanho — a arte é quadrada (brasão circular). */
const LADO_POR_TAMANHO = {
    sm: 28,
    md: 40,
    lg: 72
} as const

export type TamanhoLogo = keyof typeof LADO_POR_TAMANHO

export interface LogoProps {
    tamanho?: TamanhoLogo
    className?: string
    /**
     * Texto alternativo. O padrão é vazio: no uso comum a marca aparece ao lado
     * do nome da aplicação escrito por extenso, e repetir "SOS Jaraguá" faria o
     * leitor de tela anunciar a mesma coisa duas vezes. Só preencha quando a
     * imagem for a **única** identificação no contexto.
     */
    alt?: string
}

/**
 * Marca da aplicação (`public/sos-logo.png`).
 *
 * Componente em vez de `<Image>` solto em cada tela porque os tamanhos são
 * poucos e fixos: assim a marca não aparece em uma dúzia de dimensões avulsas,
 * e trocar a arte é mexer em um arquivo só.
 *
 * `priority` não é ligado aqui — a marca no topo é pequena e o Next já a serve
 * do bundle estático; forçar preload competiria com o conteúdo da página.
 */
export function Logo({ tamanho = 'md', className, alt = '' }: LogoProps) {
    const lado = LADO_POR_TAMANHO[tamanho]

    return (
        <Image
            src={marca}
            alt={alt}
            width={lado}
            height={lado}
            // A arte já é quadrada; `shrink-0` impede que um flex apertado
            // (topbar em telas estreitas) esmague a marca.
            className={cn('shrink-0 select-none', className)}
        />
    )
}
