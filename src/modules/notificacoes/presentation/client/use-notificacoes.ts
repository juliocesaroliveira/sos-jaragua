'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { chaveNotificacoes } from '@/src/shared/query'
import { marcarComoLida, marcarTodasComoLidas } from '../actions/notificacoes'
import type { NotificacaoInApp } from '../queries/notificacoes'
import { INTERVALO_MS, proximoIntervalo } from './politica-intervalo'

/**
 * Sino que se atualiza sozinho (012-notificacoes-tempo-real,
 * contracts/sino-cliente.md).
 *
 * O componente do sino não conhece intervalo, foco, recuo progressivo nem
 * otimismo — tudo isso vive aqui, para que ele permaneça apresentação.
 */

export type EstadoNotificacoes = {
    notificacoes: NotificacaoInApp[]
    naoLidas: number
}

/** Status que significa "a sessão acabou" — o cliente para em definitivo. */
const STATUS_SEM_SESSAO = 401

class SemSessaoError extends Error {
    constructor() {
        super('Sessão encerrada.')
        this.name = 'SemSessaoError'
    }
}

async function buscarNotificacoes(sinal: AbortSignal): Promise<EstadoNotificacoes> {
    const resposta = await fetch('/api/notificacoes', { signal: sinal })

    // Distinguir 401 de falha de rede é o que permite parar em vez de espaçar
    // (data-model.md R4).
    if (resposta.status === STATUS_SEM_SESSAO) throw new SemSessaoError()
    if (!resposta.ok) throw new Error('Não foi possível atualizar as notificações.')

    return (await resposta.json()) as EstadoNotificacoes
}

export function useNotificacoes(semente: EstadoNotificacoes) {
    const queryClient = useQueryClient()
    const chave = chaveNotificacoes()

    // O instante em que o Server Component resolveu a semente. Fixado uma vez
    // por montagem: sem isto o TanStack trataria a semente como recém-obtida a
    // cada render e adiaria o primeiro ciclo (research.md D5).
    const [sementeObtidaEm] = useState(() => Date.now())

    const query = useQuery({
        queryKey: chave,
        queryFn: ({ signal }) => buscarNotificacoes(signal),

        // Dado real vindo do banco pelo Server Component — vai para o cache
        // (`initialData`), não é placeholder de UI. Evita o waterfall de abrir o
        // sino vazio e só então consultar.
        initialData: semente,
        initialDataUpdatedAt: sementeObtidaEm,

        refetchInterval: (q) =>
            proximoIntervalo({
                falhasConsecutivas: q.state.fetchFailureCount,
                sessaoEncerrada: q.state.error instanceof SemSessaoError
            }),

        // `refetchIntervalInBackground` fica **de fora de propósito**: o padrão
        // é `false`, e o TanStack já gateia o ciclo em `focusManager.isFocused()`,
        // que observa `visibilitychange`. É isso que suspende as consultas com a
        // aba oculta (FR-007) — não adicionar listener próprio de visibilidade.

        // `'always'` e não `true`: o provider global desliga o refetch por foco
        // para listagens operacionais, e `true` só refaria se o dado estivesse
        // stale — quem volta à aba dentro do `staleTime` veria o contador velho,
        // falhando SC-002.
        refetchOnWindowFocus: 'always',

        // Menor que o intervalo, senão o ciclo devolveria o cache sem ir ao
        // servidor.
        staleTime: INTERVALO_MS / 2,

        // Sobrescreve o `retry: 1` global: repetir um 401 é garantidamente
        // inútil, e cada repetição atrasa o desligamento do ciclo.
        retry: (_tentativas, erro) => !(erro instanceof SemSessaoError)
    })

    /**
     * Aplica a leitura no cache antes de o servidor responder, guardando o
     * estado anterior para desfazer em caso de erro.
     *
     * O `cancelQueries` é **requisito, não otimização** (FR-016): sem ele, um
     * ciclo periódico disparado **antes** da marcação retorna **depois** dela e
     * regrava o estado antigo — o item volta a aparecer como não-lido sob o dedo
     * do usuário. Com intervalo de 30s e ações a qualquer instante, essa janela
     * de sobreposição existe permanentemente.
     */
    async function aplicarLeituraOtimista(transformar: (estado: EstadoNotificacoes) => EstadoNotificacoes) {
        await queryClient.cancelQueries({ queryKey: chave })
        const anterior = queryClient.getQueryData<EstadoNotificacoes>(chave)
        if (anterior) queryClient.setQueryData(chave, transformar(anterior))
        return { anterior }
    }

    function restaurar(contexto: { anterior?: EstadoNotificacoes } | undefined) {
        if (contexto?.anterior) queryClient.setQueryData(chave, contexto.anterior)
    }

    // Reconcilia com o banco em qualquer desfecho — o otimismo nunca é a
    // palavra final (FR-017).
    function reconciliar() {
        void queryClient.invalidateQueries({ queryKey: chave })
    }

    const mutacaoUma = useMutation({
        mutationFn: (id: string) => marcarComoLida({ id }),
        onMutate: (id) =>
            aplicarLeituraOtimista((estado) => ({
                notificacoes: estado.notificacoes.map((n) => (n.id === id ? { ...n, lida: true } : n)),
                // `Math.max` protege o caso de o item já estar lido em outra
                // aba: o contador não pode ficar negativo.
                naoLidas: Math.max(0, estado.naoLidas - 1)
            })),
        onError: (_erro, _id, contexto) => restaurar(contexto),
        onSettled: reconciliar
    })

    const mutacaoTodas = useMutation({
        mutationFn: () => marcarTodasComoLidas(),
        onMutate: () =>
            aplicarLeituraOtimista((estado) => ({
                notificacoes: estado.notificacoes.map((n) => ({ ...n, lida: true })),
                naoLidas: 0
            })),
        onError: (_erro, _vars, contexto) => restaurar(contexto),
        onSettled: reconciliar
    })

    return {
        notificacoes: query.data.notificacoes,
        naoLidas: query.data.naoLidas,
        marcarUma: (id: string) => mutacaoUma.mutate(id),
        marcarTodas: () => mutacaoTodas.mutate(),
        // Só a ação do usuário mostra estado de processamento; a atualização de
        // fundo é silenciosa (FR-013).
        processando: mutacaoUma.isPending || mutacaoTodas.isPending
    }
}
