import { camposComErro } from '../kernel/action'
import type { DomainErrorPlano } from '../kernel/result'

/**
 * Leva a recusa do servidor para o campo certo do formulário
 * (016-formularios-rhf-zod, FR-012).
 *
 * **Função pura de propósito**: o efeito colateral entra por `definirErro` — na
 * prática o `setError` do react-hook-form. Isso a torna testável com Vitest no
 * ambiente `node` configurado no projeto, sem DOM e sem dependência nova
 * (research.md D9).
 *
 * Substitui o laço `for (const [campo, mensagem] of Object.entries(campos))`
 * que estava copiado em dois formulários, com tratamentos divergentes do erro
 * geral.
 */
export interface AplicarErrosDoServidorParams {
    erro: DomainErrorPlano
    /** Nomes de campo que este formulário conhece — normalmente as chaves do esquema. */
    camposConhecidos: readonly string[]
    definirErro: (campo: string, mensagem: string) => void
}

export interface ErrosDoServidorAplicados {
    /** Mensagem que não pertence a nenhum campo. `null` quando tudo coube nos campos. */
    mensagemGeral: string | null
}

export function aplicarErrosDoServidor({
    erro,
    camposConhecidos,
    definirErro
}: AplicarErrosDoServidorParams): ErrosDoServidorAplicados {
    const campos = camposComErro(erro)
    const entradas = Object.entries(campos)

    if (entradas.length === 0) {
        // Falha de rede, indisponibilidade, credencial inválida: não há campo a
        // culpar, e escolher um arbitrariamente seria pior que não apontar
        // nenhum — no login, apontar o e-mail revelaria que a conta existe.
        return { mensagemGeral: erro.mensagem }
    }

    const orfas: string[] = []
    for (const [campo, mensagem] of entradas) {
        if (camposConhecidos.includes(campo)) {
            definirErro(campo, mensagem)
        } else {
            orfas.push(mensagem)
        }
    }

    /**
     * Mensagem de campo que o formulário não conhece **não** é descartada.
     * Descartar produziria a pior falha possível: envio recusado, nada na tela,
     * e o usuário tentando de novo sem saber o que mudar. Ela sobe para o erro
     * geral, onde ao menos é lida.
     */
    if (orfas.length > 0) {
        return { mensagemGeral: [erro.mensagem, ...orfas].join(' ') }
    }

    return { mensagemGeral: null }
}
