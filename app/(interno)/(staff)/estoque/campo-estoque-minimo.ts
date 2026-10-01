import { z } from '@/src/shared/validacao/zod-ptbr'
import { validarEstoqueMinimo } from '@/src/modules/estoque/domain/estoque-minimo'
import { formatarQuantidade } from '@/src/modules/estoque/domain/quantidade'

/**
 * Campo "Estoque mínimo" compartilhado pela edição na tabela de estoque e pelo
 * cadastro de item novo na Entrada (specs/020-resolver-pendencias, I1).
 *
 * A regra vem de `validarEstoqueMinimo`, a mesma do servidor: importada, não
 * reescrita, para a mensagem do cliente aparecer exatamente no caso em que o
 * servidor recusaria. O servidor revalida de qualquer forma.
 */

/** O `NumberInput` trabalha com texto. Vazio = herdar o padrão global. */
export function paraEstoqueMinimo(valor: string | undefined): number | null {
    const texto = (valor ?? '').trim()
    return texto === '' ? null : Number(texto.replace(',', '.'))
}

export function campoEstoqueMinimo() {
    return z
        .string()
        .optional()
        .superRefine((valor, ctx) => {
            const erro = validarEstoqueMinimo(paraEstoqueMinimo(valor))
            if (erro) ctx.addIssue({ code: 'custom', message: erro })
        })
}

/** Texto de apoio, igual nos dois formulários. */
export function apoioEstoqueMinimo(limiarGlobal: number, abreviacaoUnidade: string): string {
    return `Deixe em branco para usar o padrão (${formatarQuantidade(limiarGlobal)} ${abreviacaoUnidade}). Use 0 para não receber alerta deste item.`
}
