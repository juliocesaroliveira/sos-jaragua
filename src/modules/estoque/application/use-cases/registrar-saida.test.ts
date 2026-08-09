import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Deficit, SaidaRepository } from '../ports/estoque-repository'
import { mensagemDeDeficit, RegistrarSaidaUseCase } from './registrar-saida'

/**
 * TEST-03 — `RegistrarSaidaUseCase` com repositório em memória.
 *
 * Cobre a orquestração que o caso de uso faz (expandir receita, consolidar,
 * validar campos, traduzir déficit em mensagem). A dedução atômica em si é
 * responsabilidade do repositório e está coberta pelo teste de integração.
 */

// A auditoria escreve no Mongo; aqui só interessa que não atrapalhe.
vi.mock('@/src/modules/auditoria', () => ({
    withAudit: <T>(_opcoes: unknown, fn: () => Promise<T>) => fn()
}))

const ARROZ = '11111111-1111-1111-1111-111111111111'
const FEIJAO = '22222222-2222-2222-2222-222222222222'

const BASE = {
    tipo: 'kit' as const,
    destino: 'Abrigo Central',
    responsavelTransporte: 'Carlos',
    registradoPor: 'user-1'
}

/**
 * Tipar o mock com a assinatura do port é o que dá a `mock.calls` o formato
 * real dos argumentos — sem isso o TypeScript infere uma tupla vazia e
 * inspecionar a chamada não compila.
 */
type Registrar = SaidaRepository['registrar']

function repositorioQueAceita() {
    const registrar = vi.fn<Registrar>(async () => ({ saidaId: 'saida-1' }))
    return { repo: { registrar } satisfies SaidaRepository, registrar }
}

function repositorioQueBloqueia(deficits: Deficit[]) {
    const registrar = vi.fn<Registrar>(async () => ({ deficits }))
    return { repo: { registrar } satisfies SaidaRepository, registrar }
}

describe('RegistrarSaidaUseCase — validação de campos', () => {
    let useCase: RegistrarSaidaUseCase
    let registrar: ReturnType<typeof repositorioQueAceita>['registrar']

    beforeEach(() => {
        const r = repositorioQueAceita()
        registrar = r.registrar
        useCase = new RegistrarSaidaUseCase(r.repo)
    })

    it('exige destino e responsável', async () => {
        const r = await useCase.executar({
            ...BASE,
            destino: '   ',
            responsavelTransporte: '',
            kits: [{ kitId: 'k', nome: 'Cesta', quantidade: 1, componentes: [{ itemId: ARROZ, quantidadePorKit: 1 }] }]
        })

        expect(r.ok).toBe(false)
        if (r.ok) return
        const campos = r.erro.detalhes?.campos as Record<string, string>
        expect(Object.keys(campos).sort()).toEqual(['destino', 'responsavelTransporte'])
        // Nada pode ter chegado ao banco.
        expect(registrar).not.toHaveBeenCalled()
    })

    it('rejeita saída sem nenhum item', async () => {
        const r = await useCase.executar({ ...BASE, kits: [] })
        expect(r.ok).toBe(false)
        expect(registrar).not.toHaveBeenCalled()
    })

    it('expande e consolida antes de chamar o repositório', async () => {
        await useCase.executar({
            ...BASE,
            kits: [
                {
                    kitId: 'k1',
                    nome: 'Cesta',
                    quantidade: 10,
                    componentes: [
                        { itemId: ARROZ, quantidadePorKit: 2 },
                        { itemId: FEIJAO, quantidadePorKit: 1 }
                    ]
                },
                { kitId: 'k2', nome: 'Extra', quantidade: 5, componentes: [{ itemId: ARROZ, quantidadePorKit: 1 }] }
            ]
        })

        const itens = registrar.mock.calls[0][0].itens as { itemId: string; quantidade: number }[]
        // O repositório recebe a necessidade já somada — uma linha por item.
        expect(itens).toHaveLength(2)
        expect(itens.find((i) => i.itemId === ARROZ)?.quantidade).toBe(25)
        expect(itens.find((i) => i.itemId === FEIJAO)?.quantidade).toBe(10)
    })

    it('usa `avulsos` quando o tipo é avulso e ignora kits', async () => {
        await useCase.executar({
            ...BASE,
            tipo: 'avulso',
            avulsos: [
                { itemId: ARROZ, quantidade: 3 },
                { itemId: ARROZ, quantidade: 2 }
            ],
            kits: [{ kitId: 'k', nome: 'x', quantidade: 99, componentes: [{ itemId: FEIJAO, quantidadePorKit: 1 }] }]
        })

        const chamada = registrar.mock.calls[0][0]
        expect(chamada.tipo).toBe('avulso')
        expect(chamada.itens).toEqual([{ itemId: ARROZ, quantidade: 5 }])
    })

    it('remove espaços de destino e responsável', async () => {
        await useCase.executar({
            ...BASE,
            destino: '  Abrigo Central  ',
            responsavelTransporte: '  Carlos  ',
            kits: [{ kitId: 'k', nome: 'C', quantidade: 1, componentes: [{ itemId: ARROZ, quantidadePorKit: 1 }] }]
        })

        const chamada = registrar.mock.calls[0][0]
        expect(chamada.destino).toBe('Abrigo Central')
        expect(chamada.responsavelTransporte).toBe('Carlos')
    })
})

