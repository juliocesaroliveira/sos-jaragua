/**
 * Marcas dos provedores de login social.
 *
 * Não vêm do `lucide-react` (o pacote não distribui logotipos de marca, por
 * serem material registrado com regras próprias de uso) nem de um pacote de
 * ícones de marca só para dois logotipos. São os SVGs oficiais, embutidos, com
 * as cores fixas de cada marca — as diretrizes de Google e Meta exigem o
 * logotipo na cor original, então eles **não** herdam `currentColor` e ficam
 * legíveis nos dois temas sobre a superfície clara do botão secundário.
 *
 * `aria-hidden`: o rótulo do botão ("Acessar com Google") já nomeia o provedor;
 * anunciar o logotipo de novo seria repetição para quem usa leitor de tela.
 */

interface IconeProvedorProps {
    /** Classe de dimensão do botão — `size-5` para `size="lg"` (§ Button). */
    className?: string
}

export function IconeGoogle({ className }: IconeProvedorProps) {
    return (
        <svg aria-hidden className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
                fill="#4285F4"
                d="M23.52 12.273c0-.851-.076-1.67-.218-2.455H12v4.642h6.458a5.52 5.52 0 0 1-2.395 3.622v3.01h3.878c2.269-2.09 3.579-5.166 3.579-8.819Z"
            />
            <path
                fill="#34A853"
                d="M12 24c3.24 0 5.956-1.075 7.941-2.908l-3.878-3.01c-1.075.72-2.45 1.145-4.063 1.145-3.125 0-5.77-2.11-6.715-4.947H1.276v3.109A11.995 11.995 0 0 0 12 24Z"
            />
            <path
                fill="#FBBC05"
                d="M5.285 14.28a7.213 7.213 0 0 1 0-4.56V6.611H1.276a11.995 11.995 0 0 0 0 10.778l4.009-3.109Z"
            />
            <path
                fill="#EA4335"
                d="M12 4.773c1.762 0 3.344.606 4.588 1.795l3.442-3.442C17.951 1.19 15.235 0 12 0 7.31 0 3.255 2.69 1.276 6.611l4.009 3.109C6.23 6.883 8.875 4.773 12 4.773Z"
            />
        </svg>
    )
}

export function IconeFacebook({ className }: IconeProvedorProps) {
    return (
        <svg aria-hidden className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
                fill="#1877F2"
                d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.412c0-3.026 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.931-1.956 1.886v2.265h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z"
            />
        </svg>
    )
}
