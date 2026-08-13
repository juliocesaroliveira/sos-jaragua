/**
 * `Result<T, E>` — retorno explícito de sucesso/falha usado por todo caso de uso
 * (DESIGN.md §5). Evita `throw` como fluxo de controle entre camadas e permite
 * que a `presentation` devolva erros tipados e serializáveis ao cliente.
 */
export type Result<T, E = DomainError> = { ok: true; valor: T } | { ok: false; erro: E }

export function ok<T>(valor: T): Result<T, never> {
    return { ok: true, valor }
}

export function falha<E>(erro: E): Result<never, E> {
    return { ok: false, erro }
}

export function ehOk<T, E>(resultado: Result<T, E>): resultado is { ok: true; valor: T } {
    return resultado.ok
}

export function ehFalha<T, E>(resultado: Result<T, E>): resultado is { ok: false; erro: E } {
    return !resultado.ok
}

/**
 * Erro de domínio — carrega um `codigo` estável (usado por testes e por telas
 * que precisam reagir a um erro específico) e uma `mensagem` já em pt-BR,
 * pronta para exibição ao operador (NFR §2.2).
 */
export class DomainError extends Error {
    readonly codigo: string
    readonly detalhes?: Record<string, unknown>

    constructor(codigo: string, mensagem: string, detalhes?: Record<string, unknown>) {
        super(mensagem)
        this.name = 'DomainError'
        this.codigo = codigo
        this.detalhes = detalhes
    }

    /** Forma serializável — Server Actions só retornam dados planos. */
    paraObjeto(): DomainErrorPlano {
        return { codigo: this.codigo, mensagem: this.message, detalhes: this.detalhes }
    }
}

export type DomainErrorPlano = {
    codigo: string
    mensagem: string
    detalhes?: Record<string, unknown>
}

/** Erro de validação com uma mensagem por campo/item afetado. */
export class ValidacaoError extends DomainError {
    constructor(mensagem: string, detalhes?: Record<string, unknown>) {
        super('validacao', mensagem, detalhes)
        this.name = 'ValidacaoError'
    }
}

/** Ator autenticado não tem permissão para a operação solicitada. */
export class AutorizacaoError extends DomainError {
    constructor(mensagem = 'Você não tem permissão para executar esta ação.') {
        super('nao_autorizado', mensagem)
        this.name = 'AutorizacaoError'
    }
}

/** Recurso referenciado não existe. */
export class NaoEncontradoError extends DomainError {
    constructor(mensagem = 'Registro não encontrado.') {
        super('nao_encontrado', mensagem)
        this.name = 'NaoEncontradoError'
    }
}
