/**
 * Regras puras do canal WhatsApp (specs/024-notificacoes-whatsapp,
 * data-model.md §6). Sem Next, Drizzle nem rede: tudo o que decide **se**,
 * **para onde** e **com que texto** uma mensagem sai mora aqui, testável em
 * milissegundos (Princípio III).
 */

/**
 * Eventos que também vão pelo WhatsApp (decisão de 2026-10-14): os quatro do
 * e-mail mais o lembrete de turno, que o BRD §6 previa como "push". Os alertas
 * da gestão ficam só na plataforma.
 */
export const EVENTOS_COM_WHATSAPP = [
    'triagem_concluida',
    'atividade_atribuida',
    'alteracao_atividade',
    'broadcast_urgencia',
    'lembrete_turno'
] as const

export type EventoComWhatsapp = (typeof EVENTOS_COM_WHATSAPP)[number]

const CONJUNTO_EVENTOS: ReadonlySet<string> = new Set(EVENTOS_COM_WHATSAPP)

export function eventoVaiPorWhatsapp(evento: string): evento is EventoComWhatsapp {
    return CONJUNTO_EVENTOS.has(evento)
}

/**
 * Um modelo Utility aprovado pela Meta por evento (contracts/modelos-whatsapp.md).
 * O nome é a chave do modelo no WhatsApp Manager — mudar aqui exige mudar lá.
 */
export const MODELO_POR_EVENTO = {
    triagem_concluida: 'sos_triagem_concluida',
    atividade_atribuida: 'sos_atividade_atribuida',
    alteracao_atividade: 'sos_alteracao_atividade',
    lembrete_turno: 'sos_lembrete_turno',
    broadcast_urgencia: 'sos_convocacao_urgente'
} as const satisfies Record<EventoComWhatsapp, string>

export type NomeModelo = (typeof MODELO_POR_EVENTO)[EventoComWhatsapp]

export type SituacaoEnvio = 'pendente' | 'enviado' | 'entregue' | 'lido' | 'falhou' | 'nao_enviado'

export type MotivoNaoEntrega =
    | 'canal_desativado'
    | 'sem_celular'
    | 'usuario_inativo'
    | 'nao_configurado'
    | 'numero_sem_whatsapp'
    | 'limite_envio'
    | 'modelo_indisponivel'
    | 'falha'

export type OrigemConsentimento = 'cadastro' | 'perfil' | 'resposta_whatsapp'

// --- Destino ----------------------------------------------------------------

function digitos(valor: string | null | undefined): string {
    return (valor ?? '').replace(/\D/g, '')
}

/**
 * Número local de celular (DDD + 9 + 8 dígitos) → E.164 sem `+`. Fixo (10
 * dígitos) ou qualquer outra forma devolve `null`: o WhatsApp exige celular.
 */
export function destinoWhatsapp(telefone: string | null | undefined): string | null {
    const d = digitos(telefone)
    if (d.length !== 11 || d[2] !== '9') return null
    const ddd = Number(d.slice(0, 2))
    if (ddd < 11 || ddd > 99) return null
    return `55${d}`
}

/**
 * Formas locais (sem o 55) com que um `wa_id` recebido pode estar cadastrado.
 *
 * A Meta identifica contas brasileiras antigas **sem** o 9º dígito
 * (`554799998888`), enquanto o cadastro guarda o número com ele. Sem casar as
 * duas formas, o "SAIR" dessas pessoas não seria reconhecido (research D8).
 */
export function variantesDeWaId(waId: string): string[] {
    const d = digitos(waId)
    if (!d.startsWith('55')) return []
    const local = d.slice(2)
    const ddd = local.slice(0, 2)

    if (local.length === 11 && local[2] === '9') return [local, ddd + local.slice(3)]
    if (local.length === 10) return [local, `${ddd}9${local.slice(2)}`]
    return []
}

// --- Elegibilidade ----------------------------------------------------------

export type Elegibilidade = { elegivel: true; destino: string } | { elegivel: false; motivo: MotivoNaoEntrega }

/**
 * Quem recebe pelo WhatsApp (FR-003): usuário ativo, com opt-in explícito e
 * celular. A ordem decide o motivo registrado quando mais de uma condição falha
 * — o opt-in vem antes do celular porque, sem consentimento, o telefone nem
 * deveria ser considerado.
 */
export function avaliarElegibilidade(entrada: {
    ativo: boolean | undefined
    optIn: boolean | undefined
    telefone: string | null | undefined
}): Elegibilidade {
    if (!entrada.ativo) return { elegivel: false, motivo: 'usuario_inativo' }
    if (!entrada.optIn) return { elegivel: false, motivo: 'canal_desativado' }
    const destino = destinoWhatsapp(entrada.telefone)
    if (!destino) return { elegivel: false, motivo: 'sem_celular' }
    return { elegivel: true, destino }
}

// --- Parâmetros do modelo ---------------------------------------------------

/**
 * Tamanho máximo da mensagem no WhatsApp. O corpo do modelo aceita 1.024
 * caracteres no total; sobra folga para o texto fixo e um título de até 120.
 */
export const LIMITE_MENSAGEM_WHATSAPP = 700

const TAMANHO_ENCURTADO = 680
const SUFIXO_ENCURTADO = '… (continua no SOS Jaraguá)'

