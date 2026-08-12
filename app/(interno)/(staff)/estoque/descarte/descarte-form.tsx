'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Alert, Button, NumberInput, Select, Textarea, avisar } from '@/src/shared/ui'
import { ABREVIACAO_UNIDADE } from '@/src/modules/estoque/domain/item'
import { formatarQuantidade } from '@/src/modules/estoque/domain/quantidade'
import { camposComErro } from '@/src/shared/kernel'
import type { ItemComSaldo } from '@/src/modules/estoque/presentation/queries/estoque'
import { registrarDescarte } from '@/src/modules/estoque/presentation/actions/estoque'

/**
 * Baixa por descarte (BR-EST-05, EST-11).
 *
 * Deduz o saldo como uma saída, mas grava em tabela dedicada — o que garante,
 * por estrutura, que o descarte nunca apareça nos relatórios de "itens
 * entregues à população" (DESIGN.md §9.4).
 */
export function DescarteForm({ itens }: { itens: ItemComSaldo[] }) {
    const router = useRouter()
    const [enviando, iniciarTransicao] = useTransition()

    const [itemId, setItemId] = useState<string[]>([])
    const [quantidade, setQuantidade] = useState('')
    const [motivo, setMotivo] = useState('')
    const [erros, setErros] = useState<Record<string, string>>({})
    const [erroGeral, setErroGeral] = useState<string | null>(null)

    const selecionado = itens.find((i) => i.id === itemId[0])

    function salvar() {
        setErros({})
        setErroGeral(null)

        iniciarTransicao(async () => {
            const resultado = await registrarDescarte({
                itemId: itemId[0],
                quantidade: Number(quantidade),
                motivo: motivo.trim() || null
            })

            if (!resultado.ok) {
                setErros(camposComErro(resultado.erro))
                setErroGeral(resultado.erro.mensagem)
                avisar.erro('Descarte não registrado', resultado.erro.mensagem)
                return
            }

            avisar.sucesso('Descarte registrado', 'O saldo foi deduzido do estoque.')
            setItemId([])
            setQuantidade('')
            setMotivo('')
            router.refresh()
        })
    }

    return (
        <div className="flex max-w-2xl flex-col gap-6">
            <Alert tom="warning" titulo="Esta baixa não conta como entrega">
                Itens descartados saem do saldo, mas ficam fora dos relatórios de itens entregues à população.
            </Alert>

            {erroGeral && <Alert tom="danger" titulo={erroGeral} />}

            <Select
                id="itemId"
                label="Item"
                obrigatorio
                opcoes={itens.map((i) => ({
                    value: i.id,
                    label: `${i.nome} — ${formatarQuantidade(i.saldo)} ${ABREVIACAO_UNIDADE[i.unidadeMedida]} em estoque`,
                    disabled: i.saldo <= 0
                }))}
                value={itemId}
                onValueChange={setItemId}
                erro={erros.itemId}
            />

            <NumberInput
                id="quantidade"
                label="Quantidade a descartar"
                obrigatorio
                min={0}
                max={selecionado?.saldo}
                value={quantidade}
                onValueChange={setQuantidade}
                apoio={
                    selecionado
                        ? `Saldo disponível: ${formatarQuantidade(selecionado.saldo)} ${ABREVIACAO_UNIDADE[selecionado.unidadeMedida]}.`
                        : undefined
                }
                erro={erros.quantidade}
            />

            <Textarea
                id="motivo"
                label="Motivo"
                apoio="Ex.: vencido, avariado, embalagem inutilizada. Opcional, mas recomendado."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
            />

            <div className="flex justify-end">
                <Button variant="danger" size="lg" loading={enviando} onClick={salvar}>
                    Registrar descarte
                </Button>
            </div>
        </div>
    )
}
