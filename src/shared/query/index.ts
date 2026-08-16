/**
 * Camada de dados no cliente (007-datatable-server-pagination).
 *
 * `hidratacao.ts` não é reexportado aqui: é `server-only` e reexportá-lo
 * quebraria qualquer componente de cliente que importasse deste barril.
 */
export { QueryProvider } from './query-provider'
export { useListagemPaginada } from './use-listagem-paginada'
export {
    chaveUsuarios,
    chaveVoluntarios,
    chaveEstoque,
    chaveSaidas,
    chaveNotificacoes,
    RAIZ_USUARIOS,
    RAIZ_VOLUNTARIOS,
    RAIZ_ESTOQUE,
    RAIZ_SAIDAS
} from './chaves'
