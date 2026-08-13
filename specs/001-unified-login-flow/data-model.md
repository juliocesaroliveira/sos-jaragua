# Phase 1 Data Model: Fluxo Unificado de Login

Esta feature não introduz nenhuma tabela, migration ou entidade de domínio nova — reutiliza
`user`/`session`/`account` do better-auth (já existentes, ver DESIGN.md §6.1). O que muda é
uma estrutura de configuração (mapa de classificação de rotas) e o estado de UI da página de
login. Ambos são documentados abaixo como os "dados" desta feature.

## 1. Classificação de Rota (config, não persistida)

Estrutura em `src/shared/auth/rotas.ts`, consultada por `proxy.ts` a cada requisição.

| Campo           | Tipo                      | Descrição                                                                                                                                                                      |
| --------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pathname`      | `string`                  | Path da requisição atual (`request.nextUrl.pathname`).                                                                                                                         |
| `publica`       | `boolean`                 | Derivado: `true` somente para `/login` (e prefixos técnicos isentos do matcher, como `/api/auth/*`, tratados fora deste mapa).                                                 |
| `rolesExigidas` | `readonly Role[] \| null` | Quando a rota exige papel específico além de "ter sessão válida" (ex.: `/estoque/descarte` → `coordenador \| administrador`). `null` significa "qualquer sessão válida basta". |

**Regra de resolução** (substitui a atual `rolesExigidas(pathname): Role[] | null`):

1. Se `pathname` é `/login` → pública, nenhuma checagem de sessão.
2. Caso contrário → sessão válida é obrigatória.
3. Se a rota casar com uma entrada de `REGRAS_DE_ROTA` (mantida como está hoje) → a role do
   usuário também precisa estar na lista; senão, redireciona para `/sem-permissao`.
4. Se não casar com nenhuma entrada de `REGRAS_DE_ROTA` → qualquer sessão válida (qualquer
   role) é suficiente — este é o novo comportamento para rotas hoje "públicas" como `/`,
   `/cadastro`, `/voluntariado/candidatura`, `/design-system`, `/sem-permissao`.

**Invariante**: a lista de rotas explicitamente públicas tem exatamente 1 entrada de
navegação (`/login`). Adicionar uma segunda rota pública de navegação é uma decisão de
produto que exige atualização explícita desta spec/feature, não um efeito colateral de outra
mudança.

## 2. Estado de UI da Página de Login (client-side, não persistido)

Estado local do componente `login-form.tsx`.

| Campo              | Tipo                             | Valores   | Descrição                                                                                                                                                                                 |
| ------------------ | -------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modo`             | `'opcoes' \| 'credenciais'`      | —         | `'opcoes'` = estado inicial (3 botões); `'credenciais'` = formulário de usuário/senha + Voltar/Acessar. Estado efêmero, resetado a cada carregamento da página (FR-011, edge case de F5). |
| `carregandoSocial` | `'google' \| 'facebook' \| null` | já existe | Inalterado — indica qual provedor social está em andamento.                                                                                                                               |
| `erroServidor`     | `string \| null`                 | já existe | Inalterado — mensagem de erro genérica de credenciais inválidas (FR-009) ou falha ao iniciar OAuth.                                                                                       |

**Transições**:

- `opcoes` → `credenciais`: clique em "Usar usuário e senha" (FR-006).
- `credenciais` → `opcoes`: clique em "Voltar" (FR-007); campos de usuário/senha são
  descartados (não preservados ao voltar).
- `credenciais` → `credenciais` (permanece): submissão com campo vazio (bloqueada no
  client, FR-010) ou credenciais inválidas (FR-009, mensagem de erro exibida).
- Nenhuma transição altera a URL (FR-011).
