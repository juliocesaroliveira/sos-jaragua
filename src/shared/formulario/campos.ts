import { z } from '../validacao/zod-ptbr'

/**
 * Construtores de campo compartilhados entre formulários
 * (016-formularios-rhf-zod, FR-002).
 *
 * Existem por um motivo concreto: as mesmas regras já estavam escritas três
 * vezes, e já tinham divergido. "A senha deve ter ao menos 8 caracteres." no
 * cadastro de conta versus "A senha precisa ter ao menos 8 caracteres." no
 * login — mesma regra, dois textos, nenhuma razão. Centralizar aqui é o que
 * mantém a mensagem igual em toda a aplicação.
 *
 * **Escopo deliberado**: só validação de _forma_. Regra de negócio — dígito
 * verificador do CPF, maioridade — permanece no `domain/`, que é a autoridade
 * (Princípio I; research.md D10). O cliente dá retorno imediato; o servidor
 * decide.
 */

/**
 * `error` é declarado no **tipo**, não só no `.min()`. Quando o campo chega
 * `undefined` — controle nunca tocado —, o `.min()` sequer roda, e o Zod cairia
 * na mensagem do locale em vez da nossa. É a diferença entre "Informe o CPF." e
 * um texto genérico justamente no caso mais comum: o formulário enviado vazio.
 */
export function textoObrigatorio(mensagem: string) {
    return z.string({ error: mensagem }).min(1, mensagem)
}

export function email(mensagem = 'Informe um e-mail válido.') {
    return z.email({ error: mensagem })
}

/** Mínimo de 8 caracteres — a regra do `better-auth` configurada no projeto. */
export function senha(mensagem = 'A senha deve ter ao menos 8 caracteres.') {
    return z.string({ error: mensagem }).min(8, mensagem)
}

/**
 * Seleção única dentro de uma lista fechada (Select, RadioGroup). Recebe a
 * própria constante de domínio (`ROLES`, `TIPOS_VEICULO`), então a lista de
 * opções da interface e a da validação não têm como divergir.
 */
export function selecaoObrigatoria<const T extends readonly [string, ...string[]]>(valores: T, mensagem: string) {
    return z.enum(valores, { error: mensagem })
}

/** Seleção múltipla com ao menos um item (CheckboxGroup). */
export function listaNaoVazia<T extends z.ZodType>(item: T, mensagem: string) {
    return z.array(item, { error: mensagem }).min(1, mensagem)
}
