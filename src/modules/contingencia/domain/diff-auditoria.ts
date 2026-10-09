/**
 * Diferença antes/depois de um registro da trilha de auditoria
 * (specs/023-central-relatorios, US4, FR-021, research D9).
 *
 * Os snapshots são os objetos que `withAudit` gravou (`dadosAnteriores`,
 * `dadosNovos`). Cada valor vira texto para ser comparado e exibido:
 * aninhados como JSON curto, datas em ISO — comparar por referência diria que
 * `{ arroz: 2 }` mudou para `{ arroz: 2 }`.
 */

export type AcaoAuditoria = 'create' | 'update' | 'delete'

export type AlteracaoCampo = {
    campo: string
    antes: string | null
    depois: string | null
    tipo: 'alterado' | 'incluido' | 'removido'
}

type Snapshot = Record<string, unknown> | null | undefined

export function diferencaAuditoria(acao: AcaoAuditoria, antes: Snapshot, depois: Snapshot): AlteracaoCampo[] {
    // Criação e exclusão mostram o registro inteiro: não há "outro lado" para
    // comparar, e o que interessa é o que foi gravado ou o que deixou de existir.
    if (acao === 'create') return campos(depois).map(([campo, valor]) => incluido(campo, valor))
    if (acao === 'delete') return campos(antes).map(([campo, valor]) => removido(campo, valor))

    const nomes = [...new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})])]
    const alteracoes: AlteracaoCampo[] = []

    for (const campo of nomes) {
        const valorAntes = serializar(antes?.[campo])
        const valorDepois = serializar(depois?.[campo])
        if (valorAntes === valorDepois) continue

        if (valorAntes === null) alteracoes.push({ campo, antes: null, depois: valorDepois, tipo: 'incluido' })
        else if (valorDepois === null) alteracoes.push({ campo, antes: valorAntes, depois: null, tipo: 'removido' })
        else alteracoes.push({ campo, antes: valorAntes, depois: valorDepois, tipo: 'alterado' })
    }

    return alteracoes
}

const VAZIO = '—'

/**
 * Texto único para a coluna "Alterações" da planilha. Em criação e exclusão,
 * todos os campos são do mesmo tipo e a seta não acrescenta nada — vira só
 * `campo: valor`.
 */
export function resumoAlteracoes(alteracoes: readonly AlteracaoCampo[]): string {
    const mesmoTipo = alteracoes.length > 0 && alteracoes.every((a) => a.tipo === alteracoes[0].tipo)
    const registroInteiro = mesmoTipo && alteracoes[0].tipo !== 'alterado'

    return alteracoes
        .map(({ campo, antes, depois }) =>
            registroInteiro
                ? `${campo}: ${depois ?? antes ?? VAZIO}`
                : `${campo}: ${antes ?? VAZIO} → ${depois ?? VAZIO}`
        )
        .join('; ')
}

function campos(snapshot: Snapshot): [string, unknown][] {
    return Object.entries(snapshot ?? {}).filter(([, valor]) => serializar(valor) !== null)
}

function incluido(campo: string, valor: unknown): AlteracaoCampo {
    return { campo, antes: null, depois: serializar(valor), tipo: 'incluido' }
}

function removido(campo: string, valor: unknown): AlteracaoCampo {
    return { campo, antes: serializar(valor), depois: null, tipo: 'removido' }
}

/** `null` e ausente são o mesmo valor — nenhum dos dois é uma alteração. */
function serializar(valor: unknown): string | null {
    if (valor === null || valor === undefined) return null
    if (valor instanceof Date) return valor.toISOString()
    if (typeof valor === 'string') return valor
    if (typeof valor === 'number' || typeof valor === 'boolean' || typeof valor === 'bigint') return String(valor)
    return JSON.stringify(valor)
}
