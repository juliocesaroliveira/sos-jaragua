import { colecaoAuditoria, NOME_COLECAO } from '@/src/shared/db/mongo/audit-logs'
import { clienteMongo } from '@/src/shared/db/mongo/client'
import { redigirCamposSensiveis } from '@/src/modules/auditoria/redacao'
import { validarChave } from '@/src/shared/cripto'

/**
 * Remediação **única** da trilha de auditoria (feature 024, FR-027).
 *
 *     npx tsx --env-file=.env.local scripts/remediar-auditoria.ts
 *
 * **Por que existe**: `withAudit` grava o snapshot inteiro do registro alterado,
 * então a trilha acumulada contém `cpf`, `cep` e `data_nascimento` em texto
 * plano. Cifrar apenas o Postgres deixaria a auditoria como cópia legível dos
 * mesmos dados, e a anonimização a pedido do titular (FR-022) ficaria
 * incompleta.
 *
 * **Esta é a única alteração admitida em registro já gravado.** O Princípio V da
 * Constituição (v1.1.0) a inscreve como exceção única e documentada à
 * imutabilidade da trilha; qualquer outra exige nova emenda. Daqui para frente a
 * redação acontece na escrita (FR-026), então nenhum pedido futuro de eliminação
 * precisará tocar a trilha.
 *
 * **Idempotente**: redigir um snapshot já redigido não muda nada, porque a marca
 * de mudança não casa com nenhum campo sensível em claro. Pode ser re-executado.
 */

/** Tabelas cujos snapshots carregam campo sensível. */
const TABELAS_AFETADAS = ['voluntario_perfil', 'user']

async function principal(): Promise<void> {
    validarChave()

    const colecao = colecaoAuditoria()

    const cursor = colecao.find({ tabela: { $in: TABELAS_AFETADAS } })
    let examinados = 0
    let remediados = 0

    for await (const doc of cursor) {
        examinados++

        const anteriores = redigirCamposSensiveis(doc.dadosAnteriores)
        const novos = redigirCamposSensiveis(doc.dadosNovos)

        // Só escreve quando a redação mudou algo — mantém a operação idempotente
        // e evita reescrever a coleção inteira a cada execução.
        const mudou =
            JSON.stringify(anteriores) !== JSON.stringify(doc.dadosAnteriores) ||
            JSON.stringify(novos) !== JSON.stringify(doc.dadosNovos)

        if (!mudou) continue

        await colecao.updateOne(
            { _id: doc._id },
            { $set: { dadosAnteriores: anteriores, dadosNovos: novos } }
        )
        remediados++
    }

    console.log(`[remediar] ${NOME_COLECAO}: ${examinados} examinados, ${remediados} remediados`)

    // A própria remediação é registrada, como o Princípio V exige: a exceção à
    // imutabilidade precisa deixar rastro de que ocorreu, quando e com que
    // alcance.
    await colecao.insertOne({
        timestamp: new Date(),
        entidade: 'Voluntario',
        entidadeId: 'remediacao-lgpd-024',
        acao: 'update',
        userId: 'sistema',
        userRole: 'sistema',
        tabela: NOME_COLECAO,
        dadosAnteriores: null,
        dadosNovos: {
            motivo: 'Remediação única da trilha (feature 024, FR-027): campos sensíveis redigidos.',
            tabelasAfetadas: TABELAS_AFETADAS,
            examinados,
            remediados
        }
    })

    console.log('[remediar] evento de remediação registrado na própria trilha')
}

principal()
    .then(async () => {
        await clienteMongo().close()
        process.exit(0)
    })
    .catch(async (erro: unknown) => {
        console.error('[remediar] FALHOU', erro)
        await clienteMongo().close().catch(() => undefined)
        process.exit(1)
    })
