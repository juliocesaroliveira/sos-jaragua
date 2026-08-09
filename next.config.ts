import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    // Habilita a diretiva `'use cache'` e o modelo de cache explícito adotado
    // na estratégia de leitura de DESIGN.md §7.
    cacheComponents: true
}

export default nextConfig
