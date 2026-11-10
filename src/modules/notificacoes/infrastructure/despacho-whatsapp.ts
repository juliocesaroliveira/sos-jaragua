import type { ContatosWhatsapp } from '../application/ports/contatos-whatsapp'
import type { EnviosWhatsapp, TentativaRegistrada, TentativaWhatsapp } from '../application/ports/envios-whatsapp'
import type { MensageriaWhatsapp } from '../application/ports/mensageria-whatsapp'
import type { Notificacao } from '../application/ports/notificacao-service'
import {
    MODELO_POR_EVENTO,
    avaliarElegibilidade,
    classificarErroMeta,
    eventoVaiPorWhatsapp,
    parametrosDoModelo,
    type EventoComWhatsapp
} from '../domain/whatsapp'

/**
 * Despacho do canal WhatsApp (024, contracts/canal-e-interfaces.md §1).
 *
 * Duas metades com tempos diferentes:
 *
 * 1. **Na hora**: decide quem é elegível e grava uma linha por notificação em
 *    `notificacao_envio` — `pendente` ou `nao_enviado` com motivo. São poucas
 *    consultas em lote, e é o que permite ao broadcast devolver o alcance na
 *    mesma resposta (FR-024) e garante que nenhuma tentativa some sem rastro.
 * 2. **Depois da resposta** (`agendar`, que em produção é o `after()` do Next):
 *    as chamadas HTTP à Meta. Um lote de 200 são 200 requisições — não podem
 *    atrasar a ação de quem notificou (FR-017, research D3).
 *
 * Sem dependência de Next aqui: `agendar` é injetado, o que mantém o despacho
 * testável sem o runtime.
 */

export type DependenciasDespacho = {
    mensageria: MensageriaWhatsapp
    envios: EnviosWhatsapp
    contatos: ContatosWhatsapp
    /** userId → usuário ativo (o mesmo `buscarContatos` que o e-mail usa). */
    situacaoUsuarios: (userIds: string[]) => Promise<Map<string, boolean>>
    /**
     * Agenda o envio HTTP. Devolve uma promessa quando executa na hora (fora de
     * escopo de requisição, ex.: testes de integração e scripts) — o despacho
     * a aguarda; com `after()` não devolve nada e a resposta segue.
     */
    agendar: (tarefa: () => Promise<void>) => void | Promise<void>
}

export type ResumoWhatsapp = { elegiveis: number; naoAlcancaveis: number }

/** Requisições simultâneas à Meta — conclui centenas em segundos sem estourar a taxa (research D5). */
const CONCORRENCIA = 10

const RESUMO_VAZIO: ResumoWhatsapp = { elegiveis: 0, naoAlcancaveis: 0 }

export async function despacharWhatsapp(
    chunk: Notificacao[],
    gravadas: { notificacaoId: string; destinatarioUserId: string }[],
    deps: DependenciasDespacho
): Promise<ResumoWhatsapp> {
    try {
        const paraWhatsapp = chunk.filter((n) =>
            // O canal pedido explicitamente ganha da matriz padrão, como no e-mail.
            n.canais ? n.canais.includes('whatsapp') && eventoVaiPorWhatsapp(n.evento) : eventoVaiPorWhatsapp(n.evento)
        )
        if (paraWhatsapp.length === 0) return RESUMO_VAZIO

        const tentativas = await resolverTentativas(paraWhatsapp, gravadas, deps)
        if (tentativas.length === 0) return RESUMO_VAZIO

        const registradas = await deps.envios.registrarTentativas(tentativas.map((t) => t.tentativa))

        const porNotificacao = new Map(tentativas.map((t) => [t.tentativa.notificacaoId, t]))
        const pendentes = registradas.flatMap((r) => {
            const origem = porNotificacao.get(r.notificacaoId)
            return r.status === 'pendente' && r.destino && origem?.evento ? [{ registro: r, ...origem }] : []
        })

        if (pendentes.length > 0) {
            await deps.agendar(() => enviarPendentes(pendentes, deps))
        }

        return {
            elegiveis: pendentes.length,
            naoAlcancaveis: registradas.filter((r) => r.status === 'nao_enviado').length
        }
    } catch (erro) {
        console.error('[notificacoes] whatsapp: falha ao registrar envios', {
            quantidade: chunk.length,
            erro
        })
        return RESUMO_VAZIO
    }
}

