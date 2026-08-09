import { z } from 'zod'
import { pt } from 'zod/locales'

/**
 * Locale global do Zod em português (NFR §2.2, DEPLOY-05).
 *
 * Sem isto, qualquer validação sem mensagem customizada — um campo `undefined`
 * que nem chega ao `.min()`, um enum recebido fora da lista — cai na mensagem
 * padrão em inglês e vaza para a interface. Importar este módulo uma vez por
 * entry point (layout raiz no cliente, `sessao` no servidor) configura o
 * processo inteiro.
 */
z.config(pt())

export { z }
