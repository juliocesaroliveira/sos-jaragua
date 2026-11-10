import 'server-only'
import { after } from 'next/server'
import { contatosWhatsapp } from '@/src/modules/voluntariado/infrastructure/drizzle/contatos-whatsapp'
import type { Notificacao, NotificacaoService, ResumoEnvio } from '../application/ports/notificacao-service'
import { despacharWhatsapp, type DependenciasDespacho, type ResumoWhatsapp } from './despacho-whatsapp'
import { enviarEmails, eventoVaiPorEmail, type EmailParaEnviar } from './notificacao-email'
import {
    buscarContatos,
    gravarNaPlataforma,
    registrarEnvioEmail,
    type NotificacaoGravada
} from './notificacao-plataforma'
import { whatsappCloudApi } from './whatsapp-cloud-api'
import { whatsappRepositorio } from './whatsapp-repositorio'

/**
 * Tamanho do chunk no envio em lote (broadcast de urgência, DESIGN.md §12).
 *
 * Sem infra de fila, um broadcast grande precisa caber no limite de duração da
 * função na Vercel — processar em chunks mantém cada passo curto e permite que
 * uma falha parcial não perca o lote inteiro.
 */
const TAMANHO_CHUNK = 50

/**
 * Montagem do canal WhatsApp (024). Este arquivo é o ponto onde os adapters
 * concretos se encontram: a implementação de `ContatosWhatsapp` vem do
 * Voluntariado, dono do telefone, e entra aqui só pelo port (research D10).
 */
const dependenciasWhatsapp: DependenciasDespacho = {
    mensageria: whatsappCloudApi,
    envios: whatsappRepositorio,
    contatos: contatosWhatsapp,
    async situacaoUsuarios(userIds) {
        const contatos = await buscarContatos(userIds)
        return new Map([...contatos].map(([userId, c]) => [userId, c.ativo]))
    },
    agendar(tarefa) {
        // `after()` só existe dentro de uma requisição (Server Action, Route
        // Handler); fora dela lança, e então o envio roda na hora.
        try {
            after(tarefa)
        } catch {
            return tarefa()
        }
    }
}

/**
 * Implementação do port de notificação (DESIGN.md §12).
 *
 * Ordem deliberada: grava **primeiro** in-plataforma (a cópia durável), depois
 * os canais acessórios — e-mail e WhatsApp (024). Se um deles falhar, a
 * notificação continua existindo no sino e `notificacao_envio` registra a
 * falha para reconciliação; a falha de um canal não impede o outro.
 *
 * Contrato de falha: notificar **nunca** derruba a operação de negócio que a
 * disparou. Erros são registrados no log estruturado (visível no Log Stream da
 * Vercel) e a chamada retorna normalmente.
 */
export const notificacaoService: NotificacaoService = {
    async enviar(notificacao) {
        await processar([notificacao])
    },

    async enviarEmLote(notificacoes) {
        await processar(notificacoes)
    },

    enviarEmLoteComResumo(notificacoes) {
        return processar(notificacoes)
    }
}

async function processar(notificacoes: Notificacao[]): Promise<ResumoEnvio> {
    const whatsapp: ResumoWhatsapp = { elegiveis: 0, naoAlcancaveis: 0 }

    for (let i = 0; i < notificacoes.length; i += TAMANHO_CHUNK) {
        const chunk = notificacoes.slice(i, i + TAMANHO_CHUNK)
        try {
            const gravadas = await gravarNaPlataforma(chunk)
            const [, resumo] = await Promise.all([
                despacharEmails(chunk, gravadas).catch((erro: unknown) => {
                    console.error('[notificacoes] falha ao despachar e-mails', { quantidade: chunk.length, erro })
                }),
                // Captura as próprias falhas e devolve resumo zerado.
                despacharWhatsapp(chunk, gravadas, dependenciasWhatsapp)
            ])
            whatsapp.elegiveis += resumo.elegiveis
            whatsapp.naoAlcancaveis += resumo.naoAlcancaveis
        } catch (erro) {
            console.error('[notificacoes] falha ao processar chunk', {
                quantidade: chunk.length,
                eventos: [...new Set(chunk.map((n: Notificacao) => n.evento))],
                erro
            })
        }
    }

    return { whatsapp }
}

async function despacharEmails(chunk: Notificacao[], gravadas: NotificacaoGravada[]): Promise<void> {
    // Índice por destinatário: as notificações de um chunk são gravadas na
    // mesma ordem em que chegaram, mas casar por posição seria frágil.
    const idsPorDestinatario = new Map<string, string[]>()
    for (const g of gravadas) {
        const lista = idsPorDestinatario.get(g.destinatarioUserId) ?? []
        lista.push(g.notificacaoId)
        idsPorDestinatario.set(g.destinatarioUserId, lista)
    }

    const paraEmail = chunk.filter((n) => {
        // O canal pedido explicitamente ganha da matriz padrão do BRD §6.
        if (n.canais) return n.canais.includes('email')
        return eventoVaiPorEmail(n.evento)
    })
    if (paraEmail.length === 0) return

    const contatos = await buscarContatos(paraEmail.map((n) => n.destinatarioUserId))

    const emails: (EmailParaEnviar & { notificacaoId: string })[] = []
    for (const n of paraEmail) {
        const contato = contatos.get(n.destinatarioUserId)
        // Usuário desativado não recebe e-mail — perdeu o acesso e provavelmente
        // não deveria mais ser acionado.
        if (!contato || !contato.ativo) continue

        const notificacaoId = idsPorDestinatario.get(n.destinatarioUserId)?.shift()
        if (!notificacaoId) continue

        emails.push({
            notificacaoId,
            evento: n.evento,
            destinatario: { email: contato.email, nome: contato.nome },
            assunto: `[SOS Jaraguá] ${n.titulo}`,
            titulo: n.titulo,
            mensagem: n.mensagem
        })
    }

    if (emails.length === 0) return

    const resultados = await enviarEmails(emails)

    await registrarEnvioEmail(
        emails.map((e) => {
            const resultado = resultados.get(e.destinatario.email)
            return resultado?.enviado
                ? { notificacaoId: e.notificacaoId, status: 'enviado' as const }
                : {
                      notificacaoId: e.notificacaoId,
                      status: 'falhou' as const,
                      erro: resultado?.enviado === false ? (resultado.erro ?? resultado.motivo) : 'desconhecido'
                  }
        })
    )
}
