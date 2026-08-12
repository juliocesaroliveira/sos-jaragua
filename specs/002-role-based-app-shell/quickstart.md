# Quickstart — Validação da Feature

**Feature**: Shell de Navegação por Perfil (Topbar + Sidebar)
**Data**: 2026-08-12

Roteiro para provar que a feature funciona ponta a ponta. Detalhes de contrato estão em [contracts/](./contracts/); a matriz de visibilidade está em [data-model.md](./data-model.md).

---

## Pré-requisitos

```bash
npm install
cp .env.example .env.local     # se ainda não existir
npm run db:migrate
```

**Contas de teste**: a validação exige uma conta por perfil. `db/seed.ts` as cria mediante **opt-in explícito** — defina `SEED_TESTE_PASSWORD` em `.env.local` (mínimo 8 caracteres) e rode o seed:

```bash
npm run db:seed
```

| E-mail | Perfil |
|--------|--------|
| `usuario@teste.local` | `usuario` |
| `voluntario@teste.local` | `voluntario` |
| `membro-defesa-civil@teste.local` | `membro_defesa_civil` |
| `coordenador@teste.local` | `coordenador` |
| `administrador@teste.local` | `administrador` |

Todas usam a senha de `SEED_TESTE_PASSWORD`. Sem essa variável o seed pula as contas e só faz o bootstrap normal — e o seed **recusa** rodar com `NODE_ENV=production`, porque são credenciais de senha conhecida, uma delas administradora.

```bash
npm run dev
```

---

## Nível 1 — Verificação automatizada

```bash
npm test          # unitários; inclui navegacao.test.ts
npm run lint
npx tsc --noEmit
```

**Esperado**: tudo verde. Em particular, `navegacao.test.ts` cobre as invariantes INV-01…INV-06 de [contracts/navegacao.md](./contracts/navegacao.md) — a matriz por perfil e a trava de consistência contra `REGRAS_DE_ROTA`.

`npm run test:integracao` **não** é exigido: a feature não toca fluxo transacional.

### Teste de fumaça do que mais importa

Se apenas um teste puder rodar, que seja INV-01. Ele é o que impede menu e autorização de divergirem — a falha silenciosa mais cara desta feature.

---

## Nível 2 — Presença do shell (User Story 1, SC-001/SC-002)

Para **cada** perfil, autentique e percorra as páginas acessíveis. Em todas: topbar visível com nome e rótulo do perfil, sidebar presente, ação de sair alcançável.

| Perfil | Páginas a percorrer |
|--------|---------------------|
| `usuario` | `/voluntariado/candidatura`, `/sem-permissao` |
| `voluntario` | `/voluntariado/minhas-atividades`, `/voluntariado/candidatura`, `/sem-permissao` |
| `membro_defesa_civil` | `/dashboard`, `/cadastros-pendentes`, `/voluntarios`, `/atividades`, `/crise`, `/estoque`, `/estoque/entrada`, `/estoque/saida`, `/voluntariado/minhas-atividades` |
| `coordenador` | todas as de `membro_defesa_civil` + `/estoque/kits`, `/estoque/descarte`, `/convocacao`, `/relatorios` |
| `administrador` | idênticas às de `coordenador` (ver [data-model.md](./data-model.md), observação 3) |

### Ausência do shell (SC-002)

Deslogado, confirme que **nenhuma** destas exibe o shell autenticado: `/login`, `/cadastro`, `/`.

> Se `/cadastro` e `/` redirecionarem para `/login` em vez de renderizar, isso é o comportamento *deny-by-default* pré-existente descrito em [research.md](./research.md) D1 — **não** uma regressão desta feature. Confirme que o comportamento é idêntico ao de antes da mudança.

### Preservação de URLs

