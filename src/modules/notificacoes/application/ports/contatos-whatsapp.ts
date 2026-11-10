/**
 * Telefone de contato para o WhatsApp (024, research D10).
 *
 * O telefone mora em `voluntario_perfil`, que é do módulo Voluntariado. Pelo
 * Princípio I, Notificações não lê essa tabela: declara este port e o
 * Voluntariado o implementa (`voluntariado/infrastructure/drizzle/contatos-whatsapp.ts`).
 */
export interface ContatosWhatsapp {
    /** userId → telefone em dígitos locais, como cadastrado. Quem não tem perfil fica de fora. */
    telefonesDe(userIds: string[]): Promise<Map<string, string>>
    /** userIds cujo telefone cadastrado é uma das formas locais informadas. */
    usuariosPorTelefone(digitosLocais: string[]): Promise<string[]>
}
