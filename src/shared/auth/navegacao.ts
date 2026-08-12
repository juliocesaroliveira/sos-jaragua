import type { Role } from './roles'

/**
 * Registro de navegação — fonte única dos itens do menu lateral
 * (specs/002-role-based-app-shell/contracts/navegacao.md).
 *
 * Co-locado com `rotas.ts` de propósito: os dois descrevem a mesma matriz de
 * atores, um do ponto de vista da autorização e outro do da navegação. Quem
 * editar um precisa ver que o outro existe. `navegacao.test.ts` trava a
 * consistência entre eles (INV-01) e quebra se divergirem.
 *
 * **Esconder um item não é autorização.** `roles` decide exibição; o acesso
 * continua barrado por `proxy.ts` e pelos gates de layout, inclusive para um
 * destino alcançado por URL direta (FR-015).
 *
 * Este módulo é uma estrutura de dados pura: não importa React, Next.js,
 * Drizzle nem nada de `src/modules/`. É o que permite testá-lo sem DOM e o que
 * impede que ele acumule responsabilidade de UI — por isso `icone` é um
 * **identificador**, resolvido para componente só na camada de UI
 * (`src/shared/ui/shell/icones.ts`).
 */

export type IdGrupo = 'pessoal' | 'voluntariado' | 'operacao' | 'estoque' | 'coordenacao' | 'administracao'

/** Identificador de ícone, não um componente React. */
export type NomeIcone = string

export type ItemNavegacao = {
    readonly href: string
    readonly rotulo: string
    readonly icone: NomeIcone
    readonly grupo: IdGrupo
    readonly roles: readonly Role[]
}

export type GrupoNavegacao = {
    readonly id: IdGrupo
    readonly rotulo: string
    readonly ordem: number
}

export type SecaoNavegacao = {
    readonly grupo: GrupoNavegacao
    readonly itens: readonly ItemNavegacao[]
}

/**
 * Grupos existem só para legibilidade — não carregam roles próprias. Um grupo
 * aparece se, e somente se, sobrar ao menos um item visível nele.
 */
export const GRUPOS: Readonly<Record<IdGrupo, GrupoNavegacao>> = {
    pessoal: { id: 'pessoal', rotulo: 'Minha conta', ordem: 1 },
    voluntariado: { id: 'voluntariado', rotulo: 'Voluntariado', ordem: 2 },
    operacao: { id: 'operacao', rotulo: 'Operação', ordem: 3 },
    estoque: { id: 'estoque', rotulo: 'Estoque', ordem: 4 },
    coordenacao: { id: 'coordenacao', rotulo: 'Coordenação', ordem: 5 },
    administracao: { id: 'administracao', rotulo: 'Administração', ordem: 6 }
}

/** Atalhos para os conjuntos de roles que se repetem, evitando divergência por digitação. */
const STAFF: readonly Role[] = ['membro_defesa_civil', 'coordenador', 'administrador']
const COORDENACAO: readonly Role[] = ['coordenador', 'administrador']

/**
 * Ordem de declaração = ordem de exibição dentro de cada grupo.
 *
 * O grupo `administracao` está definido mas ainda sem itens: a área de
 * administração não foi construída, e exibir um link para uma página
 * inexistente violaria SC-004. Basta acrescentar a linha quando a página
 * existir (research.md D4).
 */
