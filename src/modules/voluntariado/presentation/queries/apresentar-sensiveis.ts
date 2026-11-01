import 'server-only'
import { decifrar, ehEnvelope, ValorIlegivelError } from '@/src/shared/cripto'
import { apresentar, CAMPO_ILEGIVEL, type ApresentacaoCampo } from '@/src/shared/mascara'
import { MASCARA_DO_CAMPO, type CampoSensivel } from '@/src/shared/mascara/campos-sensiveis'

/**
 * Converte os campos sensíveis de uma linha do banco na forma de apresentação
 * mascarada (feature 024, FR-012).
 *
 * É daqui que vem a propriedade estrutural que FR-012 pede: uma tela nova que
 * consuma a query recebe o mascarado **por construção**, sem precisar saber que
 * o campo é sensível nem lembrar de aplicar a máscara.
 *
 * Esta função é segura dentro de escopo `'use cache'` justamente porque não lê
 * sessão: a saída é a mesma para qualquer role, então uma entrada de cache nunca
 * serve dado de uma role a outra.
 */

/** Decifra e mascara um campo, ou devolve o estado de falha (FR-014). */
function campo(valor: string | null, qual: CampoSensivel): ApresentacaoCampo {
    if (valor === null || valor === '') return { estado: 'ausente' }

    try {
        // Linhas gravadas antes da migração de proteção ainda estão em claro — ler
        // as duas formas mantém as telas funcionais durante a janela da migração.
        const emClaro = ehEnvelope(valor) ? decifrar(valor) : valor
        return apresentar(emClaro, MASCARA_DO_CAMPO[qual])
    } catch (erro) {
        if (erro instanceof ValorIlegivelError) return CAMPO_ILEGIVEL
        throw erro
    }
}

type LinhaComSensiveis = {
    cpf: string | null
    dataNascimento: string | null
    cep: string | null
}

export type SensiveisApresentados = {
    cpf: ApresentacaoCampo
    dataNascimento: ApresentacaoCampo
    cep: ApresentacaoCampo
}

export function apresentarSensiveis(linha: LinhaComSensiveis): SensiveisApresentados {
    return {
        cpf: campo(linha.cpf, 'cpf'),
        dataNascimento: campo(linha.dataNascimento, 'dataNascimento'),
        cep: campo(linha.cep, 'cep')
    }
}

/** Variante para linhas que carregam apenas o CPF. */
export function apresentarCpf(cpf: string | null): ApresentacaoCampo {
    return campo(cpf, 'cpf')
}

/**
 * CPF mascarado como **string simples**, para linhas de relatório.
 *
 * Relatório alimenta tela e planilha com o mesmo dado, e a célula de uma
 * planilha quer texto, não um objeto de três estados. Falha de leitura e
 * ausência viram marcadores textuais em vez de quebrar a exportação inteira.
 */
export function cpfMascaradoParaRelatorio(cpf: string | null): string {
    const r = campo(cpf, 'cpf')
    if (r.estado === 'mascarado') return r.exibicao
    return r.estado === 'ilegivel' ? '[ilegível]' : '—'
}

/** Rótulo de um titular que pediu a eliminação dos próprios dados (FR-022). */
export const TITULAR_ANONIMO = 'Titular anônimo'

/** Marcador dos demais campos pessoais de um titular anonimizado. */
export const CAMPO_ANONIMIZADO = '—'

/**
 * Nome do voluntário para exibição, ou o rótulo de titular anônimo
 * (feature 024, FR-022 e INV-06).
 *
 * Fica nas queries, e não nas telas, de propósito: é o que permite os tipos
 * públicos continuarem `string` e as dezenas de superfícies existentes seguirem
 * renderizando sem cada uma precisar tratar nulo. O histórico continua legível —
 * um turno cumprido aparece com todos os dados do turno — sem identificar quem
 * cumpriu.
 */
export function nomeParaExibicao(nome: string | null): string {
    return nome ?? TITULAR_ANONIMO
}

/** Idem, para os campos pessoais que não são o nome. */
export function textoOuAnonimizado(valor: string | null): string {
    return valor ?? CAMPO_ANONIMIZADO
}
