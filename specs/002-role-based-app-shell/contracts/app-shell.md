# Contrato — AppShell (UI)

**Módulo**: `src/shared/ui/shell/` — exportado pelo barrel `src/shared/ui/index.ts`
**Consumidor**: `app/(interno)/layout.tsx`

Sucessor de `app/(staff)/staff-shell.tsx`, generalizado para todos os perfis autenticados.

---

## Superfície pública

```ts
export interface AppShellProps {
    /** Role já validada no servidor. NUNCA derivada de estado do cliente. */
    role: Role
    nome: string
    rotuloRole: string
    /** Slot do sino (NOT-09). Ausente = sino não renderizado. */
    notificacoes?: ReactNode
    children: ReactNode
}

export function AppShell(props: AppShellProps): ReactElement
```

`'use client'` — necessário por `usePathname` (item ativo) e `useState` (gaveta). Todo o resto é calculado no servidor e chega por props (research.md D7).

---

## Regiões

### Topbar (FR-005 … FR-009)

| Elemento                | Condição                                                                                | Requisito |
| ----------------------- | --------------------------------------------------------------------------------------- | --------- |
| Nome da aplicação       | sempre                                                                                  | FR-005    |
| Nome + rótulo do perfil | sempre; identificação completa pode recolher em telas estreitas, mas o avatar permanece | FR-005    |
| Slot de notificações    | quando `notificacoes` é fornecido                                                       | FR-008    |
| Alternância de tema     | sempre                                                                                  | FR-007    |
| Ação de sair            | sempre, para todos os perfis                                                            | FR-006    |
| Botão de menu           | apenas abaixo de `lg`                                                                   | FR-009    |

**Sair**: `signOut()` → `router.push('/login')` → `router.refresh()`. O `refresh` é obrigatório — sem ele o shell autenticado permaneceria no cache do roteador do cliente após a sessão terminar.

### Sidebar (FR-010 … FR-014, FR-022 … FR-026)

| Comportamento                                                        | Requisito             |
| -------------------------------------------------------------------- | --------------------- |
| Coluna fixa em `lg+`; gaveta abaixo disso, recolhida por padrão      | FR-022                |
| Fecha ao escolher um destino                                         | FR-022                |
| Itens agrupados por seção, grupos vazios omitidos                    | FR-026, D6            |
| Item ativo com destaque visual **e** `aria-current="page"`           | FR-014                |
| Sem itens visíveis → sidebar inteira não renderizada; topbar mantida | caso de borda da spec |
| `<nav aria-label>` em pt-BR                                          | FR-023, FR-025        |
| Alvos ≥44px de altura                                                | FR-024                |
| Navegável por teclado, foco visível, sem armadilha de foco na gaveta | FR-023                |

---

## Invariantes de segurança

**S-01** — `role` chega já validada por `auth.api.getSession` no Server Component pai. O shell NUNCA a lê de query string, `localStorage`, cookie lido no cliente ou estado editável.

**S-02** — A filtragem por role acontece **no servidor**, antes da serialização das props. O navegador de um voluntário nunca recebe a lista de destinos internos (research.md D7).

**S-03** — Omitir um item NÃO é autorização (FR-015). Alcançar o destino por URL direta continua barrado por `proxy.ts` e pelos gates de layout. O shell não é, e não deve virar, um ponto de controle de acesso.

**S-04** — O shell não executa consulta ao banco. Notificações chegam prontas, como `ReactNode`, do layout servidor.

---

## Contrato dos layouts

### `app/(interno)/layout.tsx` — Server Component

```
export const instant = false          // lê sessão; não prerenderizável

1. ator = await exigirSessao()        // sem sessão → /login?redirecionar=...
2. [notificacoes, naoLidas] em paralelo, por ator.userId
3. render <AppShell role nome rotuloRole notificacoes>{children}</AppShell>
```

`instant = false` **sobe** de `(staff)/layout.tsx` para cá junto com a leitura de sessão. Esquecer isso faria o Next tentar prerenderizar um segmento dependente de cookies. Páginas abaixo podem voltar a declarar `instant` individualmente.

### `app/(interno)/(staff)/layout.tsx` — Server Component

```
export const instant = false          // também lê sessão (via exigirRoles)

1. await exigirRoles(ROLES_STAFF)     // sem role → /sem-permissao
2. return children                    // NÃO renderiza shell — já veio do pai
```

Reduzido ao gate de role. A checagem permanece por exigência do Princípio IV — removê-la, confiando apenas no `proxy.ts`, seria a única forma de esta feature piorar a segurança.

**`instant = false` é declarado nos dois níveis, não só no pai.** Verificado em execução: o insight do Next.js aponta o **segmento onde a leitura acontece**, e este segmento lê sessão por conta própria ao checar a role. Herdar do pai não o cobre.

**A leitura é memoizada por request** (`cache` do React em `obterSessao`). Sem isso, cada página de staff dispara **dois** `auth.api.getSession` por navegação — um por camada de gate. A defesa em profundidade é decisão de autorização; não é razão para pagar dois hits ao banco.

**Consequência de defesa em profundidade**: as páginas de `usuario`/`voluntario` hoje não têm checagem alguma no render, dependendo só do proxy. Sob `(interno)` passam a ter `exigirSessao()`. A lacuna fecha como efeito da reorganização.

---

## Preservação de URLs

Route groups não aparecem na URL. A movimentação de arquivos MUST preservar todos os caminhos:

| De                                       | Para                                            | URL (inalterada)                  |
| ---------------------------------------- | ----------------------------------------------- | --------------------------------- |
| `app/(auth)/login/`                      | `app/(publico)/login/`                          | `/login`                          |
| `app/(auth)/cadastro/`                   | `app/(publico)/cadastro/`                       | `/cadastro`                       |
| `app/(public)/page.tsx`                  | `app/(publico)/page.tsx`                        | `/`                               |
| `app/(public)/voluntariado/candidatura/` | `app/(interno)/voluntariado/candidatura/`       | `/voluntariado/candidatura`       |
| `app/voluntariado/minhas-atividades/`    | `app/(interno)/voluntariado/minhas-atividades/` | `/voluntariado/minhas-atividades` |
| `app/sem-permissao/`                     | `app/(interno)/sem-permissao/`                  | `/sem-permissao`                  |
| `app/(staff)/*`                          | `app/(interno)/(staff)/*`                       | inalteradas                       |

`proxy.ts` e `REGRAS_DE_ROTA` operam sobre caminhos públicos e por isso **não precisam de alteração alguma** — é o que torna esta reorganização segura.

---

## Remoções esperadas

A feature deve **remover** código, não apenas adicionar:

- `app/(staff)/staff-shell.tsx` — absorvido por `src/shared/ui/shell/`.
- Os `<header>` improvisados com `ThemeToggle` duplicados em `minhas-atividades/page.tsx` e `candidatura/page.tsx` — substituídos pela topbar do shell.
- O `<main>` e o wrapper `min-h-dvh` dessas páginas, agora responsabilidade do shell.

A landing (`(publico)/page.tsx`) **mantém** seu header próprio: é pré-autenticação e não recebe shell.
