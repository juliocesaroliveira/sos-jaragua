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
 * Opcionalmente cria o elenco de teste — 5 `usuario`, 2 `voluntario`,
 * 2 `coordenador`, 1 `membro_defesa_civil`, com as tabelas relacionadas
 * preenchidas (`SEED_TESTE_PASSWORD`) — ver `garantirContasDeTeste`.
 *
 * Usa imports relativos (e não o alias `@/`) porque roda fora do bundler do
 * Next, via `tsx`. Os módulos de `domain` são puros e sem alias, então dá para
 * importá-los aqui e validar o que o seed gera com as **mesmas** regras que a
 * aplicação aplica.
 */
import { randomUUID } from 'node:crypto'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { eq } from 'drizzle-orm'
import { hashPassword } from 'better-auth/crypto'
import { account, user } from './schema/identidade'
import {
    alocacao,
    atividade,
    atividadeCategoria,
    habilidade,
    turno,
    voluntarioHabilidade,
    voluntarioPerfil
} from './schema/voluntariado'
import { cepEhValido, cpfEhValido, ehMaiorDeIdade, telefoneEhValido } from '../src/modules/identidade/domain'

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

    const { criado } = await garantirUsuario(db, { email, nome, senha, role: 'administrador' })
    console.log(criado ? `✓ administrador criado: ${email}` : `✓ administrador já existia (${email}) — role reafirmada`)
}

type EspecPerfil = {
    /** 9 primeiros dígitos do CPF; os 2 verificadores são calculados. */
    baseCpf: string
    dataNascimento: string
    telefone: string
    cep: string
    bairro: string
    profissao: string
    restricoesSaude?: string
    veiculoProprio: boolean
    tipoVeiculo?: 'carro' | 'caminhonete' | 'moto' | 'barco'
    disponibilidade: Array<'integral' | 'manha' | 'tarde' | 'noite' | 'fim_de_semana'>
    habilidades: string[]
    status: 'pendente' | 'aprovado' | 'rejeitado'
    motivoRejeicao?: string
}

type EspecConta = {
    email: string
    nome: string
    role: RoleDb
    /** Ausente para staff: `voluntario_perfil` é extensão de quem se candidata. */
    perfil?: EspecPerfil
}

/**
 * Elenco de teste (specs/002-role-based-app-shell/quickstart.md): 5 `usuario`,
 * 2 `voluntario`, 2 `coordenador`, 1 `membro_defesa_civil`.
 *
 * As contas com candidatura carregam `voluntario_perfil` **e**
 * `voluntario_habilidade` preenchidos, cobrindo os três estados de triagem
 * (`pendente`, `aprovado`, `rejeitado`) — é o que faz as telas de Cadastros
 * Pendentes e Voluntários terem conteúdo real para validar.
 *
 * `administrador` não entra aqui: já vem do bootstrap `ADMIN_EMAIL`.
 */
