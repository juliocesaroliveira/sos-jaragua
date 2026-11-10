import 'server-only'
import { contatosWhatsapp } from '@/src/modules/voluntariado/infrastructure/drizzle/contatos-whatsapp'
import type { ConsentimentoWhatsappPort } from '../application/ports/consentimento-whatsapp'
import { AlterarPreferenciaWhatsappUseCase } from '../application/use-cases/alterar-preferencia-whatsapp'
import { whatsappRepositorio } from './whatsapp-repositorio'

/**
 * Port de consentimento entregue a outros módulos (024, research D11): a
 * candidatura do Voluntariado registra o opt-in marcado no cadastro por aqui,
 * passando pelas mesmas regras da tela de preferências.
 */
export const consentimentoWhatsapp: ConsentimentoWhatsappPort = {
    async registrar(userId, ativo, origem) {
        const resultado = await new AlterarPreferenciaWhatsappUseCase(whatsappRepositorio, contatosWhatsapp).executar({
            userId,
            ativo,
            origem
        })
        if (!resultado.ok) throw resultado.erro
    }
}