type TentativaResolvida = {
    tentativa: TentativaWhatsapp
    evento: EventoComWhatsapp | null
    titulo: string
    mensagem: string
}

async function resolverTentativas(
    notificacoes: Notificacao[],
    gravadas: { notificacaoId: string; destinatarioUserId: string }[],
    deps: DependenciasDespacho
): Promise<TentativaResolvida[]> {
    // Casar por destinatário, não por posição — mesma razão do e-mail.
    const idsPorDestinatario = new Map<string, string[]>()
    for (const g of gravadas) {
        const lista = idsPorDestinatario.get(g.destinatarioUserId) ?? []
        lista.push(g.notificacaoId)
        idsPorDestinatario.set(g.destinatarioUserId, lista)
    }

    const userIds = [...new Set(notificacoes.map((n) => n.destinatarioUserId))]
    const configurado = deps.mensageria.configurado()

    // Sem configuração não há por que ler preferência e telefone: tudo vira
    // "não configurado" e o sistema segue como antes (FR-018).
    const [ativos, preferencias, telefones] = configurado
        ? await Promise.all([
              deps.situacaoUsuarios(userIds),
              deps.envios.lerPreferencias(userIds),
              deps.contatos.telefonesDe(userIds)
          ])
        : [new Map<string, boolean>(), new Map<string, boolean>(), new Map<string, string>()]

    const resolvidas: TentativaResolvida[] = []
    for (const n of notificacoes) {
        const notificacaoId = idsPorDestinatario.get(n.destinatarioUserId)?.shift()
        if (!notificacaoId || !eventoVaiPorWhatsapp(n.evento)) continue

        const elegibilidade = configurado
            ? avaliarElegibilidade({
                  ativo: ativos.get(n.destinatarioUserId),
                  optIn: preferencias.get(n.destinatarioUserId),
                  telefone: telefones.get(n.destinatarioUserId)
              })
            : ({ elegivel: false, motivo: 'nao_configurado' } as const)

        resolvidas.push({
            tentativa: elegibilidade.elegivel
                ? { notificacaoId, status: 'pendente', destino: elegibilidade.destino }
                : { notificacaoId, status: 'nao_enviado', motivo: elegibilidade.motivo },
            evento: n.evento,
            titulo: n.titulo,
            mensagem: n.mensagem
        })
    }
    return resolvidas
}

type Pendente = TentativaResolvida & { registro: TentativaRegistrada }

async function enviarPendentes(pendentes: Pendente[], deps: DependenciasDespacho): Promise<void> {
    let proximo = 0
    const trabalhador = async () => {
        while (proximo < pendentes.length) {
            const p = pendentes[proximo++]!
            await enviarUm(p, deps)
        }
    }
    await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, pendentes.length) }, trabalhador))
}

async function enviarUm({ registro, evento, titulo, mensagem }: Pendente, deps: DependenciasDespacho): Promise<void> {
    try {
        if (!evento || !registro.destino) return
        const parametros = parametrosDoModelo(titulo, mensagem)
        const resultado = await deps.mensageria.enviarModelo(registro.destino, MODELO_POR_EVENTO[evento], {
            titulo: parametros.titulo,
            mensagem: parametros.mensagem
        })

        if (resultado.ok) {
            await deps.envios.marcarEnviado(registro.id, resultado.idExterno)
        } else {
            // Sem retentativa automática: número sem WhatsApp e limite de envio
            // não melhoram tentando de novo (FR-019, research D5).
            const erro = resultado.codigo == null ? resultado.erro : `${resultado.codigo}: ${resultado.erro}`
            await deps.envios.marcarFalha(registro.id, classificarErroMeta(resultado.codigo), erro)
        }
    } catch (erro) {
        console.error('[notificacoes] whatsapp: falha ao enviar', { envioId: registro.id, erro })
    }
}
