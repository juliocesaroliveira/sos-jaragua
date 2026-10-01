/**
 * Limiares dos alertas de coordenador (BRD §6, NOT-08; DESIGN.md §17).
 *
 * **Provisórios até confirmação da Defesa Civil** (spec/ROTEIRO_PRODUCAO.md,
 * passo 7). Ficam em variável de ambiente para poderem ser ajustados sem deploy.
 *
 * Moram em `shared` por serem configuração transversal: quem lê é o módulo de
 * notificações (o alerta) e a tela de estoque (para exibir "Padrão (N)"). Em
 * `estoque/infrastructure`, `notificacoes/application` passaria a depender da
 * infraestrutura de outro módulo, o que fere a Constituição, Princípio I
 * (specs/020-resolver-pendencias, research.md D4).
 */

/** Nº de candidaturas pendentes que dispara `cadastros_acumulados`. */
export function limiarCadastrosPendentes(): number {
    const bruto = Number(process.env.ALERTA_CADASTROS_PENDENTES)
    return Number.isFinite(bruto) && bruto > 0 ? bruto : 10
}

/**
 * Mínimo de segurança **padrão**: vale para todo item sem mínimo próprio em
 * `item.estoque_minimo` (`estoque/domain/estoque-minimo.ts`).
 */
export function limiarEstoqueMinimoGlobal(): number {
    const bruto = Number(process.env.ALERTA_ESTOQUE_MINIMO)
    return Number.isFinite(bruto) && bruto >= 0 ? bruto : 5
}

/** % de déficit de capacidade que dispara `deficit_atendimento`. */
export function limiarDeficitPercentual(): number {
    const bruto = Number(process.env.ALERTA_DEFICIT_PERCENTUAL)
    return Number.isFinite(bruto) && bruto > 0 ? bruto : 80
}