const CONTAS_DE_TESTE: readonly EspecConta[] = [
    // -- 5 usuários: candidaturas em triagem (4 pendentes, 1 rejeitada) -------
    {
        email: 'usuario1@teste.local',
        nome: 'Ana Beatriz Ramos',
        role: 'usuario',
        perfil: {
            baseCpf: '111444777',
            dataNascimento: '1995-03-14',
            telefone: '47991230001',
            cep: '89250000',
            bairro: 'Centro',
            profissao: 'Enfermeira',
            veiculoProprio: true,
            tipoVeiculo: 'carro',
            disponibilidade: ['manha', 'fim_de_semana'],
            habilidades: ['Primeiros Socorros'],
            status: 'pendente'
        }
    },
    {
        email: 'usuario2@teste.local',
        nome: 'Carlos Eduardo Lima',
        role: 'usuario',
        perfil: {
            baseCpf: '222555888',
            dataNascimento: '1988-07-02',
            telefone: '47991230002',
            cep: '89251000',
            bairro: 'Vila Nova',
            profissao: 'Motorista',
            veiculoProprio: true,
            tipoVeiculo: 'caminhonete',
            disponibilidade: ['integral'],
            habilidades: ['CNH D/E', 'Motosserra'],
            status: 'pendente'
        }
    },
    {
        email: 'usuario3@teste.local',
        nome: 'Daniela Souza Prado',
        role: 'usuario',
        perfil: {
            baseCpf: '333666999',
            dataNascimento: '2000-11-23',
            telefone: '47991230003',
            cep: '89252000',
            bairro: 'Jaraguá Esquerdo',
            profissao: 'Estudante',
            restricoesSaude: 'Asma leve — evitar esforço prolongado.',
            veiculoProprio: false,
            disponibilidade: ['tarde', 'noite'],
            habilidades: [],
            status: 'pendente'
        }
    },
    {
        email: 'usuario4@teste.local',
        nome: 'Eduardo Nunes Farias',
        role: 'usuario',
        perfil: {
            baseCpf: '444777000',
            dataNascimento: '1979-01-09',
            telefone: '4733220004',
            cep: '89253000',
            bairro: 'Barra do Rio Cerro',
            profissao: 'Pedreiro',
            veiculoProprio: false,
            disponibilidade: ['fim_de_semana'],
            habilidades: ['Motosserra'],
            status: 'pendente'
        }
    },
    {
        email: 'usuario5@teste.local',
        nome: 'Fernanda Alves Rocha',
        role: 'usuario',
        perfil: {
            baseCpf: '555888111',
            dataNascimento: '1992-05-30',
            telefone: '47991230005',
            cep: '89254000',
            bairro: 'Nova Brasília',
            profissao: 'Administradora',
            veiculoProprio: false,
            disponibilidade: ['noite'],
            habilidades: [],
            status: 'rejeitado',
            motivoRejeicao: 'Dados de contato não confirmados na triagem.'
        }
    },

    // -- 2 voluntários aprovados, com habilidades e escala --------------------
    {
        email: 'voluntario1@teste.local',
        nome: 'Gabriel Martins Cardoso',
        role: 'voluntario',
        perfil: {
            baseCpf: '666999222',
            dataNascimento: '1990-09-17',
            telefone: '47991230006',
            cep: '89255000',
            bairro: 'Ilha da Figueira',
            profissao: 'Técnico em edificações',
            veiculoProprio: true,
            tipoVeiculo: 'moto',
            disponibilidade: ['integral'],
            habilidades: ['Primeiros Socorros', 'Motosserra'],
            status: 'aprovado'
        }
    },
    {
        email: 'voluntario2@teste.local',
        nome: 'Helena Ribeiro Krause',
        role: 'voluntario',
        perfil: {
            baseCpf: '777000333',
            dataNascimento: '1985-12-05',
            telefone: '47991230007',
            cep: '89256000',
            bairro: 'Água Verde',
            profissao: 'Logística',
            veiculoProprio: true,
            tipoVeiculo: 'barco',
            disponibilidade: ['manha', 'tarde'],
            habilidades: ['Embarcação', 'CNH D/E'],
            status: 'aprovado'
        }
    },

    // -- Staff: sem `voluntario_perfil` --------------------------------------
    { email: 'coordenador1@teste.local', nome: 'Isabela Duarte Fischer', role: 'coordenador' },
    { email: 'coordenador2@teste.local', nome: 'João Pedro Bertoldi', role: 'coordenador' },
    { email: 'defesa-civil1@teste.local', nome: 'Karina Lopes Menegotti', role: 'membro_defesa_civil' }
]

/**
 * Elenco de teste completo, com as tabelas relacionadas preenchidas.
 *
 * **Opt-in explícito**: só roda com `SEED_TESTE_PASSWORD` definido, e nunca em
 * produção — são contas de senha conhecida, incluindo duas de coordenação.
 * Criá-las por omissão seria plantar credenciais previsíveis num sistema que
 * coordena resposta a desastres.
 */
async function garantirContasDeTeste(db: ReturnType<typeof drizzle>) {
    const senha = process.env.SEED_TESTE_PASSWORD
    if (!senha) {
        console.log('· SEED_TESTE_PASSWORD não definido — elenco de teste ignorado.')
        return
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('SEED_TESTE_PASSWORD não pode ser usado com NODE_ENV=production.')
    }
    if (senha.length < 8) throw new Error('SEED_TESTE_PASSWORD precisa ter ao menos 8 caracteres.')

    validarElenco()

    const idsPorEmail = new Map<string, string>()

    for (const conta of CONTAS_DE_TESTE) {
        const { criado, userId } = await garantirUsuario(db, {
            email: conta.email,
            nome: conta.nome,
            senha,
            role: conta.role
        })
        idsPorEmail.set(conta.email, userId)
        console.log(`  ${criado ? '+' : '·'} ${conta.email} (${conta.role})`)
    }

    // A aprovação precisa de um ator: quem aprovou aparece em
    // `voluntario_perfil.aprovadoPor` e na tela de Voluntários.
    const aprovadorId = idsPorEmail.get('coordenador1@teste.local')
    if (!aprovadorId) throw new Error('Coordenador de teste ausente — não é possível registrar aprovações.')

    const habilidadesPorNome = await mapearPorNome(db, habilidade)

    let perfis = 0
    const perfisPorEmail = new Map<string, string>()
    for (const conta of CONTAS_DE_TESTE) {
        if (!conta.perfil) continue
        const userId = idsPorEmail.get(conta.email)
        if (!userId) continue

        const perfilId = await garantirPerfilVoluntario(db, {
            userId,
            nomeCompleto: conta.nome,
            perfil: conta.perfil,
            aprovadorId,
            habilidadesPorNome
        })
        perfisPorEmail.set(conta.email, perfilId)
        perfis++
    }
    console.log(`✓ perfis de voluntário: ${perfis} garantidos (com habilidades)`)

    await garantirEscalaDeTeste(db, {
        criadoPor: aprovadorId,
        perfisAprovados: CONTAS_DE_TESTE.filter((c) => c.perfil?.status === 'aprovado')
            .map((c) => perfisPorEmail.get(c.email))
            .filter((id): id is string => id !== undefined)
    })

    console.log(`✓ elenco de teste: ${CONTAS_DE_TESTE.length} contas garantidas`)
}

