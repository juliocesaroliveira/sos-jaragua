# Phase 1 — Modelo de Dados

**Feature**: Shell de Navegação por Perfil (Topbar + Sidebar)
**Data**: 2026-08-12

> **Nenhuma tabela é criada, alterada ou removida.** Esta feature não persiste nada. As entidades abaixo são estruturas em memória, definidas em código e resolvidas a cada render — o "modelo de dados" aqui é o contrato do registro de navegação.

---

## Entidades

### `ItemNavegacao`

Um destino apresentável no menu lateral.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `href` | `string` | sim | Caminho público do destino. MUST corresponder a uma página existente em `app/`. |
| `rotulo` | `string` | sim | Texto exibido, em pt-BR. |
| `icone` | `NomeIcone` | sim | **Identificador** de ícone, não JSX — mantém o registro serializável e testável sem React (research.md D7). |
| `grupo` | `IdGrupo` | sim | Grupo de pertencimento. |
| `roles` | `readonly Role[]` | sim | Perfis que enxergam o item. Declaração explícita e obrigatória (FR-021). |

**Regras de validação** (verificadas por teste, não em runtime):

- `roles` NUNCA é vazio — item invisível a todos não tem razão de existir.
- `roles` contém apenas valores de `ROLES` (garantido pelo tipo).
- Se `rolesExigidas(href)` retorna uma regra, `roles` MUST ser **idêntico** ao conjunto da regra — igualdade, não subconjunto (research.md D3).
- `href` MUST resolver para uma página existente (research.md D4).
- `href` é único no registro.

**O que esta entidade NÃO é**: uma concessão de permissão. `roles` decide **exibição**. O acesso continua decidido por `proxy.ts` + `exigirRoles`, e permanece aplicado mesmo para um destino alcançado por URL direta (FR-015).

---

### `GrupoNavegacao`

Agrupamento nomeado, existente apenas para legibilidade do menu.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `IdGrupo` | Chave estável usada por `ItemNavegacao.grupo`. |
| `rotulo` | `string` | Cabeçalho exibido, em pt-BR. |
| `ordem` | `number` | Posição relativa no menu. |

`IdGrupo` ∈ `'pessoal' | 'voluntariado' | 'operacao' | 'estoque' | 'coordenacao' | 'administracao'`

**Regras**:

- Um grupo NÃO carrega roles próprias. Sua visibilidade é derivada: aparece se e somente se ao menos um item visível ao perfil atual pertence a ele (FR-026, research.md D6).
- Grupos são renderizados em ordem crescente de `ordem`; itens preservam a ordem de declaração dentro do grupo.

---

### `Ator` (reaproveitado — não é novo)

Já existe como `SessaoAtor` em `src/shared/auth/sessao.ts`. O shell consome apenas quatro campos:

| Campo | Uso no shell |
|-------|--------------|
| `role` | Filtragem dos itens; rótulo do perfil na topbar. |
| `nome` | Identificação na topbar e iniciais do avatar. |
| `userId` | Consulta de notificações (slot da topbar). |
| — | `email`, `ativo`, `sessionToken` **não** são usados pelo shell. |

Origem obrigatória: `auth.api.getSession` no servidor. Nunca de props do cliente, query string ou estado local (FR-010).

---

## Matriz de visibilidade (FR-016 … FR-020)

Estado alvo do registro. `✓` = item aparece no menu daquele perfil.

| Grupo | Destino | `usuario` | `voluntario` | `membro_defesa_civil` | `coordenador` | `administrador` |
|-------|---------|:---:|:---:|:---:|:---:|:---:|
| Pessoal | `/voluntariado/candidatura` | ✓ | ✓ | | | |
| Voluntariado | `/voluntariado/minhas-atividades` | | ✓ | ✓ | ✓ | ✓ |
| Operação | `/dashboard` | | | ✓ | ✓ | ✓ |
| Operação | `/cadastros-pendentes` | | | ✓ | ✓ | ✓ |
| Operação | `/voluntarios` | | | ✓ | ✓ | ✓ |
| Operação | `/atividades` | | | ✓ | ✓ | ✓ |
| Operação | `/crise` | | | ✓ | ✓ | ✓ |
| Estoque | `/estoque` | | | ✓ | ✓ | ✓ |
| Estoque | `/estoque/entrada` | | | ✓ | ✓ | ✓ |
| Estoque | `/estoque/saida` | | | ✓ | ✓ | ✓ |
| Estoque | `/estoque/kits` | | | | ✓ | ✓ |
| Estoque | `/estoque/descarte` | | | | ✓ | ✓ |
| Coordenação | `/convocacao` | | | | ✓ | ✓ |
| Coordenação | `/relatorios` | | | | ✓ | ✓ |
| Administração | *(nenhum ainda — research.md D4)* | | | | | |

### Leitura da matriz — três observações necessárias

1. **`/voluntariado/minhas-atividades` inclui staff.** Não é generosidade: `REGRAS_DE_ROTA` já concede essa rota a `voluntario`, `membro_defesa_civil`, `coordenador` e `administrador`. A trava de igualdade de D3 **exige** que a linha reflita a regra. Divergir aqui quebraria o teste.

2. **`/voluntariado/candidatura` não tem regra em `REGRAS_DE_ROTA`** — a trava de igualdade não se aplica, e as roles são declaradas por decisão de produto: quem já é staff não se candidata a voluntário pelo menu. Este é precisamente o caso que `podeAcessar` sozinho decidiria errado (research.md D3).

3. **`administrador` tem menu idêntico a `coordenador` hoje.** Consequência esperada de D4 — a área de administração não existe. O grupo "Administração" está definido e vazio, pronto para receber a primeira linha sem qualquer mudança estrutural.

---

## Funções derivadas

Todas puras, sem I/O, testáveis em `npm test`.

### `itensDeNavegacao(role: Role): readonly ItemNavegacao[]`

Retorna os itens visíveis ao perfil, na ordem de declaração. Pode retornar array vazio (caso de borda tratado pelo shell: menu não renderizado, topbar mantida).

### `gruposVisiveis(itens): readonly { grupo: GrupoNavegacao; itens: ItemNavegacao[] }[]`

Agrupa os itens já filtrados e descarta grupos vazios por construção. Ordena por `GrupoNavegacao.ordem`.

### `itemAtivo(pathname, itens): ItemNavegacao | undefined`

Determina o item correspondente à página atual (FR-014). Usa **correspondência mais específica**, não a primeira que casar — `/estoque/kits` deve ativar "Kits", não "Estoque". O shell atual usa `pathname.startsWith(href)` sobre a primeira correspondência, que ativaria dois itens simultaneamente para rotas aninhadas de estoque; a versão nova resolve pelo `href` mais longo que case.

---

## Transições de estado

A única transição relevante é a **mudança de perfil durante a sessão** (caso de borda da spec): quando uma candidatura é aprovada, `user.role` passa de `usuario` a `voluntario`.

O menu não guarda estado próprio — é derivado da role a cada render de layout, no servidor. Como `(interno)/layout.tsx` lê a sessão a cada navegação e o segmento é `instant = false`, a primeira navegação após a mudança já produz o menu novo. Nenhuma invalidação de cache é necessária: dado derivado de sessão nunca é cacheado (DESIGN.md §7).
