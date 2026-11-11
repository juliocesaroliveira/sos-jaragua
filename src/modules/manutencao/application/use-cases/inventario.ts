import { CATALOGO, ROTULO_AREA, type Area, type Catalogo } from '../../domain/catalogo'
import { conferirCatalogo } from '../../domain/conferir-catalogo'
import { tabelasAlcancaveis } from '../../domain/grafo'
import type { LeitorEsquema } from '../ports/leitor-esquema'

export type LinhaInventario = {
    nome: string
    rotulo: string
    area: Area
    rotuloArea: string
    registros: number
    registrosSistema: number
    /** Rótulos das tabelas que dependem desta. */
    dependentes: string[]
    /** Rótulos das tabelas de que esta depende. */
    dependeDe: string[]
    disponivel: boolean
    motivoIndisponivel?: string
}

/**
 * Inventário das tabelas (C-01, FR-004, FR-005).
 *
 * Uma tabela fica indisponível quando está vazia ou quando qualquer tabela que
 * uma ação sobre ela pode atingir tem vínculo não classificado (FR-013a) — a
 * mesma regra que a prévia aplica, para o botão não prometer o que a prévia
 * vai recusar.
 */
export class InventarioUseCase {
    private readonly catalogo: Catalogo

    constructor(private readonly deps: { leitor: LeitorEsquema; catalogo?: Catalogo }) {
        this.catalogo = deps.catalogo ?? CATALOGO
    }

    async executar(): Promise<LinhaInventario[]> {
        const [fks, contagens] = await Promise.all([
            this.deps.leitor.fksFisicas(),
            this.deps.leitor.contagens(this.catalogo.tabelas.map((t) => t.nome))
        ])
        const { tabelasBloqueadas } = conferirCatalogo(this.catalogo, fks)
        const rotulo = (nome: string) => this.catalogo.tabelas.find((t) => t.nome === nome)?.rotulo ?? nome
        const unicos = (lista: string[]) => [...new Set(lista)]

        return this.catalogo.tabelas.map((t) => {
            const registros = contagens[t.nome]?.registros ?? 0
            const bloqueios = unicos(
                tabelasAlcancaveis(t.nome, this.catalogo.vinculos).flatMap((x) => tabelasBloqueadas.get(x) ?? [])
            )
            const motivoIndisponivel =
                bloqueios.length > 0
                    ? `Vínculo não classificado: ${bloqueios.join(', ')}`
                    : registros === 0
                      ? 'Sem registros'
                      : undefined

            return {
                nome: t.nome,
                rotulo: t.rotulo,
                area: t.area,
                rotuloArea: ROTULO_AREA[t.area],
                registros,
                registrosSistema: contagens[t.nome]?.registrosSistema ?? 0,
                dependentes: unicos(
                    this.catalogo.vinculos
                        .filter((v) => v.pai === t.nome && v.filho !== t.nome)
                        .map((v) => rotulo(v.filho))
                ),
                dependeDe: unicos(
                    this.catalogo.vinculos
                        .filter((v) => v.filho === t.nome && v.pai !== t.nome)
                        .map((v) => rotulo(v.pai))
                ),
                disponivel: motivoIndisponivel === undefined,
                ...(motivoIndisponivel ? { motivoIndisponivel } : {})
            }
        })
    }
}
