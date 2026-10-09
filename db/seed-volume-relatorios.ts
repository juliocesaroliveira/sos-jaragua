/**
 * Carga de volume para a central de relatórios (specs/023-central-relatorios,
 * quickstart.md §3, SC-002/SC-004).
 *
 * Executar com:
 * - `npm run db:seed:volume`            → insere ~60.000 linhas de saída
 * - `npm run db:seed:volume -- --limpar` → remove só o que este script criou
 *
 * **Só para o banco de desenvolvimento.** As saídas não deduzem saldo — é carga
 * para medir prévia e exportação, não operação real. Tudo o que o script cria
 * leva o marcador `[carga-023]` (no nome dos itens, no destino das saídas e no
 * e-mail do operador), e `--limpar` apaga exatamente isso.
 *
 * As datas caem nos últimos 30 dias — o período padrão dos relatórios —, para
 * a prévia de "Histórico de saídas" já abrir com o volume.
 *
 * Imports relativos, como `db/seed.ts`: roda fora do bundler do Next, via `tsx`.
 */
import { randomUUID } from 'node:crypto'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { inArray, like } from 'drizzle-orm'
import { user } from './schema/identidade'
import { item, saida, saidaItem, saldoEstoque } from './schema/estoque'

if (typeof WebSocket !== 'undefined') {
    neonConfig.webSocketConstructor = WebSocket
}

const MARCADOR = '[carga-023]'
const ITENS = 20
const SAIDAS = 20_000
const ITENS_POR_SAIDA = 3 // 20.000 × 3 = 60.000 linhas — acima do teto de 50.000 de propósito
const LOTE = 1_000
const DESTINOS = ['Abrigo Central', 'Escola Municipal', 'Bairro Vila Nova', 'Ginásio', 'Igreja Matriz']
const UM_DIA_MS = 86_400_000

async function main() {
    const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL_UNPOOLED/DATABASE_URL ausente no ambiente.')

    const pool = new Pool({ connectionString: url })
    const db = drizzle({ client: pool, casing: 'snake_case' })

    try {
        if (process.argv.includes('--limpar')) {
            await limpar(db)
            return
        }
        await carregar(db)
    } finally {
        await pool.end()
    }
}

type Db = ReturnType<typeof drizzle>

async function carregar(db: Db) {
    const operador = randomUUID()
    await db.insert(user).values({
        id: operador,
        name: `Operador ${MARCADOR}`,
        email: `carga-023-${operador.slice(0, 8)}@exemplo.test`,
        emailVerified: true,
        role: 'membro_defesa_civil'
    })

    const itens = await db
        .insert(item)
        .values(
            Array.from({ length: ITENS }, (_, i) => ({
                nome: `${MARCADOR} Item ${String(i + 1).padStart(2, '0')}`,
                categoria: 'alimentacao' as const,
                unidadeMedida: 'kg' as const
            }))
        )
        .returning({ id: item.id })
    await db.insert(saldoEstoque).values(itens.map((i) => ({ itemId: i.id, quantidadeAtual: '0' })))

    const agora = Date.now()
    for (let inicio = 0; inicio < SAIDAS; inicio += LOTE) {
        const tamanho = Math.min(LOTE, SAIDAS - inicio)
        const saidas = await db
            .insert(saida)
            .values(
                Array.from({ length: tamanho }, (_, k) => {
                    const n = inicio + k
                    return {
                        tipo: n % 4 === 0 ? ('kit' as const) : ('avulso' as const),
                        destino: `${MARCADOR} ${DESTINOS[n % DESTINOS.length]}`,
                        responsavelTransporte: 'Carga de teste',
                        registradoPor: operador,
                        // Espalhadas nos últimos 29 dias, dentro do período padrão.
                        criadoEm: new Date(agora - (n % 29) * UM_DIA_MS - (n % 1_440) * 60_000)
                    }
                })
            )
            .returning({ id: saida.id })

        await db.insert(saidaItem).values(
            saidas.flatMap((s, k) =>
                Array.from({ length: ITENS_POR_SAIDA }, (_, j) => ({
                    saidaId: s.id,
                    itemId: itens[(inicio + k + j) % ITENS].id,
                    quantidade: (1 + ((inicio + k + j) % 7)).toFixed(3)
                }))
            )
        )
        console.log(`· ${inicio + tamanho}/${SAIDAS} saídas`)
    }

    console.log(`✓ ${SAIDAS * ITENS_POR_SAIDA} linhas de saída criadas (marcador ${MARCADOR})`)
}

async function limpar(db: Db) {
    // `saida_item` sai em cascata com a `saida`.
    const removidasSaidas = await db
        .delete(saida)
        .where(like(saida.destino, `${MARCADOR}%`))
        .returning({ id: saida.id })
    const itens = await db
        .select({ id: item.id })
        .from(item)
        .where(like(item.nome, `${MARCADOR}%`))
    if (itens.length > 0) {
        const ids = itens.map((i) => i.id)
        await db.delete(saldoEstoque).where(inArray(saldoEstoque.itemId, ids))
        await db.delete(item).where(inArray(item.id, ids))
    }
    await db.delete(user).where(like(user.email, 'carga-023-%@exemplo.test'))
    console.log(`✓ removidas ${removidasSaidas.length} saídas e ${itens.length} itens de carga`)
}

main().catch((erro) => {
    console.error(erro)
    process.exit(1)
})
