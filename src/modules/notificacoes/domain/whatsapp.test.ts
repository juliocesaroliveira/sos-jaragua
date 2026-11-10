import { describe, expect, it } from 'vitest'
import {
    LIMITE_MENSAGEM_WHATSAPP,
    MODELO_POR_EVENTO,
    avaliarElegibilidade,
    classificarErroMeta,
    destinoWhatsapp,
    ehPedidoDeDescadastro,
    eventoVaiPorWhatsapp,
    mascararTelefone,
    parametrosDoModelo,
    proximaSituacao,
    situacaoDoWebhook,
    variantesDeWaId
} from './whatsapp'

/**
 * Regras puras do canal WhatsApp (specs/024-notificacoes-whatsapp,
 * data-model.md §6). Sem rede nem banco — Princípio III.
 */

describe('eventoVaiPorWhatsapp', () => {
    it.each([
        'triagem_concluida',
        'atividade_atribuida',
        'alteracao_atividade',
        'broadcast_urgencia',
        'lembrete_turno'
    ])('%s vai pelo WhatsApp', (evento) => {
        expect(eventoVaiPorWhatsapp(evento)).toBe(true)
    })

    it.each(['cadastros_acumulados', 'estoque_critico', 'deficit_atendimento', 'inscricao_turno'])(
        '%s fica só na plataforma',
        (evento) => {
            expect(eventoVaiPorWhatsapp(evento)).toBe(false)
        }
    )

    it('cada evento coberto tem um modelo de mensagem', () => {
        expect(Object.keys(MODELO_POR_EVENTO).sort()).toEqual(
            [
                'alteracao_atividade',
                'atividade_atribuida',
                'broadcast_urgencia',
                'lembrete_turno',
                'triagem_concluida'
            ].sort()
        )
    })
})

describe('destinoWhatsapp', () => {
    it('celular de 11 dígitos vira E.164 sem +', () => {
        expect(destinoWhatsapp('47999998888')).toBe('5547999998888')
    })

    it('aceita o número formatado', () => {
        expect(destinoWhatsapp('(47) 99999-8888')).toBe('5547999998888')
    })

    it('fixo de 10 dígitos não é elegível', () => {
        expect(destinoWhatsapp('4733334444')).toBeNull()
    })

    it('11 dígitos sem 9 no terceiro dígito não é celular', () => {
        expect(destinoWhatsapp('47899998888')).toBeNull()
    })

    it('vazio ou nulo não é elegível', () => {
        expect(destinoWhatsapp(null)).toBeNull()
        expect(destinoWhatsapp('')).toBeNull()
    })
})

describe('variantesDeWaId', () => {
    it('wa_id sem o 9º dígito (conta antiga) casa também a forma com 9', () => {
        expect(variantesDeWaId('554799998888').sort()).toEqual(['4799998888', '47999998888'].sort())
    })

    it('wa_id com o 9º dígito casa também a forma sem', () => {
        expect(variantesDeWaId('5547999998888').sort()).toEqual(['4799998888', '47999998888'].sort())
    })

    it('número que não é brasileiro não casa nada', () => {
        expect(variantesDeWaId('14155550123')).toEqual([])
    })
})

describe('avaliarElegibilidade', () => {
    const base = { ativo: true, optIn: true, telefone: '47999998888' }

    it('ativo, com opt-in e celular é elegível', () => {
        expect(avaliarElegibilidade(base)).toEqual({ elegivel: true, destino: '5547999998888' })
    })

    it('usuário inativo', () => {
        expect(avaliarElegibilidade({ ...base, ativo: false })).toEqual({ elegivel: false, motivo: 'usuario_inativo' })
    })

    it('sem opt-in, inclusive quando a preferência não existe', () => {
        expect(avaliarElegibilidade({ ...base, optIn: false })).toEqual({ elegivel: false, motivo: 'canal_desativado' })
        expect(avaliarElegibilidade({ ...base, optIn: undefined })).toEqual({
            elegivel: false,
            motivo: 'canal_desativado'
        })
    })

    it('sem telefone ou com telefone fixo', () => {
        expect(avaliarElegibilidade({ ...base, telefone: null })).toEqual({ elegivel: false, motivo: 'sem_celular' })
        expect(avaliarElegibilidade({ ...base, telefone: '4733334444' })).toEqual({
            elegivel: false,
            motivo: 'sem_celular'
        })
    })
})

