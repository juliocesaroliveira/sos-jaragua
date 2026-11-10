import 'server-only'
import { contatosWhatsapp } from '@/src/modules/voluntariado/infrastructure/drizzle/contatos-whatsapp'
import { destinoWhatsapp, mascararTelefone } from '../../domain/whatsapp'
import { whatsappRepositorio } from '../../infrastructure/whatsapp-repositorio'

export type EstadoPreferenciaWhatsapp = {
    /** Tem perfil de voluntário — sem ele não há telefone no sistema. */
    temPerfil: boolean
    /** O telefone cadastrado é celular (só celular recebe WhatsApp). */
    celular: boolean
    telefoneMascarado: string | null
    ativo: boolean
    ativoDesde: Date | null
}

/**
 * Estado da tela Minha conta → Notificações (024, contracts/canal-e-interfaces.md §3).
 * O telefone vem pelo port do Voluntariado — esta consulta não lê
 * `voluntario_perfil` (Princípio I). Dado de sessão: nunca cacheado.
 */
export async function estadoPreferenciaWhatsapp(userId: string): Promise<EstadoPreferenciaWhatsapp> {
    const [telefones, preferencia] = await Promise.all([
        contatosWhatsapp.telefonesDe([userId]),
        whatsappRepositorio.lerPreferencia(userId)
    ])
    const telefone = telefones.get(userId) ?? null

    return {
        temPerfil: telefone !== null,
        celular: destinoWhatsapp(telefone) !== null,
        telefoneMascarado: telefone ? mascararTelefone(telefone) : null,
        ativo: preferencia?.ativo ?? false,
        ativoDesde: preferencia?.ativoDesde ?? null
    }
}
