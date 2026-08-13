# Contrato — Página de Endereço Não Encontrado

**Módulos**: `app/not-found.tsx`, `app/(interno)/not-found.tsx`, `app/_shell/shell-autenticado.tsx`, `src/shared/ui/nao-encontrado/nao-encontrado.tsx`, `src/shared/auth/rotas.ts`

---

## 1. `ConteudoNaoEncontrado` — conteúdo compartilhado

```ts
export interface ConteudoNaoEncontradoProps {
    /**
     * Destino do botão de retorno. Vem de `destinoDeRetorno(temSessao)` — o
     * componente não decide, para não precisar conhecer a sessão.
     */
    destino: string
    /** Rótulo do botão, em pt-BR. */
    rotuloBotao: string
}

export function ConteudoNaoEncontrado(props: ConteudoNaoEncontradoProps): ReactElement
```

| Garantia | Descrição |
|----------|-----------|
| C-01 | Server Component. Não usa hooks, não lê sessão, não faz I/O. |
| C-02 | **Não recebe `ator` nem lista de navegação.** Não tem como vazar identidade ou destinos internos (FR-009, FR-015) — é propriedade do tipo, não disciplina. |
| C-03 | Não recebe nem exibe o endereço solicitado (FR-017). |
| C-04 | Texto em pt-BR, sem distinguir "nunca existiu" de "foi removido" (FR-015). |
| C-05 | Botão com alvo ≥44px e `ANEL_FOCO` do design system (FR-018, FR-020). |
| C-06 | Condição comunicada por texto, não só por cor ou ilustração (FR-021). |
| C-07 | Legível em 360px sem rolagem horizontal (FR-019). |

---

## 2. `app/not-found.tsx` — fronteira raiz

Captura **URLs desconhecidas de toda a aplicação** e `notFound()` fora de `(interno)`.

```
Server Component async

1. ator = await obterSessao()          // NUNCA exigirSessao: não pode redirecionar
2. se ator:
       <ShellAutenticado ator>
           <ConteudoNaoEncontrado destino={destinoDeRetorno(true)} …/>
       </ShellAutenticado>
   senão:
       <ConteudoNaoEncontrado destino={destinoDeRetorno(false)} …/>
```

| Garantia | Descrição |
|----------|-----------|
| R-01 | Usa `obterSessao()`, que aceita ausência de sessão. Usar `exigirSessao()` transformaria a página de erro em um redirect — defeito, não proteção. |
| R-02 | Sem sessão, **nenhuma** consulta é feita: nem notificações, nem itens de navegação. |
| R-03 | A decisão acontece no servidor, nunca a partir de dado do cliente (FR-010). |
| R-04 | Renderiza dentro do root layout, então herda `ThemeProvider` e fonte — FR-005 sai de graça (research.md D2). |

---

## 3. `app/(interno)/not-found.tsx` — fronteira da área autenticada

Captura `notFound()` lançado em qualquer ponto sob `(interno)`, incluindo `(staff)`.

```
Server Component

return <ConteudoNaoEncontrado destino={destinoDeRetorno(true)} …/>
```

| Garantia | Descrição |
|----------|-----------|
| I-01 | **Não** monta o shell. Ele já veio de `(interno)/layout.tsx`, que está na árvore. Montá-lo de novo produziria shell duplicado. |
| I-02 | Pode assumir sessão válida: o layout acima já rodou `exigirSessao()` antes de qualquer render deste segmento. |
| I-03 | O menu exibido é o do perfil, porque é o do layout real — FR-007 sai de graça. |

---

## 4. `ShellAutenticado` — montagem reutilizável

```ts
export interface ShellAutenticadoProps {
    /** Sessão já resolvida pelo chamador. */
    ator: SessaoAtor
    children: ReactNode
}

export async function ShellAutenticado(props: ShellAutenticadoProps): Promise<ReactElement>
```

| Garantia | Descrição |
|----------|-----------|
| S-01 | Recebe `ator` por prop, **não** o busca. Os chamadores obtêm a sessão de formas incompatíveis: o layout com `exigirSessao()` (redireciona), o 404 com `obterSessao()` (aceita `null`). Buscar aqui obrigaria a escolher um dos dois comportamentos e quebraria o outro. |
| S-02 | Filtra os itens de navegação **no servidor** por `ator.role`, preservando S-02 do contrato do shell (feature 002). |
| S-03 | Busca notificações do ator, como o layout faz hoje. |
| S-04 | É `server-only` e fica em `app/_shell/` — fora do barrel do design system, que Client Components importam livremente. |

Após a extração, `app/(interno)/layout.tsx` fica sendo: `exigirSessao()` → `<ShellAutenticado ator>{children}</ShellAutenticado>`, mantendo `export const instant = false`.

---

## 5. `destinoDeRetorno` — única unidade testável

```ts
export function destinoDeRetorno(temSessao: boolean): string
```

| Entrada | Saída | Requisito |
|---------|-------|-----------|
| `true` | `AREA_PADRAO` | FR-012 |
| `false` | `ROTA_PUBLICA` | FR-013 |

### Invariantes travadas por teste

**INV-01 — o destino com sessão é alcançável por todos os perfis**

> `podeAcessar(destinoDeRetorno(true), role)` MUST ser `true` para cada valor de `ROLES`.

É a trava de SC-004. Um destino por papel voltaria a introduzir o bug que a feature 002 corrigiu no login: mandar `usuario` para uma rota de staff e produzir `/sem-permissao` a partir de um botão de saída.

**INV-02 — o destino sem sessão dispensa sessão**

> `ehRotaPublica(destinoDeRetorno(false))` MUST ser `true`.

Sem isso, o botão do visitante anônimo levaria a um endereço que o `proxy.ts` devolveria para `/login` — funcionaria por acidente, com um salto a mais, e quebraria se o modelo de acesso mudasse.

**INV-03 — os dois destinos são distintos**

> `destinoDeRetorno(true) !== destinoDeRetorno(false)`.

Guarda contra uma simplificação tentadora (mandar todo mundo para `/`) que reintroduziria o salto extra do INV-02.

---

## 6. O que o contrato proíbe

- **Reaproveitar esta página para falta de permissão.** `/sem-permissao` continua sendo a resposta de quem não tem role (FR-016). São mensagens diferentes porque são situações diferentes.
- **Alterar `rotas.ts` além de acrescentar `destinoDeRetorno`.** Nenhuma regra de `REGRAS_DE_ROTA`, `ROTA_PUBLICA` ou do `proxy.ts` muda para tornar a variante sem sessão mais visível (research.md, nota da spec).
- **Habilitar `experimental.globalNotFound`.** Rejeitado em research.md D2 — exigiria duplicar o root layout inteiro, tema incluído.