Confirme que toda URL da tabela em [contracts/app-shell.md](./contracts/app-shell.md#preservação-de-urls) responde exatamente como antes. Route groups não alteram caminhos; qualquer 404 aqui é erro de movimentação de arquivo.

---

## Nível 3 — Itens por perfil (User Story 2, SC-003/SC-004)

Para cada perfil, compare a sidebar renderizada contra a matriz de [data-model.md](./data-model.md).

1. **Nada a menos**: todo destino marcado `✓` para o perfil aparece.
2. **Nada a mais**: nenhum destino não marcado aparece. Verificações-chave:
   - `membro_defesa_civil` **não** vê Kits, Descarte, Convocação, Relatórios.
   - `voluntario` **não** vê nenhum destino de gestão.
   - `coordenador`/`administrador` **não** veem "Quero ser voluntário".
3. **Sem becos sem saída (SC-004)**: clique em **todos** os itens visíveis do perfil. Nenhum pode resultar em `/sem-permissao` nem em 404.

### Item ativo (FR-014, G-09)

Navegue até `/estoque/kits` como coordenador. **Esperado**: apenas "Kits" destacado, com `aria-current="page"`. "Estoque" NÃO deve estar destacado simultaneamente — é a correspondência mais específica que vence, e este é o caso que o shell anterior errava.

---

## Nível 4 — Agrupamento (User Story 3, FR-026)

- Como `coordenador`: itens sob cabeçalhos de grupo em pt-BR, na ordem definida.
- Como `membro_defesa_civil`: os grupos "Coordenação" e "Administração" **não** aparecem — nenhum item visível neles.
- Como `usuario`: nenhum cabeçalho de grupo órfão.

---

## Nível 5 — Responsividade e acessibilidade (SC-007/SC-008)

**Em 360px de largura**, para pelo menos um perfil de staff e um voluntário:

- Sidebar recolhida por padrão; conteúdo principal legível **sem rolagem horizontal** (SC-008).
- Botão de menu na topbar abre e fecha a gaveta.
- Escolher um destino fecha a gaveta automaticamente (FR-022).

**Por teclado**, sem usar o mouse:

- `Tab` percorre topbar → sidebar → conteúdo, em ordem previsível, com foco sempre visível.
- Com a gaveta aberta, é possível sair dela pelo teclado — sem armadilha de foco (SC-007).
- Alvos de toque com ao menos 44px de altura (FR-024).

---

## Nível 6 — Sessão, perfil e casos de borda

### Sair de qualquer lugar (SC-005)

De qualquer página autenticada, como qualquer perfil: sair em no máximo dois cliques → redireciona a `/login` → **voltar no navegador não** revela conteúdo autenticado (validação do `router.refresh()`).

### Sessão expirada (FR-027)

1. Autentique como `coordenador`.
2. Expire a sessão (aguarde o timeout de inatividade, ou invalide a linha em `session`).
3. Clique num item do menu.

**Esperado**: redireciona a `/login?redirecionar=<destino>`; após reautenticar, chega ao destino pretendido — não ao painel padrão.

### Mudança de perfil em sessão (caso de borda da spec)

1. Autentique como `usuario` com candidatura pendente. Menu mostra apenas destinos pessoais.
2. Em outra sessão, como `coordenador`, aprove a candidatura (`usuario` → `voluntario`).
3. Na sessão original, navegue para qualquer página.

**Esperado**: "Minhas atividades" aparece no menu **sem logout manual**. Dado derivado de sessão não é cacheado, então a primeira navegação já reflete o novo perfil.

### Sino de notificações (FR-008, research.md D5)

Como `voluntario` com ao menos uma notificação não lida: o sino aparece na topbar com o contador correto. A decisão D5 é deliberada — voluntários recebem lembretes de turno e portanto veem o sino.

---

## Nível 7 — Performance (SC-009)

Compare a primeira renderização útil de `/estoque` e `/dashboard` antes e depois da mudança, em build de produção:

```bash
npm run build && npm run start
```

**Esperado**: sem regressão perceptível. O shell não adiciona consulta ao banco no caminho de render; as duas consultas de notificação são indexadas por usuário, disparadas em paralelo, no mesmo layout que já lê a sessão.

**Atenção**: essas consultas agora rodam para **todos** os perfis, não só staff (D5). Se surgir regressão, é aqui que ela aparece primeiro.

---

## Critérios de conclusão

| # | Critério | Nível |
|---|----------|-------|
| SC-001 | 100% das páginas autenticadas com topbar + sidebar | 2 |
| SC-002 | 0% das páginas não autenticadas com shell | 2 |
| SC-003 | Itens conferem exatamente com a matriz, nos 5 perfis | 1, 3 |
| SC-004 | 0% dos itens visíveis levam a negativa ou 404 | 3 |
| SC-005 | Sair em ≤2 cliques de qualquer página | 6 |
| SC-006 | Qualquer destino permitido em ≤2 cliques | 3 |
| SC-007 | Menu operável por teclado, sem armadilha de foco | 5 |
| SC-008 | 360px sem rolagem horizontal | 5 |
| SC-009 | Sem regressão na primeira renderização útil | 7 |
