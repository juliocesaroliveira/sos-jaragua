/**
 * Catálogo da Danger Zone (026-danger-zone-admin, research D1–D3, data-model §1).
 *
 * É a **segunda descrição do schema físico**, e existe porque a primeira
 * (`db/schema/*`) não diz o que a Danger Zone precisa saber: o rótulo pt-BR de
 * cada tabela, quais colunas são seguras para mostrar e — principalmente — se
 * um vínculo é **inseparável** (o filho não tem sentido sem o pai) ou de
 * **histórico** (o filho documenta algo que aconteceu e deve sobreviver).
 *
 * Duas descrições divergem com o tempo. Por isso o catálogo é conferido contra
 * `pg_constraint` a cada uso (`conferirCatalogo`), e um vínculo físico que não
 * está aqui bloqueia as ações sobre as tabelas que ele liga (FR-013a). Uma
 * migração que acrescente FK precisa acrescentar a linha correspondente aqui —
 * o teste de integração do catálogo quebra o CI se não acrescentar.
 *
 * Nomes de tabela e coluna são os **físicos** (snake_case): o executor monta SQL
 * com eles via `sql.identifier`, e nenhum vem do cliente.
 *
 * Domínio puro: nada de Drizzle, Next ou Mongo aqui (Princípio I).
 */

export type Area = 'identidade' | 'voluntariado' | 'estoque' | 'logistica' | 'notificacoes'

export type Classificacao = 'inseparavel' | 'historico'

export type RegraBanco = 'cascade' | 'set null' | 'restrict' | 'no action'

/**
 * Como identificar uma linha para um humano, na amostra da prévia e na listagem
 * de registros. Tabelas sem coluna de nome herdam o rótulo do pai por um vínculo
 * declarado (L2 da análise): "Arroz 5 kg · 12.000" diz mais que um UUID.
 */
export type RotuloRegistro = {
    colunas: readonly string[]
    pai?: { coluna: string; tabela: string; colunaRotulo: string }
}

export type TabelaGerenciavel = {
    nome: string
    rotulo: string
    area: Area
    chavePrimaria: readonly string[]
    rotuloRegistro: RotuloRegistro
    /** Colunas listadas na seleção de registros. Nunca inclui credenciais. */
    colunasExibidas: readonly string[]
    /** Mascaradas em toda superfície (Princípio IV). */
    colunasSensiveis: readonly string[]
    /** Removidas de listagem, amostra e snapshot de auditoria (research D9). */
    colunasCredencial: readonly string[]
}

export type Vinculo = {
    filho: string
    coluna: string
    /** A coluna referenciada é sempre a chave primária (única) do pai. */
    pai: string
    obrigatorio: boolean
    regraBanco: RegraBanco
    classificacao: Classificacao
}

export type Catalogo = {
    tabelas: readonly TabelaGerenciavel[]
    vinculos: readonly Vinculo[]
}

const ID = ['id'] as const

