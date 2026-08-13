import type { Role } from './roles'

/**
 * Única rota de navegação acessível sem sessão válida (DESIGN.md §6.2). Toda
 * rota fora desta é protegida por padrão — modelo *deny-by-default*: uma rota
 * nova sob `app/` nasce protegida, sem precisar de entrada explícita aqui.
 */
export const ROTA_PUBLICA = '/login'

/** `true` somente para a rota pública de navegação (`ROTA_PUBLICA`). */
export function ehRotaPublica(pathname: string): boolean {
    return pathname === ROTA_PUBLICA
}

/**
 * Mapa rota → roles permitidas, espelhando a matriz de atores do BRD §2
 * (DESIGN.md §6.2). Os prefixos são os **paths públicos**: o route group
 * `(staff)` não aparece na URL.
 *
 * Aplica-se **depois** de confirmado que existe sessão válida — define quais
 * papéis, dentre os autenticados, podem acessar cada rota. Uma rota ausente
 * daqui exige apenas sessão válida (qualquer papel), não role específica.
 *
 * A ordem importa — o primeiro prefixo que casar decide. Rotas mais
 * específicas (`/estoque/descarte`) vêm antes das mais genéricas
 * (`/estoque`).
 */
export const REGRAS_DE_ROTA: ReadonlyArray<{ prefixo: string; roles: readonly Role[] }> = [
    // Estoque — descarte e receita de kit são restritos a coordenação
    { prefixo: '/estoque/descarte', roles: ['coordenador', 'administrador'] },
    { prefixo: '/estoque/kits', roles: ['coordenador', 'administrador'] },
    { prefixo: '/estoque', roles: ['membro_defesa_civil', 'coordenador', 'administrador'] },

    // Gestão de usuários/permissões
    { prefixo: '/admin', roles: ['administrador'] },

    // Convocação em massa — alcance grande demais para operação de campo
    { prefixo: '/convocacao', roles: ['coordenador', 'administrador'] },

    // Relatórios e exportações — atribuídos à Defesa Civil, não à coordenação.
    // A rota e sua API de download andam juntas: separá-las deixaria a tela
    // acessível com os botões em 403, ou os dados alcançáveis por URL direta
    // para quem já não pode abrir a tela.
    { prefixo: '/relatorios', roles: ['membro_defesa_civil', 'administrador'] },
    { prefixo: '/api/relatorios/export', roles: ['membro_defesa_civil', 'administrador'] },
    // Pacote de contingência (BR-CON-01): mesma atribuição da tela de
    // relatórios, de onde ele é gerado. Coordenação não tem acesso.
    { prefixo: '/api/contingencia/export', roles: ['membro_defesa_civil', 'administrador'] },

    // Triagem, atividades e dashboard
    { prefixo: '/cadastros-pendentes', roles: ['membro_defesa_civil', 'coordenador', 'administrador'] },
    { prefixo: '/voluntarios', roles: ['membro_defesa_civil', 'coordenador', 'administrador'] },
    { prefixo: '/atividades', roles: ['membro_defesa_civil', 'coordenador', 'administrador'] },
    { prefixo: '/dashboard', roles: ['membro_defesa_civil', 'coordenador', 'administrador'] },
    // Variáveis da crise: atribuídas à Defesa Civil, não à coordenação. As
    // Server Actions da tela (`logistica.ts`) derivam desta regra — separá-las
    // deixaria a coordenação alterando os números sem poder abrir a tela.
    { prefixo: '/crise', roles: ['membro_defesa_civil', 'administrador'] },

    // Área do voluntário
    {
        prefixo: '/voluntariado/minhas-atividades',
        roles: ['voluntario', 'membro_defesa_civil', 'coordenador', 'administrador']
    }
]

/** Roles exigidas para `pathname`, ou `null` se basta sessão válida (sem role específica). */
export function rolesExigidas(pathname: string): readonly Role[] | null {
    const regra = REGRAS_DE_ROTA.find((r) => pathname === r.prefixo || pathname.startsWith(`${r.prefixo}/`))
    return regra?.roles ?? null
}

export function podeAcessar(pathname: string, role: Role | undefined): boolean {
    const exigidas = rolesExigidas(pathname)
    if (!exigidas) return true
    return role !== undefined && exigidas.includes(role)
}

/**
 * Destino padrão de quem acabou de autenticar, ou de quem já logado acessa
 * `/login` (FR-003), quando não há `?redirecionar=` explícito a honrar.
 *
 * É a home — e **uma só para todos os papéis**, de propósito. Ela monta os
 * cards de acesso rápido a partir do perfil da sessão, então já entrega a cada
 * pessoa o destino certo sem que ninguém precise decidir isso antes.
 *
 * Substituiu um `areaPadraoPorRole(role)` que devolvia `/dashboard` para staff,
 * `/voluntariado/minhas-atividades` para voluntário e `/voluntariado/candidatura`
 * para usuário. Um destino por papel só funciona enquanto **todo** ponto de
 * redirecionamento souber a role — e o formulário de login, que roda no cliente
 * antes de a sessão existir, não sabe. Era exatamente aí que `usuario` e
 * `voluntario` caíam em `/dashboard` e batiam em `/sem-permissao`.
 */
export const AREA_PADRAO = '/'

/**
 * Destino do botão de retorno na página de endereço não encontrado
 * (specs/003-not-found-page).
 *
 * Duas saídas porque são dois públicos: quem tem sessão volta para a home, que
 * é ciente do perfil; quem não tem vai para a tela de entrada. Mandar o
 * visitante anônimo para `/` funcionaria por acidente — o `proxy.ts` o
 * redirecionaria —, mas com um salto a mais e dependendo do gate para corrigir
 * o destino. Um botão de saída que produz nova negativa é pior que nenhum.
 */
export function destinoDeRetorno(temSessao: boolean): string {
    return temSessao ? AREA_PADRAO : ROTA_PUBLICA
}
