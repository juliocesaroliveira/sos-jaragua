/**
 * Validação de configuração no boot (feature 024, FR-003).
 *
 * A doc do Next instalado (`01-app/03-api-reference/03-file-conventions/
 * instrumentation.md`) garante que `register` é chamado **uma vez** por
 * instância do servidor e **precisa concluir antes de o servidor atender
 * requisições** — exatamente a semântica que FR-003 pede.
 *
 * Lançar aqui derruba o boot de propósito: o Princípio IV da Constituição
 * determina que a aplicação não opere em modo degradado gravando dado
 * desprotegido. Descobrir a chave ausente no primeiro cadastro, com um
 * voluntário esperando, seria pior do que não subir.
 *
 * ## Por que o import é dinâmico e condicionado ao runtime
 *
 * O Next empacota `instrumentation.ts` para **os dois** runtimes, Node e Edge, e
 * `node:crypto` não existe no Edge — um import estático fazia o build acusar
 * "A Node.js module is loaded which is not supported in the Edge Runtime". O
 * módulo de cripto só é carregado no runtime onde ele roda de fato.
 *
 * A validação não se perde no Edge: a chave é usada apenas em caminhos Node
 * (repositórios, Server Actions, scripts), e o módulo de cripto revalida no
 * primeiro uso — a mesma defesa em profundidade que o projeto já aplica em
 * `proxy.ts` + `(staff)/layout.tsx`.
 */
export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return

    const { validarChave } = await import('@/src/shared/cripto')
    validarChave()
}
