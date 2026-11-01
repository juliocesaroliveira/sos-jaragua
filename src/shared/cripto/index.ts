import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'
import { subchaveCifra, subchaveIndice } from './chave'
import { lerEnvelope, montarEnvelope, TAMANHO_IV, TAMANHO_TAG } from './envelope'
import { ValorIlegivelError } from './erros'

/**
 * Criptografia a nível de campo dos dados sensíveis de voluntário
 * (feature 024 — `cpf`, `cep`, `dataNascimento`).
 *
 * AES-256-GCM pelo `node:crypto` embutido: nenhuma dependência nova, o que
 * atende ao Princípio VI. GCM é AEAD — detecta adulteração do ciphertext, e é
 * isso que sustenta a falha de leitura explícita de FR-014 em vez de devolver
 * lixo em silêncio.
 */

const ALGORITMO = 'aes-256-gcm'

export { ValorIlegivelError } from './erros'
export { ehEnvelope } from './envelope'
export { validarChave, VARIAVEL_CHAVE } from './chave'

/**
 * Cifra um valor.
 *
 * **Não determinística**: duas chamadas com a mesma entrada produzem saídas
 * diferentes, porque o IV é sorteado a cada vez. É justamente por isso que a
 * unicidade e a busca de CPF não podem se apoiar no ciphertext — para isso
 * existe `indiceCego` (research.md D2).
 */
export function cifrar(valor: string): string {
    const iv = randomBytes(TAMANHO_IV)
    const cifra = createCipheriv(ALGORITMO, subchaveCifra(), iv, { authTagLength: TAMANHO_TAG })
    const conteudo = Buffer.concat([cifra.update(valor, 'utf8'), cifra.final()])

    return montarEnvelope({ iv, conteudo, tag: cifra.getAuthTag() })
}

/**
 * Recupera o valor original.
 *
 * Lança `ValorIlegivelError` quando o envelope é malformado, a versão é
 * desconhecida, a chave é outra, ou a tag de autenticação não valida — nunca
 * devolve string vazia nem valor parcial, porque a tela precisa distinguir
 * "não deu para ler" de "campo vazio" (FR-014).
 */
export function decifrar(envelope: string): string {
    const { iv, conteudo, tag } = lerEnvelope(envelope)

    try {
        const decifra = createDecipheriv(ALGORITMO, subchaveCifra(), iv, { authTagLength: TAMANHO_TAG })
        decifra.setAuthTag(tag)
        return Buffer.concat([decifra.update(conteudo), decifra.final()]).toString('utf8')
    } catch {
        // O erro original do OpenSSL não é propagado de propósito: ele não
        // acrescenta nada acionável e a mensagem daqui é a que chega ao log.
        throw new ValorIlegivelError('a chave de criptografia não confere ou o dado foi alterado')
    }
}

/**
 * Índice cego para busca por igualdade e unicidade de CPF (research.md D2).
 *
 * **Determinístico** por contrato: é o que permite `buscarPorCpf` e o índice
 * único no banco continuarem funcionando com o valor cifrado de forma
 * aleatorizada.
 *
 * O HMAC **com chave secreta** é essencial, não um detalhe de estilo: um CPF tem
 * 11 dígitos, ~10¹¹ possibilidades. Um `SHA-256` simples seria quebrado por
 * força bruta em segundos e devolveria a tabela inteira a quem tem o dump. Com
 * HMAC, quem não tem a chave não consegue montar o dicionário.
 *
 * Normaliza para dígitos, de modo que `123.456.789-01` e `12345678901` caiam no
 * mesmo índice — a formatação é apresentação, não identidade.
 */
export function indiceCego(valor: string): string {
    const digitos = valor.replace(/\D/g, '')

    return createHmac('sha256', subchaveIndice()).update(digitos, 'utf8').digest('base64url')
}