const TABELAS: readonly TabelaGerenciavel[] = [
    // ── Identidade ──────────────────────────────────────────────────────────
    {
        nome: 'user',
        rotulo: 'Usuários',
        area: 'identidade',
        chavePrimaria: ID,
        rotuloRegistro: { colunas: ['name', 'email'] },
        colunasExibidas: ['name', 'email', 'role', 'ativo', 'created_at'],
        colunasSensiveis: ['data_nascimento'],
        colunasCredencial: []
    },
    {
        nome: 'session',
        rotulo: 'Sessões de login',
        area: 'identidade',
        chavePrimaria: ID,
        rotuloRegistro: { colunas: ['created_at'], pai: { coluna: 'user_id', tabela: 'user', colunaRotulo: 'name' } },
        colunasExibidas: ['user_id', 'created_at', 'expires_at', 'last_activity_at'],
        colunasSensiveis: [],
        colunasCredencial: ['token']
    },
    {
        nome: 'account',
        rotulo: 'Contas de login',
        area: 'identidade',
        chavePrimaria: ID,
        rotuloRegistro: { colunas: ['provider_id'], pai: { coluna: 'user_id', tabela: 'user', colunaRotulo: 'name' } },
        colunasExibidas: ['user_id', 'provider_id', 'created_at'],
        colunasSensiveis: [],
        colunasCredencial: ['password', 'access_token', 'refresh_token', 'id_token']
    },
    {
        nome: 'verification',
        rotulo: 'Verificações pendentes',
        area: 'identidade',
        chavePrimaria: ID,
        rotuloRegistro: { colunas: ['identifier', 'expires_at'] },
        colunasExibidas: ['identifier', 'expires_at', 'created_at'],
        colunasSensiveis: [],
        colunasCredencial: ['value']
    },

    // ── Voluntariado ────────────────────────────────────────────────────────
    {
        nome: 'habilidade',
        rotulo: 'Habilidades',
        area: 'voluntariado',
        chavePrimaria: ID,
        rotuloRegistro: { colunas: ['nome'] },
        colunasExibidas: ['nome', 'criado_em'],
        colunasSensiveis: [],
        colunasCredencial: []
    },
    {
        nome: 'atividade_categoria',
        rotulo: 'Categorias de atividade',
        area: 'voluntariado',
        chavePrimaria: ID,
        rotuloRegistro: { colunas: ['nome'] },
        colunasExibidas: ['nome', 'criado_em'],
        colunasSensiveis: [],
        colunasCredencial: []
    },
    {
        nome: 'voluntario_perfil',
        rotulo: 'Perfis de voluntário',
        area: 'voluntariado',
        chavePrimaria: ID,
        rotuloRegistro: { colunas: ['status'], pai: { coluna: 'user_id', tabela: 'user', colunaRotulo: 'name' } },
        colunasExibidas: ['user_id', 'status', 'bairro', 'cpf', 'cep', 'data_nascimento', 'criado_em'],
        colunasSensiveis: ['cpf', 'cep', 'data_nascimento'],
        // O índice cego não é segredo de autenticação, mas é derivado do CPF e
        // não tem leitura humana: sai de tudo como credencial.
        colunasCredencial: ['cpf_indice']
    },
    {
        nome: 'voluntario_habilidade',
        rotulo: 'Habilidades de voluntários',
        area: 'voluntariado',
        chavePrimaria: ID,
        rotuloRegistro: {
            colunas: ['voluntario_perfil_id'],
            pai: { coluna: 'habilidade_id', tabela: 'habilidade', colunaRotulo: 'nome' }
        },
        colunasExibidas: ['voluntario_perfil_id', 'habilidade_id'],
        colunasSensiveis: [],
        colunasCredencial: []
    },
    {
        nome: 'atividade',
        rotulo: 'Atividades',
        area: 'voluntariado',
        chavePrimaria: ID,
        rotuloRegistro: { colunas: ['titulo'] },
        colunasExibidas: ['titulo', 'local', 'status', 'criado_em'],
        colunasSensiveis: [],
        colunasCredencial: []
    },
    {
        nome: 'turno',
        rotulo: 'Turnos',
        area: 'voluntariado',
        chavePrimaria: ID,
        rotuloRegistro: {
            colunas: ['inicio'],
            pai: { coluna: 'atividade_id', tabela: 'atividade', colunaRotulo: 'titulo' }
        },
        colunasExibidas: ['atividade_id', 'inicio', 'fim', 'vagas'],
        colunasSensiveis: [],
        colunasCredencial: []
    },
    {
        nome: 'alocacao',
        rotulo: 'Alocações em turnos',
        area: 'voluntariado',
        chavePrimaria: ID,
        rotuloRegistro: {
            colunas: ['status'],
            pai: { coluna: 'participante_user_id', tabela: 'user', colunaRotulo: 'name' }
        },
        colunasExibidas: ['turno_id', 'participante_user_id', 'status', 'origem', 'criado_em'],
        colunasSensiveis: [],
        colunasCredencial: []
    },

    // ── Estoque ─────────────────────────────────────────────────────────────
    {
        nome: 'item',
        rotulo: 'Itens',
        area: 'estoque',
        chavePrimaria: ID,
        rotuloRegistro: { colunas: ['nome'] },
        colunasExibidas: ['nome', 'categoria', 'unidade_medida', 'criado_em'],
        colunasSensiveis: [],
        colunasCredencial: []
    },
    {
        nome: 'saldo_estoque',
        rotulo: 'Saldos de estoque',
        area: 'estoque',
        chavePrimaria: ['item_id'],
        rotuloRegistro: {
            colunas: ['quantidade_atual'],
            pai: { coluna: 'item_id', tabela: 'item', colunaRotulo: 'nome' }
        },
        colunasExibidas: ['item_id', 'quantidade_atual', 'atualizado_em'],
        colunasSensiveis: [],
        colunasCredencial: []
    },
    {
        nome: 'kit',
        rotulo: 'Kits',
        area: 'estoque',
        chavePrimaria: ID,
        rotuloRegistro: { colunas: ['nome'] },
        colunasExibidas: ['nome', 'ativo', 'criado_em'],
        colunasSensiveis: [],
        colunasCredencial: []
    },
    {
        nome: 'kit_receita_item',
        rotulo: 'Receitas de kit',
        area: 'estoque',
        chavePrimaria: ID,
        rotuloRegistro: { colunas: ['quantidade'], pai: { coluna: 'kit_id', tabela: 'kit', colunaRotulo: 'nome' } },
        colunasExibidas: ['kit_id', 'item_id', 'quantidade'],
        colunasSensiveis: [],
        colunasCredencial: []
    },
    {
        nome: 'entrada',
        rotulo: 'Entradas de doação',
        area: 'estoque',
        chavePrimaria: ID,
        rotuloRegistro: {
            colunas: ['quantidade', 'criado_em'],
            pai: { coluna: 'item_id', tabela: 'item', colunaRotulo: 'nome' }
        },
        colunasExibidas: ['item_id', 'quantidade', 'condicao', 'kit_destino_id', 'criado_em'],
        colunasSensiveis: [],
        colunasCredencial: []
    },
    {
        nome: 'saida',
        rotulo: 'Saídas',
        area: 'estoque',
        chavePrimaria: ID,
        rotuloRegistro: { colunas: ['destino', 'criado_em'] },
        colunasExibidas: ['tipo', 'destino', 'responsavel_transporte', 'criado_em'],
        colunasSensiveis: [],
        colunasCredencial: []
    },
    {
        nome: 'saida_item',
        rotulo: 'Itens de saída',
        area: 'estoque',
        chavePrimaria: ID,
        rotuloRegistro: { colunas: ['quantidade'], pai: { coluna: 'item_id', tabela: 'item', colunaRotulo: 'nome' } },
        colunasExibidas: ['saida_id', 'item_id', 'quantidade'],
        colunasSensiveis: [],
        colunasCredencial: []
    },
    {
        nome: 'descarte',
        rotulo: 'Descartes',
        area: 'estoque',
        chavePrimaria: ID,
        rotuloRegistro: {
            colunas: ['quantidade', 'criado_em'],
            pai: { coluna: 'item_id', tabela: 'item', colunaRotulo: 'nome' }
        },
        colunasExibidas: ['item_id', 'quantidade', 'motivo', 'criado_em'],
        colunasSensiveis: [],
        colunasCredencial: []
    },

    // ── Logística ───────────────────────────────────────────────────────────
    {
        nome: 'crise_variaveis',
        rotulo: 'Variáveis da crise',
        area: 'logistica',
        chavePrimaria: ID,
        rotuloRegistro: { colunas: ['atualizado_em', 'total_familias_afetadas'] },
        colunasExibidas: ['total_familias_afetadas', 'total_pessoas_afetadas', 'atualizado_em'],
        colunasSensiveis: [],
        colunasCredencial: []
    },
    {
        nome: 'metrica_kit',
        rotulo: 'Métricas de kit',
        area: 'logistica',
        chavePrimaria: ID,
        rotuloRegistro: { colunas: ['base_demanda'], pai: { coluna: 'kit_id', tabela: 'kit', colunaRotulo: 'nome' } },
        colunasExibidas: ['kit_id', 'base_demanda', 'proporcao'],
        colunasSensiveis: [],
        colunasCredencial: []
    },

    // ── Notificações ────────────────────────────────────────────────────────
    {
        nome: 'notificacao',
        rotulo: 'Notificações',
        area: 'notificacoes',
        chavePrimaria: ID,
        rotuloRegistro: { colunas: ['titulo', 'criado_em'] },
        colunasExibidas: ['destinatario_user_id', 'tipo', 'titulo', 'lida', 'criado_em'],
        colunasSensiveis: [],
        colunasCredencial: []
    },
    {
        nome: 'notificacao_envio',
        rotulo: 'Envios de notificação',
        area: 'notificacoes',
        chavePrimaria: ID,
        rotuloRegistro: {
            colunas: ['canal', 'status'],
            pai: { coluna: 'notificacao_id', tabela: 'notificacao', colunaRotulo: 'titulo' }
        },
        colunasExibidas: ['notificacao_id', 'canal', 'status', 'enviado_em'],
        colunasSensiveis: [],
        colunasCredencial: []
    },
    {
        nome: 'preferencia_whatsapp',
        rotulo: 'Preferências de WhatsApp',
        area: 'notificacoes',
        chavePrimaria: ['user_id'],
        rotuloRegistro: { colunas: ['ativo'], pai: { coluna: 'user_id', tabela: 'user', colunaRotulo: 'name' } },
        colunasExibidas: ['user_id', 'ativo', 'atualizado_em'],
        colunasSensiveis: [],
        colunasCredencial: []
    },
    {
        nome: 'consentimento_whatsapp',
        rotulo: 'Consentimentos de WhatsApp',
        area: 'notificacoes',
        chavePrimaria: ID,
        rotuloRegistro: {
            colunas: ['acao', 'criado_em'],
            pai: { coluna: 'user_id', tabela: 'user', colunaRotulo: 'name' }
        },
        colunasExibidas: ['user_id', 'acao', 'origem', 'criado_em'],
        colunasSensiveis: [],
        colunasCredencial: []
    },
    {
        nome: 'whatsapp_resposta_automatica',
        rotulo: 'Respostas automáticas de WhatsApp',
        area: 'notificacoes',
        chavePrimaria: ['telefone'],
        rotuloRegistro: { colunas: ['ultima_em'] },
        colunasExibidas: ['ultima_em'],
        colunasSensiveis: [],
        colunasCredencial: []
    }
]

