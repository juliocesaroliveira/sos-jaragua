import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UsuarioRepository } from '@/src/modules/identidade/application/ports/usuario-repository'
import type { PerfilVoluntario, UnidadeDeTrabalho, VoluntarioRepository } from '../ports/voluntario-repository'
import { SubmeterCandidaturaUseCase } from './submeter-candidatura'
import type { DadosCandidatura } from '../../domain/candidatura'

/**
 * BR-VOL-01 + 011-auto-cadastro-provedor (FR-016/FR-017,
 * contracts/candidatura-precarregada.md C-14).
 *
 * O foco aqui é a orquestração nova: de onde vem a data de nascimento e quando
 * ela é gravada na conta. A atomicidade real (perfil + conta na mesma
 * transação) é responsabilidade da unidade de trabalho e está coberta pelo
 * teste de integração.
 */

// A auditoria escreve no Mongo; aqui só interessa que não atrapalhe.
vi.mock('@/src/modules/auditoria', () => ({
    withAudit: <T>(_opcoes: unknown, fn: () => Promise<T>) => fn()
}))

const USER_ID = 'user-1'

const DADOS: DadosCandidatura = {
    nomeCompleto: 'Fulano de Tal',
    dataNascimento: '1990-05-20',
    cpf: '52998224725',
    telefone: '47999998888',
    cep: '89250000',
    bairro: 'Centro',
    profissao: 'Enfermeiro',
    restricoesSaude: null,
    veiculoProprio: false,
    tipoVeiculo: null,
    disponibilidade: ['integral'],
    habilidadeIds: []
}

type SalvarCandidatura = VoluntarioRepository['salvarCandidatura']
type DefinirDataNascimento = UsuarioRepository['definirDataNascimentoSeAusente']

function perfilSalvo(overrides: Partial<PerfilVoluntario> = {}): PerfilVoluntario {
    return {
        id: 'perfil-1',
        userId: USER_ID,
        nomeCompleto: DADOS.nomeCompleto,
        cpf: DADOS.cpf,
        status: 'pendente',
        ...overrides
    }
}

/**
 * Unidade de trabalho falsa: executa a função imediatamente com os dois
 * repositórios, sem transação. Mantém a mesma forma do port real, então o caso
 * de uso não sabe a diferença.
 */
function montarCenario(existente: PerfilVoluntario | null = null) {
    const salvarCandidatura = vi.fn<SalvarCandidatura>(async ({ dados }) =>
        perfilSalvo({ nomeCompleto: dados.nomeCompleto, cpf: dados.cpf })
    )
    const definirDataNascimentoSeAusente = vi.fn<DefinirDataNascimento>(async () => {})

    const voluntarios = {
        buscarPorCpf: vi.fn(async () => existente),
        buscarPorId: vi.fn(async () => existente),
        salvarCandidatura,
        aprovar: vi.fn(async () => {}),
        rejeitar: vi.fn(async () => {})
    } as unknown as VoluntarioRepository

    const usuarios = {
        definirDataNascimentoSeAusente,
        buscarDataNascimento: vi.fn(async () => null),
        listar: vi.fn(),
        atualizarNomeERole: vi.fn(),
        atualizarRole: vi.fn(),
        buscarRole: vi.fn(),
        possuiSenhaPropria: vi.fn()
    } as unknown as UsuarioRepository

    const uow: UnidadeDeTrabalho = { executar: (fn) => fn({ voluntarios, usuarios }) }

    return { uow, salvarCandidatura, definirDataNascimentoSeAusente }
}

