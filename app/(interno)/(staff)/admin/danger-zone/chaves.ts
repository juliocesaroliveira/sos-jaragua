/**
 * `queryKey`s da Danger Zone. Sem `cacheTag` espelho no servidor: as leituras
 * daqui são sempre frescas (inventário e prévia nunca entram em `'use cache'` —
 * contagem defasada numa tela que apaga dados é pior que uma consulta a mais).
 */
export const RAIZ_DANGER_ZONE = ['danger-zone'] as const
export const CHAVE_INVENTARIO = [...RAIZ_DANGER_ZONE, 'inventario'] as const
export const chaveRegistros = (tabela: string, params: { page: number; pageSize: number; busca: string }) =>
    [...RAIZ_DANGER_ZONE, 'registros', tabela, params] as const
export const chaveHistorico = (params: { page: number; pageSize: number }) =>
    [...RAIZ_DANGER_ZONE, 'historico', params] as const
