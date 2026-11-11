'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Tabs } from '@/src/shared/ui/tabs/tabs'
import type { PedidoAcao } from '@/src/modules/manutencao/domain/previa'
import { Inventario } from './inventario'
import { FluxoConfirmacao } from './fluxo-confirmacao'
import { RegistrosDrawer } from './registros-drawer'
import { Historico } from './historico'

type Aba = 'tabelas' | 'historico'

/**
 * Abas da Danger Zone (U-02) e o estado compartilhado entre elas: qual ação
 * está em confirmação e qual tabela está aberta no drawer de registros.
 *
 * A aba vive em `?aba=` (`router.replace`, sem empilhar histórico) para que um
 * link para o histórico abra direto nele.
 */
export function PainelDangerZone({ abaInicial }: { abaInicial: Aba }) {
    const router = useRouter()
    const pathname = usePathname()
    const [aba, setAba] = useState<Aba>(abaInicial)
    const [pedido, setPedido] = useState<{ pedido: PedidoAcao; rotulo: string } | null>(null)
    const [registros, setRegistros] = useState<{ tabela: string; rotulo: string } | null>(null)

    function trocarAba(valor: string) {
        const proxima: Aba = valor === 'historico' ? 'historico' : 'tabelas'
        setAba(proxima)
        router.replace(proxima === 'tabelas' ? pathname : `${pathname}?aba=${proxima}`, { scroll: false })
    }

    return (
        <>
            <Tabs
                aria-label="Seções da Danger Zone"
                value={aba}
                onValueChange={trocarAba}
                abas={[
                    {
                        value: 'tabelas',
                        label: 'Tabelas',
                        conteudo: (
                            <Inventario
                                onResetar={(tabela, rotulo) =>
                                    setPedido({ pedido: { acao: 'resetar_tabela', tabela }, rotulo })
                                }
                                onVerRegistros={(tabela, rotulo) => setRegistros({ tabela, rotulo })}
                            />
                        )
                    },
                    { value: 'historico', label: 'Histórico', conteudo: <Historico /> }
                ]}
            />

            {registros && (
                <RegistrosDrawer
                    tabela={registros.tabela}
                    rotulo={registros.rotulo}
                    onFechar={() => setRegistros(null)}
                    onExcluir={(chaves) =>
                        setPedido({
                            pedido: { acao: 'excluir_selecionados', tabela: registros.tabela, chaves },
                            rotulo: registros.rotulo
                        })
                    }
                />
            )}

            {pedido && (
                <FluxoConfirmacao
                    key={`${pedido.pedido.acao}:${pedido.pedido.tabela}:${pedido.pedido.chaves?.join(',') ?? ''}`}
                    pedidoInicial={pedido.pedido}
                    rotuloTabela={pedido.rotulo}
                    onFechar={() => setPedido(null)}
                    onConcluido={() => setRegistros(null)}
                />
            )}
        </>
    )
}
