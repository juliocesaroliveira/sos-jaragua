'use server'

import { revalidatePath } from 'next/cache'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { erroAction, serializar, type ResultadoAction } from '@/src/shared/kernel'
import { obterSessao } from '@/src/shared/auth/sessao'
import { contatosWhatsapp } from '@/src/modules/voluntariado/infrastructure/drizzle/contatos-whatsapp'
import { AlterarPreferenciaWhatsappUseCase } from '../../application/use-cases/alterar-preferencia-whatsapp'
import { whatsappRepositorio } from '../../infrastructure/whatsapp-repositorio'

const esquema = z.object({ ativo: z.boolean() })

/**
 * Liga ou desliga o WhatsApp de quem está logado (024, US2). O usuário vem
 * **da sessão**, nunca do corpo do POST — ninguém altera a preferência de outra
 * pessoa por aqui.
 */
export async function alterarPreferenciaWhatsapp(entrada: unknown): Promise<ResultadoAction<{ ativo: boolean }>> {
    const ator = await obterSessao()
    if (!ator) return erroAction('nao_autenticado', 'Entre na sua conta.')

    const parse = esquema.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Escolha inválida.')

    const resultado = await new AlterarPreferenciaWhatsappUseCase(whatsappRepositorio, contatosWhatsapp).executar({
        userId: ator.userId,
        ativo: parse.data.ativo,
        origem: 'perfil'
    })

    if (resultado.ok) revalidatePath('/conta/notificacoes')
    return serializar(resultado)
}
