import { DomainError, falha, ok, type Result } from '@/src/shared/kernel'

/**
 * Regras puras da inscrição própria em turno (018-inscricao-atividades,
 * research D4).
 *
 * Todas as funções recebem `agora` por parâmetro — nenhuma lê o relógio. É o
 * que permite testar as bordas (exatamente 30 min, turno encostado) sem fake
 * timers, e o que garante que a tela e a escrita avaliem o mesmo instante.
 *
 * A mesma `estadoDoTurno` monta a tela e `validarInscricao` valida a escrita
 * dentro da transação: UI e regra não podem divergir.
 */

export const PRAZO_DESISTENCIA_MINUTOS = 30
const PRAZO_DESISTENCIA_MS = PRAZO_DESISTENCIA_MINUTOS * 60 * 1000

/** Fração das vagas a partir da qual o turno aparece como "Últimas vagas". */
const FRACAO_ULTIMAS_VAGAS = 0.2

export type StatusPerfilVoluntario = 'pendente' | 'aprovado' | 'rejeitado'

export type MotivoRecusaInscricao =
    'nao_elegivel' | 'atividade_fechada' | 'turno_iniciado' | 'lotado' | 'ja_inscrito' | 'conflito_horario'

export type EstadoTurno = 'inscrito' | 'em_andamento' | 'lotado' | 'ultimas_vagas' | 'com_vagas'

export type Intervalo = { inicio: Date; fim: Date }

export const MENSAGEM_NAO_ELEGIVEL = 'Para participar de turnos é preciso ter o cadastro de voluntário aprovado.'

/**
 * FR-011 — equipe interna (membro da Defesa Civil, coordenador,
 * administrador) se inscreve mesmo sem perfil de voluntário; os demais
 * precisam de perfil aprovado.
 *
 * Recebe `equipeInterna` já resolvido em vez do papel para não acoplar o
 * domínio à matriz de papéis da camada de autenticação.
 */
export function podeSeInscrever({
    equipeInterna,
    statusPerfil
}: {
    equipeInterna: boolean
    statusPerfil: StatusPerfilVoluntario | null
}): boolean {
    return equipeInterna || statusPerfil === 'aprovado'
}

/**
 * Sobreposição de intervalos semiabertos `[inicio, fim)`: turnos encostados
 * (08–12 e 12–16) **não** conflitam — é exatamente como a escala de 4h é
 * montada (BR-VOL-04).
 */
export function turnosSobrepoem(a: Intervalo, b: Intervalo): boolean {
    return a.inicio.getTime() < b.fim.getTime() && b.inicio.getTime() < a.fim.getTime()
}

export type EntradaValidarInscricao = {
    turno: Intervalo & { vagas: number }
    atividadeAberta: boolean
    /** Alocações confirmadas no turno, de qualquer origem. */
    confirmados: number
    /** O participante já tem alocação confirmada neste turno. */
    jaInscrito: boolean
    /** Outros turnos confirmados do participante — o conflito é decidido aqui. */
    outrosTurnosDoParticipante: Array<Intervalo & { titulo: string }>
    agora: Date
}

/**
 * FR-014 — motivos de recusa, na ordem em que são avaliados. `ja_inscrito`
 * vem antes de `lotado`: quem já está no turno lotado precisa ouvir que já
 * está inscrito, não que não há vaga.
 */
export function validarInscricao(entrada: EntradaValidarInscricao): Result<true, DomainError> {
    const { turno, agora } = entrada

    if (!entrada.atividadeAberta) {
        return recusa('atividade_fechada', 'Esta atividade não está mais aberta para inscrições.')
    }
    if (agora.getTime() >= turno.inicio.getTime()) {
        return recusa('turno_iniciado', 'Este turno já começou.')
    }
    if (entrada.jaInscrito) {
        return recusa('ja_inscrito', 'Você já está inscrito neste turno.')
    }
    if (entrada.confirmados >= turno.vagas) {
        return recusa('lotado', 'Este turno acabou de ficar lotado.')
    }

    const conflito = entrada.outrosTurnosDoParticipante.find((outro) => turnosSobrepoem(turno, outro))
    if (conflito) {
        return recusa(
            'conflito_horario',
            `Você já está escalado em outro turno neste horário: ${conflito.titulo}, ${formatarHora(conflito.inicio)}–${formatarHora(conflito.fim)}.`
        )
    }

    return ok(true)
}

/**
 * FR-017/FR-018a — desistência pela tela até 30 minutos antes do início
 * (inclusive). Depois disso só a coordenação remove a alocação.
 */
export function validarDesistencia({ inicio, agora }: { inicio: Date; agora: Date }): Result<true, DomainError> {
    if (agora.getTime() > inicio.getTime() - PRAZO_DESISTENCIA_MS) {
        return falha(
            new DomainError(
                'prazo_desistencia',
                `Faltam menos de ${PRAZO_DESISTENCIA_MINUTOS} minutos para o turno. Para desistir, fale com a coordenação.`
            )
        )
    }
    return ok(true)
}

/**
 * FR-006 — estado de um turno **não terminado** (quem chama descarta turnos
 * com `fim <= agora`). Precedência: inscrito → em andamento → lotado →
 * últimas vagas → com vagas.
 *
 * "Últimas vagas" = restam até 20% das vagas, arredondado para cima e nunca
 * menos que 1 — um turno de 1 vaga vazio já está na última vaga.
 */
export function estadoDoTurno({
    vagas,
    preenchidas,
    inicio,
    fim,
    inscrito,
    agora
}: {
    vagas: number
    preenchidas: number
    inicio: Date
    fim: Date
    inscrito: boolean
    agora: Date
}): EstadoTurno {
    if (inscrito) return 'inscrito'
    if (agora.getTime() >= inicio.getTime() && agora.getTime() < fim.getTime()) return 'em_andamento'

    const restantes = vagas - preenchidas
    if (restantes <= 0) return 'lotado'

    const limite = Math.max(1, Math.ceil(vagas * FRACAO_ULTIMAS_VAGAS))
    return restantes <= limite ? 'ultimas_vagas' : 'com_vagas'
}

function recusa(codigo: MotivoRecusaInscricao, mensagem: string): Result<never, DomainError> {
    return falha(new DomainError(codigo, mensagem))
}

const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

function formatarHora(data: Date): string {
    return HORA.format(data)
}
