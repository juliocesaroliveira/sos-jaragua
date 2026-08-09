import { DomainError, ValidacaoError, falha, ok, type Result, type UseCase } from '@/src/shared/kernel'
import { ABREVIACAO_UNIDADE, type TipoSaida } from '../../domain/item'
import { formatarQuantidade } from '../../domain/quantidade'
import { consolidarAvulsos, expandirKits, type ComponenteReceita, type ItemConsolidado } from '../../domain/receita-kit'
import type { Deficit, SaidaRepository } from '../ports/estoque-repository'

export type EntradaRegistrarSaida = {
    tipo: TipoSaida
    destino: string
    responsavelTransporte: string
    registradoPor: string
    /** Itens avulsos solicitados (`tipo = 'avulso'`). */
    avulsos?: ItemConsolidado[]
    /** Kits solicitados (`tipo = 'kit'`), já com a receita carregada. */
    kits?: { kitId: string; nome: string; quantidade: number; componentes: ComponenteReceita[] }[]
}

/**
 * BR-EST-04 / DESIGN.md §9.3 — saída de itens avulsos ou de kits.
 *
 * É **uma única** Server Action com payload em lote, e não N chamadas: o Next
 * despacha Server Actions sequencialmente por cliente (DESIGN.md §8), e uma
 * saída fatiada perderia a atomicidade que a regra exige.
 *
 * A expansão da receita e a consolidação por item acontecem aqui (domínio); a
 * trava de saldo e a dedução acontecem na transação do repositório.
 */
export class RegistrarSaidaUseCase implements UseCase<EntradaRegistrarSaida, { saidaId: string }> {
    constructor(private readonly saidas: SaidaRepository) {}

    async executar(entrada: EntradaRegistrarSaida): Promise<Result<{ saidaId: string }, DomainError>> {
        const campos: Record<string, string> = {}
        if (!entrada.destino.trim()) campos.destino = 'Informe o destino.'
        if (!entrada.responsavelTransporte.trim()) {
            campos.responsavelTransporte = 'Informe o responsável pelo transporte.'
        }
        if (Object.keys(campos).length > 0) {
            return falha(new ValidacaoError('Revise os campos destacados.', { campos }))
        }

        const itens =
            entrada.tipo === 'kit'
                ? expandirKits((entrada.kits ?? []).map((k) => ({ ...k })))
                : consolidarAvulsos(entrada.avulsos ?? [])

        if (itens.length === 0) {
            return falha(
                new ValidacaoError('Adicione ao menos um item à saída.', {
                    campos: { itens: 'Nenhum item informado.' }
                })
            )
        }

        if (itens.some((i) => i.quantidade <= 0)) {
            return falha(
                new ValidacaoError('Quantidades devem ser maiores que zero.', {
                    campos: { itens: 'Quantidade inválida.' }
                })
            )
        }

        const resultado = await this.saidas.registrar({
            tipo: entrada.tipo,
            destino: entrada.destino.trim(),
            responsavelTransporte: entrada.responsavelTransporte.trim(),
            registradoPor: entrada.registradoPor,
            itens
        })

        if ('deficits' in resultado) {
            return falha(
                new DomainError('saida_bloqueada', mensagemDeDeficit(resultado.deficits, entrada.tipo), {
                    deficits: resultado.deficits
                })
            )
        }

        return ok(resultado)
    }
}

/**
 * Mensagem exigida pelo BR-EST-04 cenário B — **uma linha por item
 * deficitário**, dizendo quanto falta e de quê. Genérica demais ("estoque
 * insuficiente") obrigaria o operador a descobrir sozinho o que buscar.
 *
 * Ex.: "Faltam 10 un de Arroz 5kg para montar esta quantidade de kits."
 */
export function mensagemDeDeficit(deficits: Deficit[], tipo: TipoSaida): string {
    const complemento = tipo === 'kit' ? ' para montar esta quantidade de kits' : ''

    const linhas = deficits.map(
        (d) =>
            `Faltam ${formatarQuantidade(d.faltam)} ${ABREVIACAO_UNIDADE[d.unidadeMedida]} de ${d.nome}${complemento}.`
    )

    // Sem o prefixo "Saída bloqueada" — quem exibe já dá esse contexto (título
    // do alerta / do toast), e repetir só rouba espaço da informação útil.
    return linhas.join(' ')
}
