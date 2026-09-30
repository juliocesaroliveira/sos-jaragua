import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    // Habilita a diretiva `'use cache'` e o modelo de cache explícito adotado
    // na estratégia de leitura de DESIGN.md §7.
    cacheComponents: true,

    // Um cabeçalho a menos em toda resposta; não informa nada a quem usa.
    poweredByHeader: false,

    /**
     * Otimização de imagem (cada variante gerada conta na cota da Vercel).
     *
     * As duas imagens do app são imports estáticos (logo e fundo do login),
     * com hash no nome — então o cache pode durar o máximo sem risco de servir
     * versão velha. Os tamanhos cobrem o que elas realmente usam: o logo em
     * 28/40/72px (1x e 2x) e o fundo do login em `100vw` a partir de `md`.
     * Menos larguras possíveis = menos variantes geradas e armazenadas.
     */
    images: {
        minimumCacheTTL: 2678400, // 31 dias
        deviceSizes: [640, 828, 1200, 1920, 2048],
        imageSizes: [32, 48, 64, 96, 128, 256],
        qualities: [75]
    },

    /**
     * Cabeçalhos de segurança recomendados pela guia de PWA do Next.
     *
     * Passam a valer para toda a aplicação, não só para a instalação: uma vez
     * que a aplicação roda em tela cheia num dispositivo de campo, o custo de
     * uma página embutida em iframe hostil ou de um MIME sniffado sobe.
     *
     * `Permissions-Policy` desliga o que a aplicação não usa — câmera,
     * microfone e geolocalização. Se alguma feature futura precisar de
     * localização (georreferenciar uma ocorrência é plausível), esta linha é
     * onde liberar, conscientemente.
     */
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
                ]
            },
            {
                // O manifest é público por natureza, mas não deve ficar preso em
                // cache de CDN por muito tempo: mudar nome ou ícone da aplicação
                // não pode depender de purga manual.
                source: '/manifest.webmanifest',
                headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }]
            },
            {
                // Ícones da instalação: sem hash no nome (o manifest os aponta
                // por caminho fixo), então não dá para `immutable` — mas uma
                // semana de cache poupa uma requisição por visita. Trocar a
                // arte é raro, e o navegador revalida depois da semana.
                source: '/:icone(icone-192\.png|icone-512\.png|icone-maskable-512\.png|apple-touch-icon\.png)',
                headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }]
            }
        ]
    }
}

export default nextConfig
