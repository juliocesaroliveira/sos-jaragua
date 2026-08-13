import type { MetadataRoute } from 'next'

/**
 * Web App Manifest — torna a aplicação instalável na tela inicial.
 *
 * O caso de uso justifica: a operação acontece em campo, no celular, sob
 * conectividade instável (constituição, Princípio VI). Um atalho na tela
 * inicial que abre em tela cheia, sem barra de endereço, encurta o caminho de
 * quem precisa registrar uma saída de estoque no meio de uma ocorrência.
 *
 * Os ícones são gerados por `scripts/gerar-icones-pwa.mjs` — reproduzíveis, e
 * não binários de origem desconhecida.
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'SOS Jaraguá — Defesa Civil',
        short_name: 'SOS Jaraguá',
        description: 'Gestão e mobilização em situações de emergência — Defesa Civil de Jaraguá do Sul',
        lang: 'pt-BR',
        dir: 'ltr',

        // A home é ciente do perfil e monta os atalhos de cada um, então serve
        // como ponto de entrada único (specs/002-role-based-app-shell).
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',

        // Cor da splash e da barra do sistema. Fixa por especificação — o tema
        // claro/escuro da interface é tratado por `viewport.themeColor` no
        // layout raiz, que aceita media query.
        background_color: '#ffffff',
        theme_color: '#ea580c',

        categories: ['productivity', 'utilities'],

        icons: [
            { src: '/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            // `maskable` é full-bleed: o sistema recorta na forma dele (círculo
            // no Android, squircle no iOS). Sem esta variante, o ícone `any`
            // ganharia bordas brancas ou seria cortado no símbolo.
            { src: '/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
    }
}
