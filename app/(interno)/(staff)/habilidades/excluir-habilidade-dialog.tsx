'use client'

import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { Alert, Button, Dialog, avisar } from '@/src/shared/ui'
import { excluirHabilidade } from '@/src/modules/voluntariado/presentation/actions/habilidades'
import type { LinhaHabilidade } from '@/src/modules/voluntariado/presentation/queries/habilidades'

/**
 * Confirmação de exclusão de habilidade (017-gestao-habilidades, US4).
 *
 * Local à feature, montado sobre o `Dialog` compartilhado: é o primeiro caso
 * concreto de confirmação destrutiva no projeto, e generalizar a partir de uma
 * amostra só costuma fixar a abstração errada. Quando aparecer o segundo, a
 * extração para `src/shared/ui/` fica trivial e informada (research.md D7).
 *
 * Quando a habilidade tem vínculos, o diálogo abre **impeditivo**: explica o
 * motivo e desabilita a confirmação. Isso é antecipação da recusa do servidor
 * (X-01.2), não substituição dela — a garantia real é a FK `RESTRICT`.
 */
export interface ExcluirHabilidadeDialogProps {
    open: boolean
    onOpenChange: (aberto: boolean) => void
    onSucesso?: () => void
    habilidade?: LinhaHabilidade
}

export function ExcluirHabilidadeDialog({
    open,
    onOpenChange,
    onSucesso,
    habilidade
}: ExcluirHabilidadeDialogProps) {
    const [excluindo, setExcluindo] = useState(false)

    const vinculados = habilidade?.voluntariosVinculados ?? 0
    const bloqueada = vinculados > 0

    async function confirmar() {
        if (!habilidade) return

        setExcluindo(true)
        const resultado = await excluirHabilidade({ id: habilidade.id })
        setExcluindo(false)

        if (!resultado.ok) {
            avisar.erro('Não foi possível excluir', resultado.erro.mensagem)
            // Tanto o vínculo nascido na corrida quanto o registro já removido
            // significam que a listagem em tela está desatualizada — fechar e
            // recarregar é o que corrige a contagem exibida (D-02.6).
            onOpenChange(false)
            onSucesso?.()
            return
        }

        avisar.sucesso('Habilidade excluída', `"${habilidade.nome}" foi removida.`)
        onOpenChange(false)
        onSucesso?.()
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
            titulo="Excluir habilidade"
            tamanho="sm"
            acoes={
                <>
                    <Button
                        type="button"
                        variant="secondary"
                        iconeInicio={<X className="size-4" />}
                        onClick={() => onOpenChange(false)}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        variant="danger"
                        iconeInicio={<Trash2 className="size-4" />}
                        disabled={bloqueada}
                        loading={excluindo}
                        onClick={() => void confirmar()}
                    >
                        Excluir
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-3">
                <p className="text-base text-foreground">
                    Excluir a habilidade <strong>&ldquo;{habilidade?.nome}&rdquo;</strong>? Esta ação não pode ser
                    desfeita.
                </p>

                {bloqueada && (
                    <Alert tom="warning" titulo="Esta habilidade está em uso">
                        <p>
                            {vinculados === 1
                                ? '1 voluntário declara esta habilidade.'
                                : `${vinculados} voluntários declaram esta habilidade.`}{' '}
                            Renomeie-a ou remova os vínculos antes de excluir — nenhuma declaração de voluntário é
                            apagada por esta tela.
                        </p>
                    </Alert>
                )}
            </div>
        </Dialog>
    )
}
