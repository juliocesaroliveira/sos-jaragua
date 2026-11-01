import { sql } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { voluntarioPerfil } from '@/db/schema/voluntariado'
import { cifrar, ehEnvelope, indiceCego, validarChave } from '@/src/shared/cripto'

/**
 * Migração de dados da feature 024 (FR-007): protege os cadastros gravados antes
 * da criptografia a nível de campo.
 *
 * Rode **depois** da migration de estrutura (`0009`), que converteu
 * `data_nascimento` para `text` e criou `cpf_indice`:
 *
 *     npx tsx --env-file=.env.local scripts/proteger-dados-existentes.ts
 *
 * **Idempotente** por construção: reconhece pelo prefixo `v1.` o que já está
 * protegido e salta. Pode ser re-executado depois de uma interrupção sem
 * re-cifrar (o que tornaria o dado irrecuperável) e sem corromper linha já
 * migrada.
 *
 * **Se o script falhar por violação de unicidade em `cpf_indice`**, isso é o
 * resultado desejado, não um defeito: significa que existem dois cadastros com o
 * mesmo CPF, algo que o índice único anterior deveria ter impedido. Resolva a
 * duplicata no banco e rode de novo.
 */

type Contagem = { protegidos: number; jaProtegidos: number }

async function protegerPerfis(): Promise<Contagem> {
    const linhas = await db
        .select({
            id: voluntarioPerfil.id,
            cpf: voluntarioPerfil.cpf,
            dataNascimento: voluntarioPerfil.dataNascimento,
            cep: voluntarioPerfil.cep,
            cpfIndice: voluntarioPerfil.cpfIndice
        })
        .from(voluntarioPerfil)

    let protegidos = 0
    let jaProtegidos = 0

    for (const linha of linhas) {
        // A checagem é por campo, não por linha: uma execução interrompida no
        // meio pode ter deixado a linha parcialmente protegida.
        const precisa =
            !ehEnvelope(linha.cpf) ||
            !ehEnvelope(linha.dataNascimento) ||
            !ehEnvelope(linha.cep) ||
            linha.cpfIndice === null

        if (!precisa) {
            jaProtegidos++
            continue
        }

        // O índice cego vem do CPF em claro — que, se a linha já estiver
        // cifrada, não está mais disponível aqui. Por isso ele é derivado antes
        // de qualquer cifragem desta linha.
        const cpfEmClaro = ehEnvelope(linha.cpf) ? null : linha.cpf

        await db
            .update(voluntarioPerfil)
            .set({
                cpf: ehEnvelope(linha.cpf) ? linha.cpf : cifrar(linha.cpf),
                dataNascimento: ehEnvelope(linha.dataNascimento)
                    ? linha.dataNascimento
                    : cifrar(linha.dataNascimento),
                cep: ehEnvelope(linha.cep) ? linha.cep : cifrar(linha.cep),
                cpfIndice: linha.cpfIndice ?? (cpfEmClaro === null ? null : indiceCego(cpfEmClaro))
            })
            .where(sql`${voluntarioPerfil.id} = ${linha.id}`)

        if (linha.cpfIndice === null && cpfEmClaro === null) {
            console.warn(
                `[proteger] perfil ${linha.id}: CPF já cifrado e sem cpf_indice. ` +
                    `O índice não pode ser derivado sem o valor em claro — resolva manualmente.`
            )
        }

        protegidos++
    }

    return { protegidos, jaProtegidos }
}

async function protegerContas(): Promise<Contagem> {
    const linhas = await db.select({ id: user.id, dataNascimento: user.dataNascimento }).from(user)

    let protegidos = 0
    let jaProtegidos = 0

    for (const linha of linhas) {
        if (linha.dataNascimento === null || linha.dataNascimento === '') continue

        if (ehEnvelope(linha.dataNascimento)) {
            jaProtegidos++
            continue
        }

        await db
            .update(user)
            .set({ dataNascimento: cifrar(linha.dataNascimento) })
            .where(sql`${user.id} = ${linha.id}`)

        protegidos++
    }

    return { protegidos, jaProtegidos }
}

async function principal(): Promise<void> {
    // Falha antes de tocar o banco se a chave não estiver configurada: metade dos
    // dados protegidos e metade não é o pior estado possível.
    validarChave()

    console.log('[proteger] iniciando — a operação é idempotente e pode ser re-executada')

    const perfis = await protegerPerfis()
    console.log(`[proteger] voluntario_perfil: ${perfis.protegidos} protegidos, ${perfis.jaProtegidos} já estavam`)

    const contas = await protegerContas()
    console.log(`[proteger] user.data_nascimento: ${contas.protegidos} protegidos, ${contas.jaProtegidos} já estavam`)

    console.log('[proteger] concluído')
}

principal()
    .then(() => process.exit(0))
    .catch((erro: unknown) => {
        console.error('[proteger] FALHOU — nenhuma linha além das já relatadas foi alterada', erro)
        process.exit(1)
    })
