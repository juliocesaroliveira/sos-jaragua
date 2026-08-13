'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from './theme-provider'
import { ANEL_FOCO, cn } from '../cn'

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const isDark = theme === 'dark'

    return (
        <button
            type="button"
            role="switch"
            aria-checked={isDark}
            aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={cn(
                // 44px de área de toque (DESIGN_SYSTEM.md §1.3)
                'inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-surface-muted',
                ANEL_FOCO
            )}
        >
            {isDark ? <Sun aria-hidden className="size-5" /> : <Moon aria-hidden className="size-5" />}
        </button>
    )
}
