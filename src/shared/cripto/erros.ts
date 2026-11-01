/**
 * Falha de leitura de um valor protegido (FR-014).
 *
 * Existe como erro próprio, e não como `null`, porque a spec exige que a tela
 * distinga "não foi possível ler" de "campo vazio": tratar os dois como
 * ausência faria a operação concluir que um cadastro está incompleto quando o
 * que houve foi chave trocada ou dado corrompido.
 *
 * **Nunca** carrega o valor original na mensagem — a mensagem de erro é um dos
 * lugares que FR-009 proíbe expor dado sensível.
 */
export class ValorIlegivelError extends Error {
    constructor(motivo: string) {
        super(`Não foi possível ler um dado protegido: ${motivo}.`)
        this.name = 'ValorIlegivelError'
    }
}
