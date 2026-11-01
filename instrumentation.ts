import { validarChave } from '@/src/shared/cripto'

/**
 * Validação de configuração no boot (feature 024, FR-003).
 *
 * A doc do Next instalado (`01-app/03-api-reference/03-file-conventions/
 * instrumentation.md`) garante que `register` é chamado **uma vez** por
 * instância do servidor e **precisa concluir antes de o servidor atender
 * requisições** — que é exatamente a semântica que FR-003 pede.
 *
 * Lançar aqui derruba o boot de propósito: o Princípio IV da Constituição
 * determina que a aplicação não opere em modo degradado gravando dado
 * desprotegido. Descobrir a chave ausente no primeiro cadastro, com um
 * voluntário esperando, seria pior do que não subir.
 *
 * O módulo de cripto revalida no primeiro uso — a mesma defesa em profundidade
 * que o projeto já aplica em `proxy.ts` + `(staff)/layout.tsx`.
 */
export function register(): void {
    validarChave()
}
