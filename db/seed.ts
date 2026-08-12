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
 * Opcionalmente cria uma conta por perfil de acesso para validação manual
 * (`SEED_TESTE_PASSWORD`) — ver `garantirContasDeTeste`.
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

/** Derivado do próprio schema — não repete a lista de roles. */
type RoleDb = NonNullable<(typeof user.$inferInsert)['role']>

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
        await garantirContasDeTeste(db)
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

    const criado = await garantirUsuario(db, { email, nome, senha, role: 'administrador' })
    console.log(criado ? `✓ administrador criado: ${email}` : `✓ administrador já existia (${email}) — role reafirmada`)
}

const CONTAS_DE_TESTE: ReadonlyArray<{ role: RoleDb; nome: string }> = [
    { role: 'usuario', nome: 'Usuário de Teste' },
    { role: 'voluntario', nome: 'Voluntário de Teste' },
    { role: 'membro_defesa_civil', nome: 'Defesa Civil de Teste' },
    { role: 'coordenador', nome: 'Coordenador de Teste' },
    { role: 'administrador', nome: 'Administrador de Teste' }
]

/**
 * Uma conta por perfil de acesso, para validação manual da matriz de
 * navegação (specs/002-role-based-app-shell/quickstart.md).
 *
 * **Opt-in explícito**: só roda com `SEED_TESTE_PASSWORD` definido, e nunca em
 * produção — são contas de senha conhecida, incluindo uma `administrador`.
 * Criá-las por omissão seria plantar credenciais previsíveis num sistema que
 * coordena resposta a desastres.
 */
async function garantirContasDeTeste(db: ReturnType<typeof drizzle>) {
    const senha = process.env.SEED_TESTE_PASSWORD
    if (!senha) {
        console.log('· SEED_TESTE_PASSWORD não definido — contas de teste por perfil ignoradas.')
        return
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('SEED_TESTE_PASSWORD não pode ser usado com NODE_ENV=production.')
    }
    if (senha.length < 8) throw new Error('SEED_TESTE_PASSWORD precisa ter ao menos 8 caracteres.')

    for (const { role, nome } of CONTAS_DE_TESTE) {
        const email = `${role.replace(/_/g, '-')}@teste.local`
        const criado = await garantirUsuario(db, { email, nome, senha, role })
        console.log(`  ${criado ? '+' : '·'} ${email} (${role})`)
    }
    console.log(`✓ contas de teste: ${CONTAS_DE_TESTE.length} garantidas`)
}

/**
 * Cria o usuário com credencial de e-mail/senha, ou reafirma `role`/`ativo` se
 * já existir. Retorna `true` quando criou. Idempotente.
 */
async function garantirUsuario(
    db: ReturnType<typeof drizzle>,
    dados: { email: string; nome: string; senha: string; role: RoleDb }
): Promise<boolean> {
    const [existente] = await db.select({ id: user.id }).from(user).where(eq(user.email, dados.email)).limit(1)
    if (existente) {
        await db.update(user).set({ role: dados.role, ativo: true }).where(eq(user.id, existente.id))
        return false
    }

    const userId = randomUUID()
    await db.insert(user).values({
        id: userId,
        name: dados.nome,
        email: dados.email,
        emailVerified: true,
        role: dados.role,
        ativo: true
    })

    // Provider `credential` é o que o better-auth usa para e-mail/senha; o hash
    // vem da própria biblioteca para que o login funcione sem divergência.
    await db.insert(account).values({
        id: randomUUID(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: await hashPassword(dados.senha)
    })

    return true
}

await main()
