'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useId, useRef, useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Alert, Button, IconButton, Input, NumberInput, RadioGroup, Select, avisar } from '@/src/shared/ui'
import { ABREVIACAO_UNIDADE, type TipoSaida } from '@/src/modules/estoque/domain/item'
import { formatarQuantidade } from '@/src/modules/estoque/domain/quantidade'
import type { ItemComSaldo, KitComReceita } from '@/src/modules/estoque/presentation/queries/estoque'
import { registrarSaida } from '@/src/modules/estoque/presentation/actions/estoque'

/**
 * Registro de Saída (BR-EST-04, EST-09).
 *
 * Envia **um único** payload em lote para a Server Action: a validação de saldo
 * e a dedução acontecem numa transação só, e uma saída fatiada em várias
 * chamadas perderia a atomicidade (DESIGN.md §8, §9.3).
 */
type Linha = { id: string; refId: string[]; quantidade: string }

export function SaidaForm({ itens, kits }: { itens: ItemComSaldo[]; kits: KitComReceita[] }) {
    const router = useRouter()
    const [enviando, iniciarTransicao] = useTransition()

    /**
     * Os ids das linhas precisam ser estáveis entre servidor e cliente e
     * **por instância**: um contador de módulo persistiria entre requisições no
     * servidor, o SSR emitiria `l2` enquanto a hidratação emitiria `l0`, e o
     * `htmlFor` de cada label apontaria para um campo inexistente.
     */
    const idBase = useId()
    const sequencia = useRef(0)
    const novaLinha = useCallback(
        (): Linha => ({ id: `${idBase}${sequencia.current++}`, refId: [], quantidade: '' }),
        [idBase]
    )

    const [tipo, setTipo] = useState<TipoSaida>('avulso')
    const [destino, setDestino] = useState('')
    const [responsavel, setResponsavel] = useState('')
    const [linhas, setLinhas] = useState<Linha[]>(() => [novaLinha()])
    const [erroDeficit, setErroDeficit] = useState<string | null>(null)
    const [erros, setErros] = useState<Record<string, string>>({})

    function trocarTipo(novoTipo: string) {
        setTipo(novoTipo as TipoSaida)
        // As linhas referenciam entidades diferentes (item × kit) — recomeçar
        // evita enviar um id de kit no lugar de um id de item.
        setLinhas([novaLinha()])
        setErroDeficit(null)
    }

    function atualizar(id: string, mudanca: Partial<Linha>) {
        setLinhas((atuais) => atuais.map((l) => (l.id === id ? { ...l, ...mudanca } : l)))
    }

    function salvar() {
        setErroDeficit(null)
        setErros({})

        const preenchidas = linhas.filter((l) => l.refId[0] && Number(l.quantidade) > 0)
        if (preenchidas.length === 0) {
            setErros({ itens: 'Adicione ao menos um item com quantidade.' })
            return
        }

        iniciarTransicao(async () => {
            const resultado = await registrarSaida({
                tipo,
                destino,
                responsavelTransporte: responsavel,
                avulsos:
                    tipo === 'avulso'
                        ? preenchidas.map((l) => ({ itemId: l.refId[0], quantidade: Number(l.quantidade) }))
                        : undefined,
                kits:
                    tipo === 'kit'
                        ? preenchidas.map((l) => ({ kitId: l.refId[0], quantidade: Number(l.quantidade) }))
                        : undefined
            })

            if (!resultado.ok) {
                // O déficit ganha um alerta persistente, não só um toast: o
                // operador precisa do texto à vista para saber o que buscar.
                if (resultado.erro.codigo === 'saida_bloqueada') {
                    setErroDeficit(resultado.erro.mensagem)
                } else {
                    setErros((resultado.erro.detalhes?.campos as Record<string, string>) ?? {})
                }
                avisar.erro('Saída não registrada', resultado.erro.mensagem)
                return
            }

            avisar.sucesso('Saída registrada', 'O saldo foi deduzido do estoque.')
            setDestino('')
            setResponsavel('')
            setLinhas([novaLinha()])
            router.refresh()
        })
    }

    const opcoes =
        tipo === 'avulso'
            ? itens.map((i) => ({
                  value: i.id,
                  label: `${i.nome} — ${formatarQuantidade(i.saldo)} ${ABREVIACAO_UNIDADE[i.unidadeMedida]} em estoque`,
                  disabled: i.saldo <= 0
              }))
            : kits.map((k) => ({
                  value: k.id,
                  label: k.componentes.length > 0 ? k.nome : `${k.nome} (sem receita)`,
                  disabled: k.componentes.length === 0
              }))

    return (
        <div className="flex max-w-3xl flex-col gap-6">
            {erroDeficit && (
                <Alert tom="danger" titulo="Saída bloqueada">
                    {erroDeficit}
                </Alert>
            )}

            <RadioGroup
                id="tipo"
                label="Tipo de saída"
                orientacao="horizontal"
                opcoes={[
                    { value: 'avulso', label: 'Itens avulsos' },
                    { value: 'kit', label: 'Kits' }
                ]}
                value={tipo}
                onValueChange={trocarTipo}
            />

            <div className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold text-foreground">{tipo === 'avulso' ? 'Itens' : 'Kits'}</h2>

                {erros.itens && <Alert tom="danger" titulo={erros.itens} />}

                {linhas.map((linha) => (
                    <div key={linha.id} className="flex items-end gap-2">
                        <div className="min-w-0 flex-1">
                            <Select
                                id={`ref-${linha.id}`}
                                label={tipo === 'avulso' ? 'Item' : 'Kit'}
                                opcoes={opcoes}
                                value={linha.refId}
                                onValueChange={(v) => atualizar(linha.id, { refId: v })}
                            />
                        </div>
                        <div className="w-32 shrink-0">
                            <NumberInput
                                id={`qtd-${linha.id}`}
                                label="Quantidade"
                                min={0}
                                value={linha.quantidade}
                                onValueChange={(v) => atualizar(linha.id, { quantidade: v })}
                            />
                        </div>
                        <IconButton
                            aria-label="Remover linha"
                            icone={<Trash2 aria-hidden className="size-5" />}
                            variant="ghost"
                            disabled={linhas.length === 1}
                            onClick={() => setLinhas((atuais) => atuais.filter((l) => l.id !== linha.id))}
                        />
                    </div>
                ))}

                <div>
                    <Button
                        variant="secondary"
                        iconeInicio={<Plus aria-hidden className="size-5" />}
                        onClick={() => setLinhas((atuais) => [...atuais, novaLinha()])}
                    >
                        Adicionar {tipo === 'avulso' ? 'item' : 'kit'}
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Input
                    id="destino"
                    label="Destino"
                    obrigatorio
                    apoio="Bairro, abrigo ou família."
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                    erro={erros.destino}
                />
                <Input
                    id="responsavel"
                    label="Responsável pelo transporte"
                    obrigatorio
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                    erro={erros.responsavelTransporte}
                />
            </div>

            <div className="flex justify-end">
                <Button size="lg" loading={enviando} onClick={salvar}>
                    Registrar saída
                </Button>
            </div>
        </div>
    )
}
