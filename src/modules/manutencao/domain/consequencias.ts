/**
 * Consequências práticas, em pt-BR, de apagar linhas de cada tabela (FR-010).
 *
 * Fica no domínio (e não na apresentação, como previa o T029) porque a prévia é
 * montada pelo caso de uso e a camada de aplicação não pode importar a de
 * apresentação (Princípio I). É texto puro, sem dependência.
 *
 * A frase descreve o efeito para quem **usa** o sistema, não o efeito no banco:
 * "voluntários perdem o histórico de turnos", não "linhas de alocacao".
 */
const CONSEQUENCIAS: Readonly<Record<string, string>> = {
    user: 'As contas apagadas deixam de existir: as pessoas não conseguem mais entrar e somem das listas de voluntários e de usuários.',
    session: 'As pessoas cujas sessões forem apagadas serão desconectadas e precisarão entrar de novo.',
    account: 'As pessoas perdem o meio de login apagado (senha ou vínculo com Google/Facebook).',
    verification: 'Códigos de verificação e de redefinição de senha em andamento deixam de valer.',
    habilidade: 'As habilidades somem do formulário de candidatura e do filtro de alocação.',
    atividade_categoria: 'As categorias somem do cadastro de atividades.',
    voluntario_perfil: 'Os voluntários perdem o cadastro (dados pessoais, situação da triagem e habilidades).',
    voluntario_habilidade: 'Os voluntários deixam de ter essas habilidades registradas.',
    atividade: 'As atividades somem do quadro, com todos os seus turnos e escalas.',
    turno: 'Os turnos somem da escala, junto com as pessoas alocadas neles.',
    alocacao: 'Voluntários perdem o histórico de turnos e deixam de estar escalados nos turnos futuros.',
    item: 'Os itens somem do estoque e deixam de poder ser escolhidos em entradas, saídas e kits.',
    saldo_estoque: 'O saldo dos itens é recalculado a partir das movimentações que restarem.',
    kit: 'Os kits somem da saída e do painel de capacidade.',
    kit_receita_item: 'As receitas dos kits ficam incompletas e o painel deixa de contá-los como montáveis.',
    entrada: 'As doações recebidas somem do histórico e o saldo dos itens diminui.',
    saida: 'As saídas somem do histórico de distribuição.',
    saida_item: 'As saídas perdem os itens distribuídos e o saldo dos itens aumenta.',
    descarte: 'Os descartes somem do histórico e o saldo dos itens aumenta.',
    crise_variaveis: 'O painel perde o histórico de famílias e pessoas afetadas usado na projeção de demanda.',
    metrica_kit: 'O painel deixa de projetar a demanda desses kits.',
    notificacao: 'As notificações somem do sino e do relatório de notificações.',
    notificacao_envio: 'O relatório de notificações perde a situação de entrega por canal.',
    preferencia_whatsapp: 'As pessoas voltam a não receber avisos pelo WhatsApp até ativarem de novo.',
    consentimento_whatsapp: 'Some o registro de quando cada pessoa autorizou ou revogou o WhatsApp.',
    whatsapp_resposta_automatica: 'Quem mandar mensagem ao número oficial pode receber a resposta automática de novo.'
}

/**
 * Alertas de acesso (FR-006): tabelas cujo reset muda quem consegue entrar.
 *
 * O "até 5 minutos" vem do cookie cache de sessão (`JANELA_COOKIE_CACHE_SEGUNDOS`):
 * a sessão some do banco na hora, mas quem já navega segue autenticado até o
 * cache expirar (research D12).
 */
const ALERTAS_ACESSO: Readonly<Record<string, string>> = {
    user: 'Pessoas serão desconectadas em até 5 minutos e não conseguirão mais entrar. Para atender um pedido de exclusão de dados do titular (LGPD), use a anonimização em "Meus dados", não esta ação.',
    session: 'As pessoas serão desconectadas em até 5 minutos. Sua sessão atual é preservada.',
    account: 'As pessoas perderão o meio de login e não conseguirão mais entrar. Suas contas de login são preservadas.',
    verification: 'Quem estiver no meio de uma verificação ou redefinição de senha precisará recomeçar.'
}

export function consequenciaDe(tabela: string): string | undefined {
    return CONSEQUENCIAS[tabela]
}

export function alertaDeAcesso(tabela: string): string | undefined {
    return ALERTAS_ACESSO[tabela]
}

/** Frase final obrigatória da confirmação (FR-010). */
export const AVISO_IRREVERSIVEL =
    'Esta ação não pode ser desfeita pela aplicação. A recuperação só é possível restaurando o banco a um ponto anterior.'

/** Aviso da trava de escrita durante a execução (research D7, riscos residuais). */
export const AVISO_TRAVA =
    'Durante a execução, gravações nas tabelas atingidas ficam suspensas por alguns segundos — operações de campo nessas áreas vão esperar.'
