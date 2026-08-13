import { DomainError, type DomainErrorPlano, type Result } from './result'

/**
 * Forma serializável de `Result`, para atravessar a fronteira Server Action →
 * cliente. Instâncias de `DomainError` são classes e não sobrevivem à
 * serialização do React — só o objeto plano passa (DESIGN.md §4).
 */
export type ResultadoAction<T> = { ok: true; valor: T } | { ok: false; erro: DomainErrorPlano }

export function serializar<T>(resultado: Result<T, DomainError>): ResultadoAction<T> {
    return resultado.ok ? { ok: true, valor: resultado.valor } : { ok: false, erro: resultado.erro.paraObjeto() }
}

export function erroAction(codigo: string, mensagem: string): ResultadoAction<never> {
    return { ok: false, erro: { codigo, mensagem } }
}

/** Erros por campo devolvidos por `ValidacaoError` — usados pelo react-hook-form. */
export function camposComErro(erro: DomainErrorPlano): Record<string, string> {
    const campos = erro.detalhes?.campos
    return campos && typeof campos === 'object' ? (campos as Record<string, string>) : {}
}