const v = (
    filho: string,
    coluna: string,
    pai: string,
    obrigatorio: boolean,
    regraBanco: RegraBanco,
    classificacao: Classificacao
): Vinculo => ({ filho, coluna, pai, obrigatorio, regraBanco, classificacao })

/**
 * Classificação de research D3. Critérios:
 * - **inseparável**: parte do agregado do pai (turno da atividade, item da
 *   saída, linha de receita), dado pessoal/credencial do próprio titular
 *   (sessão, conta, perfil, consentimento) ou índice único que tornaria o
 *   registro padrão impossível sem ganho.
 * - **histórico**: documenta algo que aconteceu e é lido por relatórios —
 *   movimentações, autoria, alocações, notificações enviadas.
 *
 * Onde a classificação contraria a regra física, o comentário explica: é a
 * classificação que vale (FR-013), e o executor a impõe redirecionando o
 * vínculo **antes** de apagar o pai (research D6).
 */
const VINCULOS: readonly Vinculo[] = [
    // Identidade
    v('session', 'user_id', 'user', true, 'cascade', 'inseparavel'),
    v('account', 'user_id', 'user', true, 'cascade', 'inseparavel'),

    // Voluntariado
    v('voluntario_perfil', 'user_id', 'user', true, 'cascade', 'inseparavel'),
    v('voluntario_perfil', 'aprovado_por', 'user', false, 'set null', 'historico'),
    v('voluntario_habilidade', 'voluntario_perfil_id', 'voluntario_perfil', true, 'cascade', 'inseparavel'),
    // `restrict` no banco, mas um vínculo pessoa↔habilidade sem a habilidade não
    // tem leitura — e o índice único (perfil, habilidade) impediria o padrão.
    v('voluntario_habilidade', 'habilidade_id', 'habilidade', true, 'restrict', 'inseparavel'),
    v('atividade', 'categoria_id', 'atividade_categoria', true, 'no action', 'historico'),
    v('atividade', 'criado_por', 'user', true, 'no action', 'historico'),
    v('turno', 'atividade_id', 'atividade', true, 'cascade', 'inseparavel'),
    v('alocacao', 'turno_id', 'turno', true, 'cascade', 'inseparavel'),
    // `cascade` no banco: apagar um usuário destruiria em silêncio o histórico
    // de turnos (Princípio IV). A Danger Zone o preserva como histórico.
    v('alocacao', 'participante_user_id', 'user', true, 'cascade', 'historico'),
    v('alocacao', 'voluntario_perfil_id', 'voluntario_perfil', false, 'cascade', 'historico'),
    v('alocacao', 'alocado_por', 'user', true, 'no action', 'historico'),

    // Estoque
    v('saldo_estoque', 'item_id', 'item', true, 'cascade', 'inseparavel'),
    v('kit_receita_item', 'kit_id', 'kit', true, 'cascade', 'inseparavel'),
    // `restrict` no banco; a linha de receita é parte do kit e perde o sentido
    // sem o item. O índice único (kit, item) impediria o registro padrão.
    v('kit_receita_item', 'item_id', 'item', true, 'restrict', 'inseparavel'),
    v('entrada', 'item_id', 'item', true, 'restrict', 'historico'),
    v('entrada', 'kit_destino_id', 'kit', false, 'set null', 'historico'),
    v('entrada', 'registrado_por', 'user', true, 'no action', 'historico'),
    v('saida', 'registrado_por', 'user', true, 'no action', 'historico'),
    v('saida_item', 'saida_id', 'saida', true, 'cascade', 'inseparavel'),
    v('saida_item', 'item_id', 'item', true, 'restrict', 'historico'),
    v('descarte', 'item_id', 'item', true, 'restrict', 'historico'),
    v('descarte', 'registrado_por', 'user', true, 'no action', 'historico'),

    // Logística
    v('crise_variaveis', 'atualizado_por', 'user', true, 'no action', 'historico'),
    v('metrica_kit', 'kit_id', 'kit', true, 'cascade', 'inseparavel'),

    // Notificações
    // `cascade` no banco; a notificação enviada é lida pelo relatório R-16.
    v('notificacao', 'destinatario_user_id', 'user', true, 'cascade', 'historico'),
    v('notificacao_envio', 'notificacao_id', 'notificacao', true, 'cascade', 'inseparavel'),
    v('preferencia_whatsapp', 'user_id', 'user', true, 'cascade', 'inseparavel'),
    v('consentimento_whatsapp', 'user_id', 'user', true, 'cascade', 'inseparavel')
]

export const CATALOGO: Catalogo = { tabelas: TABELAS, vinculos: VINCULOS }

const PORNOME = new Map(TABELAS.map((t) => [t.nome, t]))

export function tabelaDoCatalogo(nome: string): TabelaGerenciavel | undefined {
    return PORNOME.get(nome)
}

export function vinculosDoCatalogo(): readonly Vinculo[] {
    return VINCULOS
}

/** Identificador legível de um vínculo, usado em mensagens e chaves de mapa. */
export function nomeDoVinculo(vinculo: Pick<Vinculo, 'filho' | 'coluna' | 'pai'>): string {
    return `${vinculo.filho}.${vinculo.coluna} → ${vinculo.pai}`
}

export const ROTULO_AREA: Record<Area, string> = {
    identidade: 'Identidade',
    voluntariado: 'Voluntariado',
    estoque: 'Estoque',
    logistica: 'Logística',
    notificacoes: 'Notificações'
}
