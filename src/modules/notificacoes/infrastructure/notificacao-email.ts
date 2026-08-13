import 'server-only'
import { Resend } from 'resend'
import type { EventoNotificacao } from '../application/ports/notificacao-service'

/**
 * Adapter de e-mail transacional via Resend (DESIGN.md §12).
 *
 * O e-mail é o canal **acessório**: a cópia durável da mensagem é a linha em
 * `notificacao` (canal `plataforma`). Por isso toda falha aqui degrada
 * graciosamente — a operação de negócio que disparou a notificação nunca é
 * desfeita porque um e-mail não saiu.
 */
export type DestinatarioEmail = {
    email: string
    nome?: string | null
}

export type EmailParaEnviar = {
    destinatario: DestinatarioEmail
    assunto: string
    titulo: string
    mensagem: string
    evento: EventoNotificacao
}

export type ResultadoEnvioEmail =
    { enviado: true } | { enviado: false; motivo: 'nao_configurado' | 'falha'; erro?: string }

/**
 * Nem todo evento vai por e-mail. A matriz do BRD §6 reserva o e-mail para o
 * que o voluntário precisa saber fora da plataforma; os três alertas de
 * coordenador são "Plataforma (Alerta)" e o lembrete de turno é
 * "Plataforma (Push)" — mandá-los por e-mail geraria ruído a cada leitura de
 * dashboard.
 */
const EVENTOS_COM_EMAIL: ReadonlySet<EventoNotificacao> = new Set([
    'triagem_concluida',
    'atividade_atribuida',
    'alteracao_atividade',
    'broadcast_urgencia'
])

export function eventoVaiPorEmail(evento: EventoNotificacao): boolean {
    return EVENTOS_COM_EMAIL.has(evento)
}

let clienteResend: Resend | null = null

function obterCliente(): Resend | null {
    const chave = process.env.RESEND_API_KEY
    if (!chave) return null
    clienteResend ??= new Resend(chave)
    return clienteResend
}

function remetente(): string {
    return process.env.RESEND_FROM || 'SOS Jaraguá <onboarding@resend.dev>'
}

/**
 * Envia um lote de e-mails.
 *
 * Sem `RESEND_API_KEY` (o caso do ambiente de desenvolvimento hoje), registra e
 * segue: a plataforma continua funcionando com o canal in-app apenas.
 */
export async function enviarEmails(emails: EmailParaEnviar[]): Promise<Map<string, ResultadoEnvioEmail>> {
    const resultados = new Map<string, ResultadoEnvioEmail>()
    if (emails.length === 0) return resultados

    const cliente = obterCliente()
    if (!cliente) {
        console.warn('[notificacoes] RESEND_API_KEY ausente — %d e-mail(s) não enviado(s)', emails.length)
        for (const email of emails) {
            resultados.set(email.destinatario.email, { enviado: false, motivo: 'nao_configurado' })
        }
        return resultados
    }

    // A API de lote do Resend aceita até 100 mensagens por chamada.
    for (let i = 0; i < emails.length; i += 100) {
        const chunk = emails.slice(i, i + 100)
        try {
            const { error } = await cliente.batch.send(
                chunk.map((email) => ({
                    from: remetente(),
                    to: [email.destinatario.email],
                    subject: email.assunto,
                    html: montarHtml(email),
                    text: `${email.titulo}\n\n${email.mensagem}`
                }))
            )

            const resultado: ResultadoEnvioEmail = error
                ? { enviado: false, motivo: 'falha', erro: error.message }
                : { enviado: true }

            for (const email of chunk) resultados.set(email.destinatario.email, resultado)

            if (error) {
                console.error('[notificacoes] Resend recusou o lote', { quantidade: chunk.length, erro: error.message })
            }
        } catch (erro) {
            const mensagem = erro instanceof Error ? erro.message : String(erro)
            console.error('[notificacoes] falha ao enviar lote de e-mail', { quantidade: chunk.length, erro: mensagem })
            for (const email of chunk) {
                resultados.set(email.destinatario.email, { enviado: false, motivo: 'falha', erro: mensagem })
            }
        }
    }

    return resultados
}

/**
 * HTML mínimo e sem dependência externa: clientes de e-mail ignoram boa parte
 * do CSS moderno, e o conteúdo precisa continuar legível em texto puro.
 */
function montarHtml({ titulo, mensagem, destinatario }: EmailParaEnviar): string {
    const saudacao = destinatario.nome ? `Olá, ${escapar(destinatario.nome)}.` : 'Olá.'

    return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
      <p style="margin:0 0 16px;font-size:14px;color:#64748b">SOS Jaraguá — Defesa Civil de Jaraguá do Sul</p>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapar(titulo)}</h1>
      <p style="margin:0 0 8px;font-size:16px">${saudacao}</p>
      <p style="margin:0;font-size:16px;line-height:1.5">${escapar(mensagem)}</p>
    </div>
    <p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#64748b">
      Esta é uma mensagem automática. Não responda a este e-mail.
    </p>
  </body>
</html>`
}

function escapar(texto: string): string {
    return texto.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}
