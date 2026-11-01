import { ValorIlegivelError } from './erros'

/**
 * Formato do valor protegido: `v1.<iv>.<conteudo>.<tag>` em base64url
 * (research.md D1).
 *
 * O prefixo de versão não é decoração: sem ele, trocar algoritmo ou tamanho de
 * IV no futuro deixaria ambíguo como ler os valores antigos. O script de
 * migração também usa o prefixo para saber o que já está protegido e ser
 * idempotente (FR-007).
 */

export const VERSAO = 'v1'

/** AES-GCM: 12 bytes é o tamanho recomendado de IV; a tag tem 16. */
export const TAMANHO_IV = 12
export const TAMANHO_TAG = 16

export type PartesEnvelope = {
    iv: Buffer
    conteudo: Buffer
    tag: Buffer
}

export function montarEnvelope({ iv, conteudo, tag }: PartesEnvelope): string {
    return [VERSAO, iv.toString('base64url'), conteudo.toString('base64url'), tag.toString('base64url')].join('.')
}

/** `true` quando o texto tem a forma de um envelope desta versão. */
export function ehEnvelope(valor: string): boolean {
    return valor.startsWith(`${VERSAO}.`) && valor.split('.').length === 4
}

export function lerEnvelope(valor: string): PartesEnvelope {
    const partes = valor.split('.')

    if (partes.length !== 4) {
        throw new ValorIlegivelError('o valor armazenado não tem o formato esperado')
    }

    const [versao, iv, conteudo, tag] = partes

    if (versao !== VERSAO) {
        throw new ValorIlegivelError(`versão de formato desconhecida (${versao})`)
    }

    const partesBinarias: PartesEnvelope = {
        iv: Buffer.from(iv!, 'base64url'),
        conteudo: Buffer.from(conteudo!, 'base64url'),
        tag: Buffer.from(tag!, 'base64url')
    }

    if (partesBinarias.iv.length !== TAMANHO_IV) {
        throw new ValorIlegivelError('vetor de inicialização com tamanho inválido')
    }

    if (partesBinarias.tag.length !== TAMANHO_TAG) {
        throw new ValorIlegivelError('tag de autenticação com tamanho inválido')
    }

    return partesBinarias
}