describe('RegistrarSaidaUseCase — bloqueio por déficit (BR-EST-04 cenário B)', () => {
    it('devolve erro com código e déficits nos detalhes', async () => {
        const deficits: Deficit[] = [
            { itemId: ARROZ, nome: 'Arroz 5kg', unidadeMedida: 'unidade', disponivel: 40, necessario: 50, faltam: 10 }
        ]
        const { repo } = repositorioQueBloqueia(deficits)
        const useCase = new RegistrarSaidaUseCase(repo)

        const r = await useCase.executar({
            ...BASE,
            kits: [{ kitId: 'k', nome: 'Cesta', quantidade: 25, componentes: [{ itemId: ARROZ, quantidadePorKit: 2 }] }]
        })

        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.erro.codigo).toBe('saida_bloqueada')
        expect(r.erro.detalhes?.deficits).toEqual(deficits)
    })
})

describe('mensagemDeDeficit', () => {
    const arroz: Deficit = {
        itemId: ARROZ,
        nome: 'Arroz 5kg',
        unidadeMedida: 'unidade',
        disponivel: 40,
        necessario: 50,
        faltam: 10
    }

    it('diz quanto falta e de quê, no formato do BRD §4.3', () => {
        expect(mensagemDeDeficit([arroz], 'kit')).toBe('Faltam 10 un de Arroz 5kg para montar esta quantidade de kits.')
    })

    it('omite o complemento de kit em saída avulsa', () => {
        expect(mensagemDeDeficit([arroz], 'avulso')).toBe('Faltam 10 un de Arroz 5kg.')
    })

    it('emite uma frase por item deficitário', () => {
        const feijao: Deficit = {
            itemId: FEIJAO,
            nome: 'Feijão 1kg',
            unidadeMedida: 'kg',
            disponivel: 2,
            necessario: 5,
            faltam: 3
        }
        const mensagem = mensagemDeDeficit([arroz, feijao], 'kit')
        expect(mensagem).toContain('Arroz 5kg')
        expect(mensagem).toContain('Feijão 1kg')
        expect(mensagem.match(/Faltam/g)).toHaveLength(2)
    })

    it('formata decimal em pt-BR', () => {
        const meio: Deficit = { ...arroz, unidadeMedida: 'kg', faltam: 2.5 }
        expect(mensagemDeDeficit([meio], 'avulso')).toContain('2,5 kg')
    })
})
