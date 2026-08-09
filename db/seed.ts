/**
 * Seed de dados iniciais (DB_SCHEMA.md §14).
 *
 * Executar com: `npm run db:seed`
 *
 * Idempotente: pode rodar quantas vezes for necessário. Insere as tabelas
 * lookup livres (`habilidade`, `atividade_categoria`) e, se as variáveis
 * `ADMIN_EMAIL`/`ADMIN_PASSWORD` estiverem presentes, cria o usuário
 * `administrador` de bootstrap — fora do fluxo de candidatura pública.
 *
 * Usa imports relativos (e não o alias `@/`) porque roda fora do bundler do
 * Next, via `tsx`.
 */
import { randomUUID } from 'node:crypto'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { eq } from 'drizzle-orm'
import { hashPassword } from 'better-auth/crypto'
import { account, user } from './schema/identidade'
import { atividadeCategoria, habilidade } from './schema/voluntariado'

if (typeof WebSocket !== 'undefined') {
    neonConfig.webSocketConstructor = WebSocket
}

const HABILIDADES_INICIAIS = ['Motosserra', 'CNH D/E', 'Embarcação', 'Primeiros Socorros']
const CATEGORIAS_INICIAIS = ['Separação de itens', 'Montagem de kits', 'Apoio logístico']

async function main() {
    const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL_UNPOOLED/DATABASE_URL ausente no ambiente.')

    const pool = new Pool({ connectionString: url })
    const db = drizzle({ client: pool, casing: 'snake_case' })

    try {
        for (const nome of HABILIDADES_INICIAIS) {
            await db.insert(habilidade).values({ nome }).onConflictDoNothing()
        }
        console.log(`✓ habilidades: ${HABILIDADES_INICIAIS.length} garantidas`)

        for (const nome of CATEGORIAS_INICIAIS) {
            await db.insert(atividadeCategoria).values({ nome }).onConflictDoNothing()
        }
        console.log(`✓ categorias de atividade: ${CATEGORIAS_INICIAIS.length} garantidas`)

        await garantirAdministrador(db)
    } finally {
        await pool.end()
    }
}

async function garantirAdministrador(db: ReturnType<typeof drizzle>) {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
    const senha = process.env.ADMIN_PASSWORD
    const nome = process.env.ADMIN_NAME?.trim() || 'Administrador'

    if (!email || !senha) {
        console.log('· ADMIN_EMAIL/ADMIN_PASSWORD não definidos — bootstrap de administrador ignorado.')
        return
    }
    if (senha.length < 8) throw new Error('ADMIN_PASSWORD precisa ter ao menos 8 caracteres.')

    const [existente] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
    if (existente) {
        await db.update(user).set({ role: 'administrador', ativo: true }).where(eq(user.id, existente.id))
        console.log(`✓ administrador já existia (${email}) — role reafirmada`)
        return
    }

    const userId = randomUUID()
    await db.insert(user).values({
        id: userId,
        name: nome,
        email,
        emailVerified: true,
        role: 'administrador',
        ativo: true
    })

    // Provider `credential` é o que o better-auth usa para e-mail/senha; o hash
    // vem da própria biblioteca para que o login funcione sem divergência.
    await db.insert(account).values({
        id: randomUUID(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: await hashPassword(senha)
    })

    console.log(`✓ administrador criado: ${email}`)
}

await main()
