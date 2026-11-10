import { createHmac } from 'node:crypto'
import { subchaveRedacao } from '@/src/shared/cripto/chave'

/**
 * Redação dos campos sensíveis antes de a trilha ser gravada
 * (feature 025, FR-026).
 *
 * **O problema que isto resolve**: `withAudit` grava o snapshot *inteiro* do
 * registro alterado. Sem redigir, a trilha imutável no Mongo seria uma segunda
 * cópia legível justamente do que o Postgres passou a cifrar — e a anonimização
 * a pedido do titular (FR-022) ficaria incompleta, porque o CPF continuaria lá.
 *
 * **Por que uma marca derivada, e não um `[redigido]` fixo**: se antes e depois
 * virassem a mesma constante, o diff da trilha deixaria de mostrar que o campo
 * mudou — e detectar alteração silenciosa de um CPF é uma necessidade legítima
 * de auditoria, não um extra. A marca é um HMAC truncado com subchave própria:
 * muda quando o valor muda, e não permite recuperar o valor sem a chave.
 */

/** Campos redigidos, em camelCase (port/domínio) e snake_case (linha crua). */
const CAMPOS_REDIGIDOS = new Set([
    'cpf',
    'cpfIndice',
    'cpf_indice',
    'dataNascimento',
    'data_nascimento',
    'cep'
])

const TAMANHO_MARCA = 8

/**
 * Marca estável de um valor, para detecção de mudança sem reproduzir conteúdo.
 * Truncada porque o objetivo é comparar, não reconstituir.
 */
function marcaDeMudanca(valor: unknown): string {
    const texto = typeof valor === 'string' ? valor : JSON.stringify(valor)
    const marca = createHmac('sha256', subchaveRedacao()).update(texto ?? '', 'utf8').digest('base64url')

    return `[redigido:${marca.slice(0, TAMANHO_MARCA)}]`
}

/**
 * Devolve uma cópia do snapshot com os campos sensíveis redigidos.
 *
 * Valores nulos ou ausentes passam como estão: "não havia valor" não é
 * informação sensível, e preservá-lo mantém o diff da trilha legível.
 */
export function redigirCamposSensiveis(
    snapshot: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
    if (snapshot === null || snapshot === undefined) return null

    const saida: Record<string, unknown> = {}

    for (const [campo, valor] of Object.entries(snapshot)) {
        const sensivel = CAMPOS_REDIGIDOS.has(campo)
        saida[campo] = sensivel && valor !== null && valor !== undefined && valor !== '' ? marcaDeMudanca(valor) : valor
    }

    return saida
}
