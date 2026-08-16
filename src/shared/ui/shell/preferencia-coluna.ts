/**
 * Preferência de apresentação da coluna de navegação em telas grandes
 * (013-navegacao-lateral-responsiva, contracts/coluna-recolhivel.md C-02/C-03).
 *
 * Espelha deliberadamente o padrão de `themeInitScript`
 * (`src/shared/ui/theme/theme-provider.tsx`): a preferência é aplicada por
 * script inline no `<head>`, **antes da hidratação**, gravando um atributo no
 * elemento raiz que o CSS consome.
 *
 * Sem isso, a coluna renderiza expandida no HTML do servidor e salta para
 * recolhida assim que o React hidrata — um salto de largura de ~224px em toda
 * navegação, que é pior que não ter a funcionalidade.
 */

export type PreferenciaColuna = 'expandida' | 'recolhida'

export const PREFERENCIA_PADRAO: PreferenciaColuna = 'expandida'

const CHAVE_ARMAZENAMENTO = 'nav-coluna'

/** Atributo no `<html>` que o CSS lê para dimensionar a coluna. */
export const ATRIBUTO_COLUNA = 'data-nav'

/**
 * Resolve o valor cru vindo do armazenamento para um estado conhecido.
 *
 * `localStorage` é território hostil: o valor pode estar ausente na primeira
 * visita, corrompido por outra aba, ou gravado por uma versão futura que
 * conheça um terceiro estado. Em todos os casos o usuário precisa encontrar a
 * coluna expandida (FR-017), nunca um estado indefinido.
 */
export function normalizarPreferenciaColuna(valor: string | null | undefined): PreferenciaColuna {
    return valor === 'expandida' || valor === 'recolhida' ? valor : PREFERENCIA_PADRAO
}

/**
 * Script inline injetado no `<head>` — roda antes de qualquer JavaScript de
 * aplicação. O `try/catch` cobre navegadores com armazenamento bloqueado, onde
 * o mero acesso a `localStorage` lança.
 */
export const preferenciaColunaInitScript = `(function () {
  try {
    var v = window.localStorage.getItem('${CHAVE_ARMAZENAMENTO}');
    var pref = (v === 'expandida' || v === 'recolhida') ? v : '${PREFERENCIA_PADRAO}';
    document.documentElement.setAttribute('${ATRIBUTO_COLUNA}', pref);
  } catch (e) {
    document.documentElement.setAttribute('${ATRIBUTO_COLUNA}', '${PREFERENCIA_PADRAO}');
  }
})();`

/** Lê a preferência já aplicada ao documento pelo script acima. */
export function lerPreferenciaAplicada(): PreferenciaColuna {
    if (typeof document === 'undefined') return PREFERENCIA_PADRAO
    return normalizarPreferenciaColuna(document.documentElement.getAttribute(ATRIBUTO_COLUNA))
}

/** Aplica e persiste. A gravação é imediata; não há estado intermediário. */
export function aplicarPreferenciaColuna(preferencia: PreferenciaColuna): void {
    document.documentElement.setAttribute(ATRIBUTO_COLUNA, preferencia)
    try {
        window.localStorage.setItem(CHAVE_ARMAZENAMENTO, preferencia)
    } catch {
        // Armazenamento bloqueado: a escolha vale para esta sessão e não
        // persiste. Perder a preferência é aceitável; quebrar o clique não é.
    }
}
