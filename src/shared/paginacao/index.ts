/**
 * Contrato único de paginação (007-datatable-server-pagination).
 *
 * Servidor e cliente importam daqui — é o que garante que os dois lados
 * concordem sobre tamanhos válidos, valor padrão e saneamento.
 */
export { TAMANHOS_PAGINA, TAMANHO_PAGINA_PADRAO, ehTamanhoPagina, type TamanhoPagina } from './constantes'
export {
    esquemaPaginacao,
    normalizarPaginacao,
    clampPagina,
    paginarComClamp,
    type ParametrosPaginacao,
    type PaginaDe
} from './esquema'
export { calcularFaixa } from './faixa'
export { useParametrosListagem } from './use-parametros-listagem'
