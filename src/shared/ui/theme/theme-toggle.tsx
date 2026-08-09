'use client'

import { useTheme } from './theme-provider'

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
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-foreground/15 text-sm transition-colors hover:bg-foreground/10"
        >
            {isDark ? '☀️' : '🌙'}
        </button>
    )
}
