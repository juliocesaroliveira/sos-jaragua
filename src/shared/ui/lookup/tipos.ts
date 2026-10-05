import type { RowData } from '@tanstack/react-table'
import type { ResultadoAction } from '@/src/shared/kernel'
import type { PaginaDe, ParametrosPaginacao } from '@/src/shared/paginacao/esquema'
import type { ColunaTabela } from '../table/table'

/**
 * De onde um Lookup lê e como ele exibe cada registro
 * (021-componente-lookup, contracts/lookup-componente.md).
 *
 * O componente é agnóstico de módulo: quem conhece as Server Functions, as
 * colunas e o que é a "descrição" de um registro é o módulo dono dos dados,
 * que declara a fonte (ex.: `src/modules/estoque/presentation/lookups`).
 */
export interface FonteLookup<T extends RowData> {
    /** Segmento da queryKey: `['lookup', chave, 'sugestoes' | 'pagina', …]`. */
    chave: string
    /** Até 5 registros compatíveis com o termo (o servidor aplica o limite). */
    sugerir: (entrada: { termo: string }) => Promise<ResultadoAction<T[]>>
    /** Página da tabela do diálogo, paginada no servidor. */
    listar: (entrada: ParametrosPaginacao & { termo?: string }) => Promise<ResultadoAction<PaginaDe<T>>>
    /** Identificador gravado no campo do formulário. */
    idDe: (registro: T) => string
    /** Texto exibido no input quando o registro está selecionado. */
    descricaoDe: (registro: T) => string
    /** Linha secundária da sugestão (ex.: categoria · saldo). */
    detalheDe?: (registro: T) => string
    colunas: ColunaTabela<T>[]
    /** Título do diálogo e rótulo acessível da tabela, ex.: "Pesquisar item". */
    tituloPesquisa: string
}

/** Regra do **uso** (FR-013): um motivo torna o registro visível, mas não selecionável. */
export type MotivoIndisponivel<T> = (registro: T) => string | null
