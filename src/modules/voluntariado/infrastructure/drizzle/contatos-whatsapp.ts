import 'server-only'
import { inArray } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { voluntarioPerfil } from '@/db/schema/voluntariado'
import type { ContatosWhatsapp } from '@/src/modules/notificacoes/application/ports/contatos-whatsapp'

/**
 * Implementação do port de telefones do WhatsApp (024, research D10).
 *
 * Fica no Voluntariado porque `voluntario_perfil` é dele: Notificações declara
 * o que precisa e não lê a tabela diretamente (Princípio I). O telefone é
 * gravado já normalizado em dígitos (`normalizarTelefone` na candidatura).
 */
export const contatosWhatsapp: ContatosWhatsapp = {
    async telefonesDe(userIds) {
        if (userIds.length === 0) return new Map()

        const linhas = await db
            .select({ userId: voluntarioPerfil.userId, telefone: voluntarioPerfil.telefone })
            .from(voluntarioPerfil)
            .where(inArray(voluntarioPerfil.userId, [...new Set(userIds)]))

        return new Map(linhas.map((l) => [l.userId, l.telefone]))
    },

    async usuariosPorTelefone(digitosLocais) {
        if (digitosLocais.length === 0) return []

        const linhas = await db
            .select({ userId: voluntarioPerfil.userId })
            .from(voluntarioPerfil)
            .where(inArray(voluntarioPerfil.telefone, [...new Set(digitosLocais)]))

        return linhas.map((l) => l.userId)
    }
}