export const NAVEGACAO: readonly ItemNavegacao[] = [
    {
        href: '/voluntariado/candidatura',
        rotulo: 'Quero ser voluntário',
        icone: 'HandHeart',
        grupo: 'pessoal',
        // Sem regra em REGRAS_DE_ROTA: decisão de produto, não espelho de
        // autorização. Quem já é staff não se candidata a voluntário pelo menu.
        roles: ['usuario', 'voluntario']
    },
    {
        href: '/voluntariado/minhas-atividades',
        rotulo: 'Minhas atividades',
        icone: 'CalendarCheck',
        grupo: 'voluntariado',
        roles: ['voluntario', ...STAFF]
    },

    { href: '/dashboard', rotulo: 'Painel', icone: 'LayoutDashboard', grupo: 'operacao', roles: STAFF },
    { href: '/cadastros-pendentes', rotulo: 'Cadastros pendentes', icone: 'Users', grupo: 'operacao', roles: STAFF },
    { href: '/voluntarios', rotulo: 'Voluntários', icone: 'UserCheck', grupo: 'operacao', roles: STAFF },
    { href: '/atividades', rotulo: 'Atividades', icone: 'ClipboardList', grupo: 'operacao', roles: STAFF },
    { href: '/crise', rotulo: 'Variáveis da crise', icone: 'TriangleAlert', grupo: 'operacao', roles: STAFF },

    { href: '/estoque', rotulo: 'Estoque', icone: 'Boxes', grupo: 'estoque', roles: STAFF },
    { href: '/estoque/entrada', rotulo: 'Entrada de doações', icone: 'PackagePlus', grupo: 'estoque', roles: STAFF },
    { href: '/estoque/saida', rotulo: 'Saída de itens', icone: 'PackageMinus', grupo: 'estoque', roles: STAFF },
    { href: '/estoque/kits', rotulo: 'Kits', icone: 'Package', grupo: 'estoque', roles: COORDENACAO },
    { href: '/estoque/descarte', rotulo: 'Descarte', icone: 'Trash2', grupo: 'estoque', roles: COORDENACAO },

    { href: '/convocacao', rotulo: 'Convocação', icone: 'Megaphone', grupo: 'coordenacao', roles: COORDENACAO },
    { href: '/relatorios', rotulo: 'Relatórios', icone: 'FileSpreadsheet', grupo: 'coordenacao', roles: COORDENACAO }
]

/** Itens visíveis ao perfil, na ordem de declaração. Pode ser vazio. */
export function itensDeNavegacao(role: Role): readonly ItemNavegacao[] {
    return NAVEGACAO.filter((item) => item.roles.includes(role))
}

/**
 * Agrupa os itens **já filtrados** em seções ordenadas.
 *
 * Derivar as seções da lista filtrada — em vez de declarar uma árvore
 * grupo→itens e podá-la depois — faz de FR-026 uma consequência estrutural:
 * um grupo sem item sobrevivente simplesmente nunca é criado, e não há passo
 * de poda que alguém possa esquecer (research.md D6).
 */
export function gruposVisiveis(itens: readonly ItemNavegacao[]): readonly SecaoNavegacao[] {
    const porGrupo = new Map<IdGrupo, ItemNavegacao[]>()

    for (const item of itens) {
        const lista = porGrupo.get(item.grupo)
        if (lista) lista.push(item)
        else porGrupo.set(item.grupo, [item])
    }

    return [...porGrupo.entries()]
        .map(([id, itensDoGrupo]) => ({ grupo: GRUPOS[id], itens: itensDoGrupo }))
        .sort((a, b) => a.grupo.ordem - b.grupo.ordem)
}

/**
 * Item correspondente à página atual (FR-014).
 *
 * Casa por igualdade ou por **segmento** completo — `/estoque` casa
 * `/estoque/entrada`, mas não `/estoquex`. Havendo mais de uma
 * correspondência, vence o `href` mais longo: em `/estoque/kits` o item ativo é
 * "Kits", não "Estoque". O shell anterior usava a primeira correspondência e
 * marcava os dois ao mesmo tempo.
 */
export function itemAtivo(pathname: string, itens: readonly ItemNavegacao[]): ItemNavegacao | undefined {
    let melhor: ItemNavegacao | undefined

    for (const item of itens) {
        const casa = pathname === item.href || pathname.startsWith(`${item.href}/`)
        if (!casa) continue
        if (!melhor || item.href.length > melhor.href.length) melhor = item
    }

    return melhor
}
