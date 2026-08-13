import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    // Habilita a diretiva `'use cache'` e o modelo de cache explícito adotado
    // na estratégia de leitura de DESIGN.md §7.
    cacheComponents: true,

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
            }
        ]
    }
}

export default nextConfig
