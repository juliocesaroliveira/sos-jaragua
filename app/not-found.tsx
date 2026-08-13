import type { Metadata } from 'next'
import { destinoDeRetorno } from '@/src/shared/auth/rotas'
import { obterSessao } from '@/src/shared/auth/sessao'
import { ConteudoNaoEncontrado } from '@/src/shared/ui'
import { ShellAutenticado } from './_shell/shell-autenticado'

export const metadata: Metadata = {
    title: 'Endereço não encontrado — SOS Jaraguá'
}

/**
 * A apresentação depende da sessão (cookies), então não há o que prerenderizar
 * aqui — com Cache Components, o build falha ao tentar.
 *
 * Das três saídas que o Next oferece (cachear o acesso, isolar sob `<Suspense>`,
 * ou declarar a rota bloqueante), esta é a coerente com o projeto: todo segmento
 * que lê sessão já declara `instant = false`. Isolar sob `<Suspense>` renderia
 * uma casca estática, mas o destino do botão também depende da sessão — a casca
 * mostraria um botão provisório que trocaria de destino ao resolver. Numa página
 * de erro, um link que muda sob o cursor é pior que um render bloqueante.
 */
export const instant = false

/**
 * Fronteira raiz de "não encontrado" (specs/003-not-found-page).
 *
 * Captura **URLs desconhecidas de toda a aplicação** — a documentação do Next
 * instalado é explícita: *"the root `app/not-found.js` … handle any unmatched
 * URLs for your whole application"*. Como nenhum segmento casou, nenhum layout
 * de área se aplica aqui; por isso é esta página que decide envolver o conteúdo
 * no shell ou não.
 *
 * `notFound()` lançado **dentro** da área autenticada não passa por aqui: é
 * capturado por `(interno)/not-found.tsx`, que renderiza dentro do layout real
 * e por isso já vem com o shell montado.
 *
 * Usa `obterSessao()` e **nunca** `exigirSessao()`: uma página de erro que
 * redireciona seria defeito, não proteção — o visitante sem sessão perderia a
 * mensagem e sairia da tela sem entender o que aconteceu.
 *
 * O `<meta name="robots" content="noindex">` é injetado pelo próprio Next para
 * respostas 404; não o duplicamos aqui.
 */
export default async function NaoEncontrado() {
    const ator = await obterSessao()

    // Sem sessão: nenhuma consulta, nenhum dado de área interna. O componente de
    // conteúdo não recebe ator nem itens de menu, então não há por onde vazar
    // identidade ou estrutura (FR-009/FR-015).
    if (!ator) {
        return <ConteudoNaoEncontrado destino={destinoDeRetorno(false)} rotuloBotao="Ir para a tela de entrada" />
    }

    return (
        <ShellAutenticado ator={ator}>
            <ConteudoNaoEncontrado destino={destinoDeRetorno(true)} rotuloBotao="Voltar para a página inicial" />
        </ShellAutenticado>
    )
}
