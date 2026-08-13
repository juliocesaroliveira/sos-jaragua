import { DomainError, ValidacaoError, falha, ok, type Result } from '@/src/shared/kernel'
import {
    cepEhValido,
    cpfEhValido,
    ehMaiorDeIdade,
    normalizarCep,
    normalizarCpf,
    normalizarTelefone,
    telefoneEhValido
} from '@/src/modules/identidade/domain'

/**
 * Regras de domínio da candidatura a voluntário (BRD §3.1, DESIGN.md §10.1).
 * Puro: sem Next.js, Drizzle ou Mongo.
 */

export const TIPOS_VEICULO = ['carro', 'caminhonete', 'moto', 'barco'] as const
export type TipoVeiculo = (typeof TIPOS_VEICULO)[number]

export const DISPONIBILIDADES = ['integral', 'manha', 'tarde', 'noite', 'fim_de_semana'] as const
export type Disponibilidade = (typeof DISPONIBILIDADES)[number]

export const ROTULO_TIPO_VEICULO: Record<TipoVeiculo, string> = {
    carro: 'Carro',
    caminhonete: 'Caminhonete',
    moto: 'Moto',
    barco: 'Barco'
}

export const ROTULO_DISPONIBILIDADE: Record<Disponibilidade, string> = {
    integral: 'Integral',
    manha: 'Manhã',
    tarde: 'Tarde',
    noite: 'Noite',
    fim_de_semana: 'Fim de semana'
}

export type DadosCandidatura = {
    nomeCompleto: string
    /** `YYYY-MM-DD` */
    dataNascimento: string
    cpf: string
    telefone: string
    cep: string
    bairro: string
    profissao: string
    restricoesSaude?: string | null
    veiculoProprio: boolean
    tipoVeiculo?: TipoVeiculo | null
    disponibilidade: Disponibilidade[]
    habilidadeIds: string[]
}

/** Mesma forma dos dados, já normalizada para persistência. */
export type CandidaturaValidada = Omit<DadosCandidatura, 'cpf' | 'telefone' | 'cep'> & {
    cpf: string
    telefone: string
    cep: string
}

/**
 * Valida e normaliza uma candidatura. Devolve **todos** os erros de uma vez
 * (`detalhes.campos`) — quem preenche o formulário no celular, em campo, não
 * deve descobrir um problema por vez.
 */
export function validarCandidatura(
    dados: DadosCandidatura,
    hoje: Date = new Date()
): Result<CandidaturaValidada, DomainError> {
    const campos: Record<string, string> = {}

    if (!dados.nomeCompleto.trim()) campos.nomeCompleto = 'Informe o nome completo.'

    if (!dados.dataNascimento) {
        campos.dataNascimento = 'Informe a data de nascimento.'
    } else if (!ehMaiorDeIdade(dados.dataNascimento, hoje)) {
        campos.dataNascimento = 'É necessário ter 18 anos ou mais para se candidatar.'
    }

    const cpf = normalizarCpf(dados.cpf)
    if (!cpfEhValido(cpf)) campos.cpf = 'CPF inválido. Confira os números digitados.'

    const telefone = normalizarTelefone(dados.telefone)
    if (!telefoneEhValido(telefone)) campos.telefone = 'Telefone inválido. Use DDD + número.'

    const cep = normalizarCep(dados.cep)
    if (!cepEhValido(cep)) campos.cep = 'CEP inválido. Use 8 dígitos.'

    if (!dados.bairro.trim()) campos.bairro = 'Informe o bairro.'
    if (!dados.profissao.trim()) campos.profissao = 'Informe a profissão ou formação.'

    // Condicional do BRD §3.1: "Se Sim, habilitar campo Tipo de Veículo".
    if (dados.veiculoProprio && !dados.tipoVeiculo) {
        campos.tipoVeiculo = 'Informe o tipo de veículo.'
    }

    if (dados.disponibilidade.length === 0) {
        campos.disponibilidade = 'Selecione ao menos uma disponibilidade.'
    }

    if (Object.keys(campos).length > 0) {
        return falha(new ValidacaoError('Revise os campos destacados.', { campos }))
    }

    return ok({
        ...dados,
        cpf,
        telefone,
        cep,
        nomeCompleto: dados.nomeCompleto.trim(),
        bairro: dados.bairro.trim(),
        profissao: dados.profissao.trim(),
        restricoesSaude: dados.restricoesSaude?.trim() || null,
        // Sem veículo próprio, o tipo é irrelevante — nunca persistir lixo.
        tipoVeiculo: dados.veiculoProprio ? (dados.tipoVeiculo ?? null) : null
    })
}
