import { DomainError, ValidacaoError, falha, ok, type Result } from '@/src/shared/kernel'

/**
 * Regra de fragmentação de atividade em turnos (BR-VOL-04).
 *
 * A validação vive aqui e **não** como `CHECK` de banco (DESIGN.md §10.2):
 * permite mensagem de erro específica em pt-BR e flexibilizar a duração no
 * futuro sem migration.
 */
export const DURACAO_TURNO_HORAS = 4
export const DURACAO_TURNO_MS = DURACAO_TURNO_HORAS * 60 * 60 * 1000

export type DadosTurno = {
    inicio: Date
    fim: Date
    vagas: number
}

export function validarTurno(dados: DadosTurno): Result<DadosTurno, DomainError> {
    const campos: Record<string, string> = {}

    const duracao = dados.fim.getTime() - dados.inicio.getTime()

    if (Number.isNaN(duracao)) {
        campos.inicio = 'Informe início e fim válidos para o turno.'
    } else if (duracao <= 0) {
        campos.fim = 'O fim do turno deve ser depois do início.'
    } else if (duracao !== DURACAO_TURNO_MS) {
        const horas = duracao / (60 * 60 * 1000)
        campos.fim = `Turnos devem ter exatamente ${DURACAO_TURNO_HORAS} horas (este tem ${formatarHoras(horas)}).`
    }

    if (!Number.isInteger(dados.vagas) || dados.vagas <= 0) {
        campos.vagas = 'Informe um número de vagas maior que zero.'
    }

    if (Object.keys(campos).length > 0) {
        return falha(new ValidacaoError('Turno inválido.', { campos }))
    }

    return ok(dados)
}

/** Fim implícito de um turno a partir do início — usado ao montar a escala. */
export function fimDoTurno(inicio: Date): Date {
    return new Date(inicio.getTime() + DURACAO_TURNO_MS)
}

/**
 * Gera turnos consecutivos de 4h a partir de um início.
 * Ex.: 08:00 + 3 turnos → 08:00–12:00, 12:00–16:00, 16:00–20:00.
 */
export function gerarTurnosConsecutivos(inicio: Date, quantidade: number, vagas: number): DadosTurno[] {
    return Array.from({ length: quantidade }, (_, i) => {
        const inicioTurno = new Date(inicio.getTime() + i * DURACAO_TURNO_MS)
        return { inicio: inicioTurno, fim: fimDoTurno(inicioTurno), vagas }
    })
}

function formatarHoras(horas: number): string {
    const arredondado = Math.round(horas * 100) / 100
    return `${arredondado.toString().replace('.', ',')}h`
}
