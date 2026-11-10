/**
 * Máscaras dos dados sensíveis (feature 025, FR-010 e FR-011).
 *
 * Funções **puras**: sem I/O e sem import de Next, Drizzle ou Mongo. Ficam
 * separadas da cripto de propósito — concentram regra, então o Princípio III
 * exige que rodem em milissegundos, sem infraestrutura.
 */

/** Caractere de preenchimento das máscaras. */
export const MARCADOR = '•'

/**
 * Abaixo deste tamanho, a regra 2+2 revelaria praticamente o valor inteiro —
 * então o valor é mascarado por completo (FR-010, regra de exposição mínima).
 */
const TAMANHO_MINIMO_PARA_EXPOR = 6

function somenteDigitos(valor: string): string {
    return valor.replace(/\D/g, '')
}

/**
 * Preserva os 2 primeiros e os 2 últimos caracteres; o meio vira marcador.
 * Valores com 5 caracteres ou menos são mascarados por inteiro.
 */
function mascarar2mais2(valor: string): string {
    if (valor.length < TAMANHO_MINIMO_PARA_EXPOR) {
        return MARCADOR.repeat(valor.length)
    }

    return valor.slice(0, 2) + MARCADOR.repeat(valor.length - 4) + valor.slice(-2)
}

/** `12345678901` → `12•••••••01` */
export function mascararCpf(cpf: string): string {
    return mascarar2mais2(somenteDigitos(cpf))
}

/** `89250000` → `89••••00` */
export function mascararCep(cep: string): string {
    return mascarar2mais2(somenteDigitos(cep))
}

/**
 * `1990-03-15` → `••/••/1990`.
 *
 * O ano permanece legível porque a decisão Q1 classificou como sensíveis o dia e
 * o mês, não o ano — e é o ano que sustenta maioridade e qualquer faixa etária
 * futura. Valor fora do formato `YYYY-MM-DD` é mascarado por inteiro, em vez de
 * exibido cru.
 */
export function mascararData(iso: string): string {
    const casa = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)

    if (!casa) {
        return `${MARCADOR.repeat(2)}/${MARCADOR.repeat(2)}/${MARCADOR.repeat(4)}`
    }

    return `${MARCADOR.repeat(2)}/${MARCADOR.repeat(2)}/${casa[1]}`
}

/**
 * Forma com que um campo sensível chega à UI. São três estados mutuamente
 * exclusivos para que a tela distinga "sem valor" de "valor oculto" e de "não
 * deu para ler" (FR-013, FR-014) — tratar os três como string vazia faria a
 * operação concluir que um cadastro está incompleto.
 *
 * O valor completo **nunca** viaja nesta forma: ele só sai pelo caminho de
 * revelação, que confere a Matriz de Visibilidade e audita.
 */
export type ApresentacaoCampo =
    | { estado: 'mascarado'; exibicao: string }
    | { estado: 'ausente' }
    | { estado: 'ilegivel' }

/** Converte um valor já decifrado na forma de apresentação mascarada. */
export function apresentar(
    valor: string | null | undefined,
    mascarador: (valor: string) => string
): ApresentacaoCampo {
    if (valor === null || valor === undefined || valor === '') {
        return { estado: 'ausente' }
    }

    return { estado: 'mascarado', exibicao: mascarador(valor) }
}

/** Atalho para o caso em que a decifragem falhou (FR-014). */
export const CAMPO_ILEGIVEL: ApresentacaoCampo = { estado: 'ilegivel' }
