import { DomainError, falha, ok, type Result, type UseCase } from '@/src/shared/kernel'
import { destinoWhatsapp, type OrigemConsentimento } from '../../domain/whatsapp'
import type { ContatosWhatsapp } from '../ports/contatos-whatsapp'
import type { PreferenciasWhatsapp } from '../ports/preferencias-whatsapp'

export type EntradaAlterarPreferenciaWhatsapp = {
    userId: string
    ativo: boolean
    origem: OrigemConsentimento
}

/**
 * Liga ou desliga o WhatsApp de um usuário (024, US2/US4).
 *
 * Duas regras moram aqui, e não na tela:
 *
 * 1. **Ativar exige celular.** Sem perfil de voluntário ou com telefone fixo
 *    não há para onde mandar; aceitar o opt-in deixaria a pessoa achando que
 *    vai receber. Desativar continua sempre possível.
 * 2. **Histórico só quando o estado muda** (FR-011). O registro de
 *    consentimento é evidência de LGPD: ativar duas vezes não é duas
 *    concessões.
 */
export class AlterarPreferenciaWhatsappUseCase implements UseCase<
    EntradaAlterarPreferenciaWhatsapp,
    { ativo: boolean },
    DomainError
> {
    constructor(
        private readonly preferencias: PreferenciasWhatsapp,
        private readonly contatos: ContatosWhatsapp
    ) {}

    async executar({
        userId,
        ativo,
        origem
    }: EntradaAlterarPreferenciaWhatsapp): Promise<Result<{ ativo: boolean }, DomainError>> {
        const telefone = (await this.contatos.telefonesDe([userId])).get(userId) ?? null
        const destino = destinoWhatsapp(telefone)

        if (ativo && !destino) {
            return falha(
                new DomainError(
                    'sem_celular',
                    'Para receber avisos pelo WhatsApp, é preciso ter um celular no cadastro de voluntário.'
                )
            )
        }

        const atual = (await this.preferencias.lerPreferencia(userId))?.ativo ?? false
        if (atual !== ativo) {
            await this.preferencias.salvarPreferencia(userId, ativo, origem, destino)
        }

        return ok({ ativo })
    }
}
