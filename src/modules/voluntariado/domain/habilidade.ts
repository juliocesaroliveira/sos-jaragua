import { DomainError, ValidacaoError } from '@/src/shared/kernel'

/**
 * Regras puras da entidade Habilidade (017-gestao-habilidades).
 *
 * Vive no `domain/` — sem Drizzle, sem Next — porque a normalização é o que
 * define o que conta como duplicata (INV-01/INV-03), e isso é regra de negócio,
 * não detalhe de persistência. O formulário no cliente repete os limites para
 * dar retorno imediato; a autoridade é este arquivo (research.md D8).
 */

export const LIMITES_NOME_HABILIDADE = { min: 2, max: 80 } as const

/**
 * Remove espaços nas pontas e colapsa qualquer sequência de espaços em branco
 * interna num único espaço.
 *
 * **Não altera a caixa** de propósito: o nome é exibido como quem cadastrou
 * digitou ("CNH D/E" não vira "Cnh d/e"). Só a *comparação* de duplicidade
 * ignora caixa, e ela acontece no repositório, via `lower()` (FR-010).
 */
export function normalizarNomeHabilidade(entrada: string): string {
    return entrada.trim().replace(/\s+/g, ' ')
}

/**
 * `null` quando o nome é válido; `ValidacaoError` com a mensagem já no campo
 * `nome` caso contrário — é o formato que `aplicarErrosDoServidor` espera para
 * exibir o erro abaixo do campo em vez de num toast genérico.
 *
 * Valida sobre o nome **normalizado**: "   " é vazio, e 80 caracteres úteis
 * cercados de espaços continuam válidos.
 */
export function validarNomeHabilidade(entrada: string): DomainError | null {
    const nome = normalizarNomeHabilidade(entrada)
    const { min, max } = LIMITES_NOME_HABILIDADE

    if (nome.length === 0) {
        return new ValidacaoError('Revise os campos destacados.', {
            campos: { nome: 'Informe o nome da habilidade.' }
        })
    }

    if (nome.length < min) {
        return new ValidacaoError('Revise os campos destacados.', {
            campos: { nome: `O nome deve ter ao menos ${min} caracteres.` }
        })
    }

    if (nome.length > max) {
        return new ValidacaoError('Revise os campos destacados.', {
            campos: { nome: `O nome deve ter no máximo ${max} caracteres.` }
        })
    }

    return null
}

/**
 * Habilidade já existente com o mesmo nome, ignorando caixa e espaços.
 *
 * Erro próprio — e não `ValidacaoError` genérico — porque a tela precisa
 * distinguir "você digitou algo inválido" de "esse nome já está em uso", e
 * porque o repositório levanta exatamente este erro ao traduzir a violação do
 * índice único (contracts/gestao-habilidades.md C-01.4/C-01.5).
 */
export class DuplicadoError extends DomainError {
    constructor(mensagem = 'Já existe uma habilidade com esse nome.') {
        super('duplicado', mensagem, { campos: { nome: mensagem } })
        this.name = 'DuplicadoError'
    }
}

/**
 * Exclusão recusada porque a habilidade ainda é declarada por voluntários
 * (FR-012, INV-04).
 *
 * A contagem entra na mensagem quando conhecida: dizer "está vinculada a 3
 * voluntários" orienta a próxima ação de quem tentou excluir, coisa que uma
 * recusa seca não faz. No caminho de corrida — vínculo criado entre a contagem
 * e o `DELETE` — o repositório levanta este mesmo erro sem contagem.
 */
export class VinculoExistenteError extends DomainError {
    constructor(quantidade?: number) {
        super(
            'vinculo_existente',
            quantidade === undefined
                ? 'Esta habilidade está vinculada a voluntários. Remova os vínculos antes de excluir.'
                : `Esta habilidade está vinculada a ${quantidade} ${
                      quantidade === 1 ? 'voluntário' : 'voluntários'
                  }. Renomeie-a ou remova os vínculos antes de excluir.`
        )
        this.name = 'VinculoExistenteError'
    }
}