/**
 * Confere o elenco contra as regras de `domain` **antes** de gravar.
 *
 * O banco aceitaria CPF inválido ou menor de idade sem reclamar — a validação
 * mora no domínio (DESIGN.md §10.1). Sem esta checagem, um dígito trocado numa
 * base de CPF só apareceria quando alguém abrisse a triagem e a aplicação
 * recusasse a própria linha semeada.
 */
function validarElenco() {
    const cpfsVistos = new Set<string>()
    const emailsVistos = new Set<string>()

    for (const conta of CONTAS_DE_TESTE) {
        if (emailsVistos.has(conta.email)) throw new Error(`E-mail repetido no elenco: ${conta.email}`)
        emailsVistos.add(conta.email)

        const p = conta.perfil
        if (!p) continue

        const cpf = completarCpf(p.baseCpf)
        if (!cpfEhValido(cpf)) throw new Error(`CPF gerado inválido para ${conta.email}: ${cpf}`)
        if (cpfsVistos.has(cpf)) throw new Error(`CPF repetido no elenco: ${cpf} (${conta.email})`)
        cpfsVistos.add(cpf)

        if (!ehMaiorDeIdade(p.dataNascimento)) {
            throw new Error(`${conta.email} é menor de idade — candidatura seria recusada.`)
        }
        if (!telefoneEhValido(p.telefone)) throw new Error(`Telefone inválido para ${conta.email}: ${p.telefone}`)
        if (!cepEhValido(p.cep)) throw new Error(`CEP inválido para ${conta.email}: ${p.cep}`)
        if (p.veiculoProprio && !p.tipoVeiculo) {
            throw new Error(`${conta.email} declara veículo próprio sem informar o tipo.`)
        }
        if (p.status === 'rejeitado' && !p.motivoRejeicao) {
            throw new Error(`${conta.email} está rejeitado sem motivo registrado.`)
        }
    }
}

/**
 * Completa um CPF de 9 dígitos com os dois verificadores.
 *
 * O banco não valida CPF — a regra vive no `domain` (DESIGN.md §10.1). Gerar
 * documentos com dígito correto é o que impede o seed de produzir linhas que a
 * própria aplicação rejeitaria ao editar. `main` confere cada um contra
 * `cpfEhValido` antes de gravar.
 */
function completarCpf(base9: string): string {
    if (!/^\d{9}$/.test(base9)) throw new Error(`Base de CPF inválida: ${base9}`)

    const digito = (digitos: string): number => {
        let soma = 0
        let peso = digitos.length + 1
        for (const d of digitos) soma += Number(d) * peso--
        const resto = (soma * 10) % 11
        return resto === 10 || resto === 11 ? 0 : resto
    }

    const d1 = digito(base9)
    const d2 = digito(`${base9}${d1}`)
    return `${base9}${d1}${d2}`
}

/** `nome -> id` de uma tabela lookup, para resolver referências por nome. */
async function mapearPorNome(
    db: ReturnType<typeof drizzle>,
    tabela: typeof habilidade | typeof atividadeCategoria
): Promise<Map<string, string>> {
    const linhas = await db.select({ id: tabela.id, nome: tabela.nome }).from(tabela)
    return new Map(linhas.map((l) => [l.nome, l.id]))
}

/**
 * `voluntario_perfil` + `voluntario_habilidade` para uma conta de teste.
 * Idempotente pelo `userId`, que é único na tabela.
 */
