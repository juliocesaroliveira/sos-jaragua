import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider, themeInitScript } from '@/src/shared/ui/theme/theme-provider'
import { Toaster } from '@/src/shared/ui/toast/toast'
import '@/app/globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
    title: 'SOS Jaraguá',
    description: 'Gestão e mobilização em situações de emergência — Defesa Civil de Jaraguá do Sul'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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
