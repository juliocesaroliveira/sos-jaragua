import 'server-only'
import { QueryClient, dehydrate, type DehydratedState } from '@tanstack/react-query'

/**
 * Empacota dados já resolvidos no servidor para o cache do cliente
 * (007-datatable-server-pagination, D5/L-05).
 *
 * O Server Component continua resolvendo a **primeira** página pela query
 * `'use cache'`; sem isto o cliente abriria a tela vazia e só então dispararia
 * a Server Function — um waterfall visível na abertura de cada listagem.
 *
 * A chave passada aqui precisa ser idêntica à do `useQuery` correspondente;
 * qualquer divergência silenciosa vira um POST redundante no primeiro render.
 */
export function estadoHidratado(entradas: { chave: readonly unknown[]; dados: unknown }[]): DehydratedState {
    const queryClient = new QueryClient()
    for (const { chave, dados } of entradas) {
        queryClient.setQueryData(chave, dados)
    }
    return dehydrate(queryClient)
}
