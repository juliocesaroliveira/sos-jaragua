import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider, themeInitScript } from '@/src/shared/ui/theme/theme-provider'
import { ThemeToggle } from '@/src/shared/ui/theme/theme-toggle'
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
                    <div className="fixed right-4 top-4 z-50">
                        <ThemeToggle />
                    </div>
                    {children}
                </ThemeProvider>
                <SpeedInsights />
                <Analytics />
            </body>
        </html>
    )
}
