import {
    array,
    boolean,
    coerce,
    config,
    email,
    enum as enumeracao,
    number,
    object,
    preprocess,
    string,
    union,
    uuid,
    type ZodSafeParseResult as ZodSafeParseResultOriginal,
    type ZodType as ZodTypeOriginal,
    type infer as inferOriginal
} from 'zod'
// Só o locale pt, pelo subpath do arquivo — ver a nota sobre bundle abaixo.
import pt from 'zod/v4/locales/pt.js'

/**
 * Locale global do Zod em português (NFR §2.2, DEPLOY-05).
 *
 * Sem isto, qualquer validação sem mensagem customizada — um campo `undefined`
 * que nem chega ao `.min()`, um enum recebido fora da lista — cai na mensagem
 * padrão em inglês e vaza para a interface. Importar este módulo uma vez por
 * entry point (layout raiz no cliente, `sessao` no servidor) configura o
 * processo inteiro.
 */
config(pt())

/**
 * O `z` do projeto: **só** o que as telas e actions usam, montado a partir de
 * imports nomeados.
 *
 * O `z` do pacote é o namespace inteiro do Zod — inclusive `z.locales`, com os
 * ~50 idiomas. Como esse objeto escapa como valor, o bundler não consegue
 * eliminar nada dele, e todas as rotas carregavam ~55 KB comprimidos de
 * mensagens em hebraico, lituano, russo… Com imports nomeados, só o que está
 * aqui entra no bundle do cliente.
 *
 * Precisa de outro construtor do Zod? Acrescente-o ao objeto (e ao import).
 */
export const z = {
    array,
    boolean,
    coerce,
    config,
    email,
    enum: enumeracao,
    number,
    object,
    preprocess,
    string,
    union,
    uuid
}

/** Tipos usados como `z.infer<…>`, `z.ZodType`… — namespace só de tipos. */
// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace z {
    export type infer<T> = inferOriginal<T>
    export type ZodType<Output = unknown, Input = unknown> = ZodTypeOriginal<Output, Input>
    export type ZodSafeParseResult<T> = ZodSafeParseResultOriginal<T>
}
