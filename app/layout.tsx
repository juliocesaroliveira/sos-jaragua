import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider, themeInitScript } from '@/src/shared/ui/theme/theme-provider'
import { preferenciaColunaInitScript } from '@/src/shared/ui/shell/preferencia-coluna'
import { Toaster } from '@/src/shared/ui/toast/toast'
import '@/app/globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
    title: 'SOS Jaraguá',
    description: 'Gestão e mobilização em situações de emergência — Defesa Civil de Jaraguá do Sul',
    // O manifest (`app/manifest.ts`) já declara os ícones da instalação; o
    // `apple-touch-icon` é declarado aqui porque o iOS o lê do HTML, não do
    // manifest.
    appleWebApp: {
        capable: true,
        title: 'SOS Jaraguá',
        // `default` mantém a barra de status legível nos dois temas; `black`
        // esconderia o texto sobre o topbar claro.
        statusBarStyle: 'default'
    },
    icons: {
        apple: '/apple-touch-icon.png'
    }
}

/**
 * A cor da barra do sistema acompanha o tema da interface — o manifest só
 * aceita um valor fixo, mas o `viewport` aceita media query. Sem isto, a barra
 * ficaria branca sobre uma aplicação em modo escuro.
 *
 * `viewportFit: 'cover'` é o que faz o conteúdo alcançar as bordas em telas com
 * notch quando instalado em tela cheia.
 */
export const viewport: Viewport = {
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#ffffff' },
        { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' }
    ],
    viewportFit: 'cover'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
                {/* Mesma razão do script de tema: aplicar antes da hidratação
                    evita que a coluna de navegação apareça expandida e salte
                    para recolhida a cada navegação
                    (013-navegacao-lateral-responsiva, C-02). */}
                <script dangerouslySetInnerHTML={{ __html: preferenciaColunaInitScript }} />
            </head>
            <body>
                <ThemeProvider>
                    {children}
                    {/* Toaster único da aplicação (DESIGN_SYSTEM.md §4.8) — o
                        ThemeToggle fica no header de cada shell, não flutuando
                        sobre o conteúdo. */}
                    <Toaster />
                </ThemeProvider>
                <SpeedInsights />
                <Analytics />
            </body>
        </html>
    )
}
