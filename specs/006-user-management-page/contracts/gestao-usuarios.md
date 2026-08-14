# Contrato — Gestão de Usuários

**Módulos**: `app/(interno)/(staff)/admin/`, `src/modules/identidade/{application,infrastructure,presentation}/`, `src/shared/auth/{rotas.ts,navegacao.ts}` (sem alteração de regra, só leitura confirmada), `src/shared/cache/tags.ts`

---

## 1. Acesso — `/admin`

| Garantia | Descrição                                                                                                                                                                                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01     | Só sessões com `role = 'administrador'` acessam `/admin` — via `(staff)/layout.tsx` (sessão + `ROLES_STAFF`) seguido de `exigirAcessoA('/admin')` na própria página, que aplica `REGRAS_DE_ROTA['/admin'] = ['administrador']` (já existente, não criado por esta feature). |
| A-02     | O item de navegação para `/admin` só aparece no menu de contas com `role = 'administrador'` (`ItemNavegacao.roles`, `navegacao.ts`).                                                                                                                                        |
| A-03     | Toda Server Action de escrita (criar/editar) revalida a sessão e a role **de novo**, independentemente do gate de página — Server Actions não herdam automaticamente o gate de um Server Component (mesmo padrão de `triagem.ts`).                                          |

## 2. Listagem — `listarUsuarios`

```ts
type FiltrosUsuarios = { page: number; pageSize: number }
type LinhaUsuario = { id: string; nome: string; email: string; role: Role; criadoEm: string }

function listarUsuarios(filtros: FiltrosUsuarios): Promise<{ rows: LinhaUsuario[]; totalCount: number }>
```

| Garantia | Descrição                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| L-01     | Paginação **server-side** — a função nunca retorna mais que `pageSize` linhas (FR-002).                                                    |
| L-02     | `totalCount` reflete o total real de contas, independente da página pedida — é o que a `Pagination` usa para calcular o número de páginas. |
| L-03     | Cobre contas de **todos** os papéis, não só staff (Assumptions da spec).                                                                   |

## 3. Cadastro — `criarUsuario` (Server Action)

```ts
type EntradaCriarUsuario = { nome: string; email: string; senha: string; role: Role }
function criarUsuario(entrada: EntradaCriarUsuario): Promise<ResultadoAction<{ id: string }>>
```

| Garantia | Descrição                                                                                                                                                                                                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01     | Rejeita e-mail já cadastrado, com mensagem de campo específica (`email`), sem criar linha duplicada (FR-006).                                                                                                                                                                      |
| C-02     | Rejeita entrada com campo obrigatório ausente ou senha abaixo do mínimo, sem chamar `signUpEmail` (FR-007).                                                                                                                                                                        |
| C-03     | A senha nunca é logada, auditada em texto claro, nem devolvida na resposta — só usada para a chamada a `auth.api.signUpEmail`.                                                                                                                                                     |
| C-04     | Em caso de sucesso, invalida a tag `identidade:listagem` — a nova conta aparece na listagem sem recarregar a página (FR-011).                                                                                                                                                      |
| C-05     | Se `signUpEmail` tiver sucesso mas a atualização de `role` falhar, a resposta é um aviso distinto de "falha total": a conta existe (com papel padrão `usuario`), e a mensagem orienta corrigir via edição — nunca um estado "conta não existe" quando ela existe (research.md D5). |

## 4. Edição — `editarUsuario` (Server Action)

```ts
type EntradaEditarUsuario = { id: string; nome: string; role: Role }
function editarUsuario(entrada: EntradaEditarUsuario): Promise<ResultadoAction<{ id: string }>>
```

| Garantia | Descrição                                                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| E-01     | Só aceita `nome` e `role` — não existe campo de e-mail ou senha nesta entrada, por construção do tipo (FR-010).                     |
| E-02     | Não há restrição sobre qual `role` pode ser atribuída, incluindo a própria conta de quem edita (Assumptions da spec, Q2).           |
| E-03     | Em caso de sucesso, invalida a tag `identidade:listagem` (FR-011).                                                                  |
| E-04     | Formulário de edição chega pré-preenchido com os dados atuais da conta (nome, role) — nunca em branco (US3, Acceptance Scenario 1). |

## 5. `UsuarioRepository` (consolidado em `identidade`, research.md D6)

```ts
interface UsuarioRepository {
    listar(filtros: { page: number; pageSize: number }): Promise<{ rows: LinhaUsuario[]; totalCount: number }>
    atualizarNomeERole(userId: string, dados: { nome: string; role: Role }): Promise<void>
    buscarRole(userId: string): Promise<Role | null>
}
```

| Garantia | Descrição                                                                                                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01     | Única implementação Drizzle de leitura/escrita em `user.role` no projeto — `voluntariado` (`AprovarCandidaturaUseCase`) passa a importar esta implementação em vez de manter uma cópia local.               |
| R-02     | `atualizarNomeERole` atualiza as duas colunas juntas — não existem dois métodos separados que poderiam ser chamados de forma inconsistente (ex.: atualizar nome sem role, deixando a UI a decidir a ordem). |

---

## 6. O que este contrato NÃO exige

- Nenhuma mudança em `REGRAS_DE_ROTA`/`proxy.ts` — a regra de `/admin` já existe.
- Nenhum campo novo em `db/schema/identidade.ts`.
- Nenhuma ação de excluir/desativar conta (fora de escopo, Assumptions da spec).
- Nenhum plugin novo do better-auth (`admin`, etc.) — `signUpEmail` + atualização de `role` bastam (research.md D5).

## 7. O que este contrato proíbe

- Expor ou aceitar `senha` no formulário/Server Action de edição.
- Implementar hashing de senha manualmente em vez de `auth.api.signUpEmail`.
- Criar uma segunda implementação de leitura/escrita de `user.role` fora de `identidade` (ex.: uma nova cópia dentro deste próprio módulo de gestão de usuários, paralela à de `voluntariado`) — a consolidação do research.md D6 é parte do contrato, não opcional.
