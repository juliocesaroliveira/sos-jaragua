import 'server-only'
import { contatosWhatsapp } from '@/src/modules/voluntariado/infrastructure/drizzle/contatos-whatsapp'
import { AlterarPreferenciaWhatsappUseCase } from '../application/use-cases/alterar-preferencia-whatsapp'
import {
    ProcessarWebhookWhatsappUseCase,
    type EntradaWebhookWhatsapp
} from '../application/use-cases/processar-webhook-whatsapp'
import { variantesDeWaId } from '../domain/whatsapp'
import { whatsappCloudApi } from './whatsapp-cloud-api'
import { whatsappRepositorio } from './whatsapp-repositorio'

/**
 * Montagem do processamento do webhook do WhatsApp (024) com os adapters reais.
 * A rota (`app/api/webhooks/whatsapp/route.ts`) só autentica e delega para cá.
 */
export async function processarWebhookWhatsapp(entrada: EntradaWebhookWhatsapp): Promise<void> {
    const preferencias = new AlterarPreferenciaWhatsappUseCase(whatsappRepositorio, contatosWhatsapp)

    await new ProcessarWebhookWhatsappUseCase({
        situacoes: whatsappRepositorio,
        usuariosPorWaId: (waId) => contatosWhatsapp.usuariosPorTelefone(variantesDeWaId(waId)),
        async revogar(userId) {
            const resultado = await preferencias.executar({ userId, ativo: false, origem: 'resposta_whatsapp' })
            if (!resultado.ok) throw resultado.erro
        },
        async enviarTexto(waId, texto) {
            const resultado = await whatsappCloudApi.enviarTexto(waId, texto)
            // Uma resposta que não saiu não justifica fazer a Meta reenviar o
            // webhook inteiro — só registra.
            if (!resultado.ok) {
                console.error('[notificacoes] whatsapp: resposta não enviada', {
                    codigo: resultado.codigo,
                    erro: resultado.erro
                })
            }
        },
        podeResponderAutomaticamente: (waId) => whatsappRepositorio.podeResponderAutomaticamente(waId),
        urlBase: (process.env.BETTER_AUTH_URL ?? '').replace(/\/$/, '')
    }).executar(entrada)
}
