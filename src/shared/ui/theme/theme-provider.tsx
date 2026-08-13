'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

type ThemeContextValue = {
    theme: Theme
    setTheme: (theme: Theme) => void
}

const STORAGE_KEY = 'theme'

/**
 * Aplicado via <script> inline no <head> (antes da hidratação) para evitar
 * flash de tema incorreto. Decide entre localStorage, preferência do sistema
 * e o padrão 'light', nessa ordem.
 */
export const themeInitScript = `(function () {
  try {
    var stored = window.localStorage.getItem('${STORAGE_KEY}');
    var theme = stored === 'dark' || stored === 'light'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.style.colorScheme = theme;
  } catch (e) {}
})();`

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredTheme(): Theme {
    if (typeof document === 'undefined') return 'light'
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/**
 * O estado inicial é sempre 'light' — inclusive no cliente — para que a
 * primeira renderização do cliente seja idêntica ao HTML do servidor. O tema
 * real já está aplicado nas classes do <html> pelo `themeInitScript`, então não
 * há flash visual; o `useEffect` abaixo apenas sincroniza o estado do React.
 * Ler o DOM no inicializador do `useState` causaria erro de hidratação.
 */
const TEMA_INICIAL: Theme = 'light'

function applyTheme(theme: Theme) {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme === 'light')
    root.style.colorScheme = theme
    window.localStorage.setItem(STORAGE_KEY, theme)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(TEMA_INICIAL)

    useEffect(() => {
        setThemeState(readStoredTheme())
    }, [])

    const setTheme = useCallback((next: Theme) => {
        setThemeState(next)
        applyTheme(next)
    }, [])

    return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme deve ser usado dentro de <ThemeProvider>')
    }
    return context
}