describe('parametrosDoModelo', () => {
    it('troca quebras de linha, tabulações e espaços em excesso', () => {
        const p = parametrosDoModelo('Convocação\nurgente', 'Linha 1\n\nLinha 2\tcom tab     e espaços')
        expect(p.titulo).toBe('Convocação — urgente')
        expect(p.mensagem).toBe('Linha 1 — Linha 2 com tab e espaços')
        expect(p.encurtada).toBe(false)
    })

    it('mantém mensagem de até 700 caracteres inteira', () => {
        const mensagem = 'a'.repeat(LIMITE_MENSAGEM_WHATSAPP)
        expect(parametrosDoModelo('t', mensagem)).toEqual({ titulo: 't', mensagem, encurtada: false })
    })

    it('acima de 700, leva 680 caracteres e o aviso de continuação', () => {
        const p = parametrosDoModelo('t', 'b'.repeat(LIMITE_MENSAGEM_WHATSAPP + 1))
        expect(p.encurtada).toBe(true)
        expect(p.mensagem).toBe('b'.repeat(680) + '… (continua no SOS Jaraguá)')
    })

    it('nunca devolve variável vazia (a Meta recusa)', () => {
        expect(parametrosDoModelo('  ', '\n').titulo).toBe('-')
        expect(parametrosDoModelo('  ', '\n').mensagem).toBe('-')
    })
})

describe('proximaSituacao', () => {
    it('avança pendente → enviado → entregue → lido', () => {
        expect(proximaSituacao('pendente', 'enviado')).toBe('enviado')
        expect(proximaSituacao('enviado', 'entregue')).toBe('entregue')
        expect(proximaSituacao('entregue', 'lido')).toBe('lido')
    })

    it('aceita pular etapas (leitura antes da entrega)', () => {
        expect(proximaSituacao('enviado', 'lido')).toBe('lido')
    })

    it('ignora regressões e repetições', () => {
        expect(proximaSituacao('lido', 'entregue')).toBeNull()
        expect(proximaSituacao('entregue', 'enviado')).toBeNull()
        expect(proximaSituacao('entregue', 'entregue')).toBeNull()
    })

    it('falha só a partir de pendente ou enviado', () => {
        expect(proximaSituacao('pendente', 'falhou')).toBe('falhou')
        expect(proximaSituacao('enviado', 'falhou')).toBe('falhou')
        expect(proximaSituacao('entregue', 'falhou')).toBeNull()
        expect(proximaSituacao('lido', 'falhou')).toBeNull()
    })

    it('estados terminais não mudam', () => {
        expect(proximaSituacao('falhou', 'entregue')).toBeNull()
        expect(proximaSituacao('nao_enviado', 'enviado')).toBeNull()
    })
})

describe('situacaoDoWebhook', () => {
    it('mapeia os quatro estados da Meta e ignora o resto', () => {
        expect(situacaoDoWebhook('sent')).toBe('enviado')
        expect(situacaoDoWebhook('delivered')).toBe('entregue')
        expect(situacaoDoWebhook('read')).toBe('lido')
        expect(situacaoDoWebhook('failed')).toBe('falhou')
        expect(situacaoDoWebhook('deleted')).toBeNull()
    })
})

describe('classificarErroMeta', () => {
    it.each([
        [131026, 'numero_sem_whatsapp'],
        [130429, 'limite_envio'],
        [131048, 'limite_envio'],
        [131056, 'limite_envio'],
        [132001, 'modelo_indisponivel'],
        [132015, 'modelo_indisponivel'],
        [132016, 'modelo_indisponivel'],
        [190, 'nao_configurado'],
        [10, 'nao_configurado'],
        [200, 'nao_configurado'],
        [999999, 'falha'],
        [null, 'falha']
    ] as const)('%s → %s', (codigo, motivo) => {
        expect(classificarErroMeta(codigo)).toBe(motivo)
    })
})

describe('ehPedidoDeDescadastro', () => {
    it.each(['SAIR', ' Parar! ', 'stop', 'Cancelar', 'descadastrar', 'sáir'])('"%s" é descadastro', (texto) => {
        expect(ehPedidoDeDescadastro(texto)).toBe(true)
    })

    it.each(['quero sair do grupo', 'oi', '', 'sairr'])('"%s" não é', (texto) => {
        expect(ehPedidoDeDescadastro(texto)).toBe(false)
    })
})

describe('mascararTelefone', () => {
    it('mostra DDD, o primeiro dígito e os 4 últimos', () => {
        expect(mascararTelefone('5547999998888')).toBe('(47) 9****-8888')
    })

    it('aceita o número local', () => {
        expect(mascararTelefone('47999998888')).toBe('(47) 9****-8888')
    })

    it('nulo vira traço', () => {
        expect(mascararTelefone(null)).toBe('—')
    })
})