describe('SubmeterCandidaturaUseCase — origem da data de nascimento', () => {
    beforeEach(() => vi.clearAllMocks())

    it('descarta a data enviada pelo formulário quando a conta já tem o valor', async () => {
        const { uow, salvarCandidatura, definirDataNascimentoSeAusente } = montarCenario()

        const resultado = await new SubmeterCandidaturaUseCase(uow).executar({
            userId: USER_ID,
            // Campo desabilitado no navegador não é enforcement: aqui simulamos
            // o POST forjado com outra data.
            dados: { ...DADOS, dataNascimento: '2000-01-01' },
            dataNascimentoDaConta: '1990-05-20'
        })

        expect(resultado.ok).toBe(true)
        expect(salvarCandidatura.mock.calls[0]?.[0].dados.dataNascimento).toBe('1990-05-20')
        // A conta já tinha o valor — nada a gravar.
        expect(definirDataNascimentoSeAusente).not.toHaveBeenCalled()
    })

    it('grava na conta a data do formulário quando a conta ainda não tem o valor', async () => {
        const { uow, salvarCandidatura, definirDataNascimentoSeAusente } = montarCenario()

        const resultado = await new SubmeterCandidaturaUseCase(uow).executar({
            userId: USER_ID,
            dados: DADOS,
            dataNascimentoDaConta: null
        })

        expect(resultado.ok).toBe(true)
        expect(salvarCandidatura.mock.calls[0]?.[0].dados.dataNascimento).toBe('1990-05-20')
        expect(definirDataNascimentoSeAusente).toHaveBeenCalledWith(USER_ID, '1990-05-20')
    })

    it('reprova por maioridade usando a data da conta, não a forjada no envio', async () => {
        const { uow, salvarCandidatura, definirDataNascimentoSeAusente } = montarCenario()

        const resultado = await new SubmeterCandidaturaUseCase(uow).executar({
            userId: USER_ID,
            dados: { ...DADOS, dataNascimento: '1990-05-20' },
            dataNascimentoDaConta: '2015-01-01'
        })

        expect(resultado.ok).toBe(false)
        expect(salvarCandidatura).not.toHaveBeenCalled()
        expect(definirDataNascimentoSeAusente).not.toHaveBeenCalled()
    })

    it('exige a data quando nem a conta nem o formulário a informaram', async () => {
        const { uow, salvarCandidatura } = montarCenario()

        const resultado = await new SubmeterCandidaturaUseCase(uow).executar({
            userId: USER_ID,
            dados: { ...DADOS, dataNascimento: '' },
            dataNascimentoDaConta: null
        })

        expect(resultado.ok).toBe(false)
        expect(salvarCandidatura).not.toHaveBeenCalled()
    })
})

describe('SubmeterCandidaturaUseCase — regras preservadas', () => {
    beforeEach(() => vi.clearAllMocks())

    it('recusa CPF já vinculado a outra conta', async () => {
        const { uow, salvarCandidatura } = montarCenario(perfilSalvo({ userId: 'outro-user' }))

        const resultado = await new SubmeterCandidaturaUseCase(uow).executar({
            userId: USER_ID,
            dados: DADOS,
            dataNascimentoDaConta: null
        })

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(resultado.erro.paraObjeto().detalhes?.campos).toMatchObject({ cpf: 'CPF já cadastrado.' })
        expect(salvarCandidatura).not.toHaveBeenCalled()
    })

    it('recusa reenvio de candidatura já aprovada', async () => {
        const { uow, salvarCandidatura, definirDataNascimentoSeAusente } = montarCenario(
            perfilSalvo({ status: 'aprovado' })
        )

        const resultado = await new SubmeterCandidaturaUseCase(uow).executar({
            userId: USER_ID,
            dados: DADOS,
            dataNascimentoDaConta: null
        })

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(resultado.erro.codigo).toBe('candidatura_ja_aprovada')
        expect(salvarCandidatura).not.toHaveBeenCalled()
        // Uma candidatura recusada não pode gravar nada na conta.
        expect(definirDataNascimentoSeAusente).not.toHaveBeenCalled()
    })

    it('reaproveita a linha existente no reenvio de candidatura rejeitada', async () => {
        const { uow, salvarCandidatura } = montarCenario(perfilSalvo({ status: 'rejeitado' }))

        const resultado = await new SubmeterCandidaturaUseCase(uow).executar({
            userId: USER_ID,
            dados: DADOS,
            dataNascimentoDaConta: '1990-05-20'
        })

        expect(resultado.ok).toBe(true)
        expect(salvarCandidatura).toHaveBeenCalledTimes(1)
    })
})
