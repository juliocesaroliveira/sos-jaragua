'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from './theme-provider'
import { ANEL_FOCO, cn } from '../cn'
import { Tooltip } from '../tooltip/tooltip'

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const isDark = theme === 'dark'

    /*
      Um rótulo só, para os dois consumidores (015-tooltip-acoes-icone, C-04.3).
      Ele descreve a ação do **próximo** estado, não o atual — e por derivar de
      `isDark` a cada render, muda junto com o tema sem que a dica precise ser
      fechada e reaberta.
    */
    const rotulo = isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'

    return (
        <Tooltip conteudo={rotulo} posicao="bottom">
            <button
                type="button"
                role="switch"
                aria-checked={isDark}
                aria-label={rotulo}
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className={cn(
                    // 44px de área de toque (DESIGN_SYSTEM.md §1.3)
                    'inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-surface-muted',
                    ANEL_FOCO
                )}
            >
                {isDark ? <Sun aria-hidden className="size-5" /> : <Moon aria-hidden className="size-5" />}
            </button>
        </Tooltip>
    )
}