/**
 * A Meta recusa variável com quebra de linha, tabulação ou mais de 4 espaços
 * seguidos, e recusa variável vazia.
 */
function normalizarVariavel(texto: string): string {
    const limpo = texto
        .replace(/\s*(?:\r?\n)+\s*/g, ' — ')
        .replace(/\t/g, ' ')
        .replace(/ {2,}/g, ' ')
        .replace(/^ — | — $/g, '')
        .trim()
    return limpo === '' || limpo === '—' ? '-' : limpo
}

/**
 * Título e mensagem da notificação prontos para as variáveis `{{1}}` e `{{2}}`.
 * Acima do limite, a mensagem é encurtada **com aviso**: o coordenador é avisado
 * antes de enviar e o botão do modelo leva ao texto completo (research D7).
 */
export function parametrosDoModelo(
    titulo: string,
    mensagem: string
): { titulo: string; mensagem: string; encurtada: boolean } {
    const corpo = normalizarVariavel(mensagem)
    const encurtada = corpo.length > LIMITE_MENSAGEM_WHATSAPP
    return {
        titulo: normalizarVariavel(titulo),
        mensagem: encurtada ? corpo.slice(0, TAMANHO_ENCURTADO).trimEnd() + SUFIXO_ENCURTADO : corpo,
        encurtada
    }
}

// --- Situação do envio ------------------------------------------------------

const ORDEM: Partial<Record<SituacaoEnvio, number>> = { pendente: 0, enviado: 1, entregue: 2, lido: 3 }

/**
 * Transição monotônica (FR-022, research D14). A Meta não garante a ordem dos
 * webhooks: um "entregue" pode chegar depois do "lido", e o mesmo evento pode
 * chegar duas vezes. Devolve a nova situação, ou `null` quando nada muda.
 */
export function proximaSituacao(atual: SituacaoEnvio, recebida: SituacaoEnvio): SituacaoEnvio | null {
    if (atual === 'falhou' || atual === 'nao_enviado') return null
    if (recebida === 'falhou') return atual === 'pendente' || atual === 'enviado' ? 'falhou' : null

    const de = ORDEM[atual]
    const para = ORDEM[recebida]
    if (de === undefined || para === undefined) return null
    return para > de ? recebida : null
}

const SITUACAO_DO_WEBHOOK: Record<string, SituacaoEnvio> = {
    sent: 'enviado',
    delivered: 'entregue',
    read: 'lido',
    failed: 'falhou'
}

/** `statuses[].status` do webhook da Meta → situação do envio. Valores desconhecidos são ignorados. */
export function situacaoDoWebhook(status: string): SituacaoEnvio | null {
    return SITUACAO_DO_WEBHOOK[status] ?? null
}

// --- Erros da Meta ----------------------------------------------------------

const LIMITE = new Set([130429, 131048, 131056])
const MODELO = new Set([132000, 132001, 132005, 132007, 132012, 132015, 132016, 132068])
const CONFIGURACAO = new Set([190, 10, 200])

/**
 * Código de erro da Cloud API → motivo legível no relatório (research D17). O
 * código e o texto originais continuam guardados em `erro`.
 */
export function classificarErroMeta(codigo: number | null | undefined): MotivoNaoEntrega {
    if (codigo == null) return 'falha'
    if (codigo === 131026) return 'numero_sem_whatsapp'
    if (LIMITE.has(codigo)) return 'limite_envio'
    if (MODELO.has(codigo)) return 'modelo_indisponivel'
    if (CONFIGURACAO.has(codigo)) return 'nao_configurado'
    return 'falha'
}

// --- Mensagens recebidas ----------------------------------------------------

const PALAVRAS_DESCADASTRO = new Set(['sair', 'parar', 'stop', 'cancelar', 'descadastrar'])

/**
 * A mensagem inteira precisa ser a palavra (FR-014): "quero sair do grupo" não
 * descadastra — o risco de revogar sem querer pesa mais que o de exigir a
 * palavra sozinha, que é o que o rodapé de cada mensagem pede.
 */
export function ehPedidoDeDescadastro(texto: string): boolean {
    const normalizado = texto
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '')
    return PALAVRAS_DESCADASTRO.has(normalizado)
}

export function textoConfirmacaoDescadastro(urlBase: string): string {
    return (
        'Pronto, você não vai mais receber avisos do SOS Jaraguá pelo WhatsApp. ' +
        `Para voltar a receber, ative em Minha conta → Notificações: ${urlBase}/conta/notificacoes`
    )
}

export const TEXTO_RESPOSTA_AUTOMATICA =
    'Este número do SOS Jaraguá só envia avisos e não é lido por ninguém. ' +
    'Para falar com a Defesa Civil, use os canais oficiais. Para parar de receber, responda SAIR.'

// --- Exibição ---------------------------------------------------------------

/** `(47) 9****-8888` — o relatório mostra o destino sem expô-lo inteiro (FR-025). */
export function mascararTelefone(telefone: string | null | undefined): string {
    let d = digitos(telefone)
    if (d.length === 13 && d.startsWith('55')) d = d.slice(2)
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]}****-${d.slice(-4)}`
    if (d.length === 10) return `(${d.slice(0, 2)}) ****-${d.slice(-4)}`
    return '—'
}
