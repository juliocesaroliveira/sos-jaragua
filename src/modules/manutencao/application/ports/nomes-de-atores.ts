/**
 * Nome de quem executou cada ação do histórico. Implementado pela leitura de
 * usuários do módulo Identidade e ligado na action — o `manutencao` não lê
 * `user` para isso (Princípio I).
 */
export type NomesDeAtores = (ids: readonly string[]) => Promise<Map<string, string>>
