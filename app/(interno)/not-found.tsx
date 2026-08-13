import { destinoDeRetorno } from '@/src/shared/auth/rotas'
import { ConteudoNaoEncontrado } from '@/src/shared/ui'

/**
 * Fronteira de "não encontrado" da área autenticada (specs/003-not-found-page).
 *
 * Captura `notFound()` lançado em qualquer ponto sob `(interno)`, incluindo
 * `(staff)` — por exemplo, uma atividade cujo identificador não existe.
 *
 * **Não monta o shell.** Diferente da fronteira raiz, aqui o `(interno)/layout.tsx`
 * já rodou e continua na árvore: a documentação do Next instalado descreve que
 * uma fronteira aninhada renderiza entre `loading` e `page`, dentro dos layouts
 * do seu segmento. Montar o shell de novo produziria topbar e menu duplicados.
 *
 * Como o layout acima já exigiu sessão antes de qualquer render deste segmento,
 * o destino do botão é o autenticado sem precisar reler a sessão.
 */
export default function NaoEncontradoInterno() {
    return <ConteudoNaoEncontrado destino={destinoDeRetorno(true)} rotuloBotao="Voltar para a página inicial" />
}
