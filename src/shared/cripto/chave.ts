import { hkdfSync } from 'node:crypto'

/**
 * Chave mestra da criptografia a nível de campo (Princípio IV da Constituição,
 * feature 025 / research.md D1 e D3).
 *
 * A chave vive **exclusivamente** em variável de ambiente: nunca no banco, nunca
 * versionada. É o que torna o conteúdo do Postgres inútil para quem obteve um
 * dump sem ter a chave.
 *
 * A leitura é preguiçosa (a cada chamada, não no carregamento do módulo) por dois
 * motivos: permite que `instrumentation.ts` valide no boot com mensagem própria,
 * e permite que os testes troquem a chave para exercitar o caso "chave trocada
 * falha de forma visível".
 */

export const VARIAVEL_CHAVE = 'DADOS_SENSIVEIS_CHAVE'

/** AES-256 e HMAC-SHA256 pedem 32 bytes. */
const TAMANHO_CHAVE = 32

/**
 * Salt fixo de separação de domínio. Não precisa ser secreto (RFC 5869 §3.1) —
 * serve para que esta chave, derivada aqui, nunca colida com uma derivação feita
 * por outro sistema a partir do mesmo segredo.
 */
const SALT = Buffer.from('sos-jaragua:dados-sensiveis:v1')

/** Propósitos distintos: a mesma chave jamais cifra e autentica ao mesmo tempo. */
const INFO_CIFRA = 'sos:cripto:campo:v1'
const INFO_INDICE = 'sos:indice:cpf:v1'
const INFO_REDACAO = 'sos:redacao:auditoria:v1'

function lerChaveMestra(): Buffer {
    const bruto = process.env[VARIAVEL_CHAVE]

    if (!bruto || bruto.trim() === '') {
        throw new Error(
            `${VARIAVEL_CHAVE} ausente. Os dados sensíveis dos voluntários são criptografados e a ` +
                `aplicação não opera sem a chave. Gere uma com: openssl rand -base64 32`
        )
    }

    const chave = Buffer.from(bruto, 'base64')

    // `Buffer.from(_, 'base64')` ignora caracteres inválidos em silêncio, então
    // comparar o tamanho é o que de fato detecta um valor malformado.
    if (chave.length !== TAMANHO_CHAVE) {
        throw new Error(
            `${VARIAVEL_CHAVE} inválida: esperado base64 de exatamente ${TAMANHO_CHAVE} bytes, ` +
                `obtido ${chave.length}. Gere uma com: openssl rand -base64 32`
        )
    }

    return chave
}

/**
 * Valida presença e formato da chave. Chamada por `instrumentation.ts#register`
 * no boot e, em defesa em profundidade, no primeiro uso do módulo de cripto —
 * a mesma lógica de não confiar em uma única checagem que o Princípio IV já
 * aplica em `proxy.ts` + `layout.tsx`.
 */
export function validarChave(): void {
    lerChaveMestra()
}

function derivar(info: string): Buffer {
    return Buffer.from(hkdfSync('sha256', lerChaveMestra(), SALT, info, TAMANHO_CHAVE))
}

/** Subchave usada apenas para cifrar e decifrar valores. */
export function subchaveCifra(): Buffer {
    return derivar(INFO_CIFRA)
}

/** Subchave usada apenas para o índice cego (busca e unicidade de CPF). */
export function subchaveIndice(): Buffer {
    return derivar(INFO_INDICE)
}

/**
 * Subchave usada apenas para a marca de mudança da trilha de auditoria
 * (FR-026).
 *
 * Tem subchave própria, em vez de reaproveitar a do índice, pela mesma razão que
 * separa cifra de índice: um propósito por chave. Reusar a do índice permitiria
 * correlacionar uma marca de auditoria com o `cpf_indice` do banco.
 */
export function subchaveRedacao(): Buffer {
    return derivar(INFO_REDACAO)
}
