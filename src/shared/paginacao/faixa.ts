/** Derivados exibidos pelo rodapé (FR-003). Não trafegam pela rede. */
export function calcularFaixa({ page, pageSize, totalCount }: { page: number; pageSize: number; totalCount: number }) {
    const totalPaginas = totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize)
    const primeiro = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
    const ultimo = Math.min(page * pageSize, totalCount)
    return { totalPaginas, primeiro, ultimo }
}