async function garantirPerfilVoluntario(
    db: ReturnType<typeof drizzle>,
    args: {
        userId: string
        nomeCompleto: string
        perfil: EspecPerfil
        aprovadorId: string
        habilidadesPorNome: Map<string, string>
    }
): Promise<string> {
    const { userId, nomeCompleto, perfil, aprovadorId, habilidadesPorNome } = args

    const [existente] = await db
        .select({ id: voluntarioPerfil.id })
        .from(voluntarioPerfil)
        .where(eq(voluntarioPerfil.userId, userId))
        .limit(1)
    if (existente) return existente.id

    const aprovado = perfil.status === 'aprovado'
    const [linha] = await db
        .insert(voluntarioPerfil)
        .values({
            userId,
            nomeCompleto,
            dataNascimento: perfil.dataNascimento,
            cpf: completarCpf(perfil.baseCpf),
            telefone: perfil.telefone,
            cep: perfil.cep,
            bairro: perfil.bairro,
            profissao: perfil.profissao,
            restricoesSaude: perfil.restricoesSaude ?? null,
            veiculoProprio: perfil.veiculoProprio,
            tipoVeiculo: perfil.tipoVeiculo ?? null,
            disponibilidade: perfil.disponibilidade,
            status: perfil.status,
            // Só quem foi triado carrega o rastro de quem triou.
            aprovadoPor: aprovado ? aprovadorId : null,
            aprovadoEm: aprovado ? new Date() : null,
            motivoRejeicao: perfil.motivoRejeicao ?? null
        })
        .returning({ id: voluntarioPerfil.id })

    const perfilId = linha!.id

    for (const nome of perfil.habilidades) {
        const habilidadeId = habilidadesPorNome.get(nome)
        if (!habilidadeId) throw new Error(`Habilidade "${nome}" não existe — o seed de lookups precisa rodar antes.`)
        await db.insert(voluntarioHabilidade).values({ voluntarioPerfilId: perfilId, habilidadeId }).onConflictDoNothing()
    }

    return perfilId
}

/**
 * Atividade + turnos + alocação dos voluntários aprovados, para que a tela
 * "Minhas atividades" tenha conteúdo. Idempotente pelo título da atividade.
 */
async function garantirEscalaDeTeste(
    db: ReturnType<typeof drizzle>,
    args: { criadoPor: string; perfisAprovados: string[] }
) {
    if (args.perfisAprovados.length === 0) return

    const TITULO = 'Separação de doações — mutirão de teste'
    const [existente] = await db
        .select({ id: atividade.id })
        .from(atividade)
        .where(eq(atividade.titulo, TITULO))
        .limit(1)
    if (existente) {
        console.log('· escala de teste já existia')
        return
    }

    const categorias = await mapearPorNome(db, atividadeCategoria)
    const categoriaId = categorias.get('Separação de itens')
    if (!categoriaId) throw new Error('Categoria "Separação de itens" ausente — o seed de lookups precisa rodar antes.')

    const [novaAtividade] = await db
        .insert(atividade)
        .values({
            titulo: TITULO,
            categoriaId,
            local: 'Centro de Distribuição — Jaraguá do Sul',
            status: 'aberta',
            criadoPor: args.criadoPor
        })
        .returning({ id: atividade.id })

    // Turno de 4h amanhã de manhã (BR-VOL-04): no futuro, para a escala
    // aparecer como próxima em "Minhas atividades".
    const inicio = new Date()
    inicio.setDate(inicio.getDate() + 1)
    inicio.setHours(8, 0, 0, 0)
    const fim = new Date(inicio)
    fim.setHours(12, 0, 0, 0)

    const [novoTurno] = await db
        .insert(turno)
        .values({ atividadeId: novaAtividade!.id, inicio, fim, vagas: 6 })
        .returning({ id: turno.id })

    for (const voluntarioPerfilId of args.perfisAprovados) {
        await db
            .insert(alocacao)
            .values({ turnoId: novoTurno!.id, voluntarioPerfilId, alocadoPor: args.criadoPor })
            .onConflictDoNothing()
    }

    console.log(`✓ escala de teste: 1 atividade, 1 turno, ${args.perfisAprovados.length} alocações`)
}

/**
 * Cria o usuário com credencial de e-mail/senha, ou reafirma `role`/`ativo` se
 * já existir. Idempotente.
 */
async function garantirUsuario(
    db: ReturnType<typeof drizzle>,
    dados: { email: string; nome: string; senha: string; role: RoleDb }
): Promise<{ criado: boolean; userId: string }> {
    const [existente] = await db.select({ id: user.id }).from(user).where(eq(user.email, dados.email)).limit(1)
    if (existente) {
        await db.update(user).set({ role: dados.role, ativo: true }).where(eq(user.id, existente.id))
        return { criado: false, userId: existente.id }
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

    return { criado: true, userId }
}

await main()
