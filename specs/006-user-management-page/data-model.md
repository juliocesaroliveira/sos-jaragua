# Data Model: Gestão de Usuários

**Feature**: [spec.md](./spec.md)

## Entidades

### Conta de usuário (`user`, já existente — `db/schema/identidade.ts`)

Nenhuma coluna nova. A feature só expõe uma superfície de administração sobre colunas que já existem:

| Campo       | Tipo              | Uso nesta feature                                                                                                                                                             |
| ----------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | `text` (PK)       | Identificador da linha na listagem e do formulário de edição.                                                                                                                 |
| `name`      | `text`            | Exibido na listagem; editável no cadastro e na edição.                                                                                                                        |
| `email`     | `text`, único     | Exibido na listagem; definido só no cadastro — **não editável** (FR-010).                                                                                                     |
| `role`      | enum (`ROLES_DB`) | Exibido na listagem; definido no cadastro e editável na edição. Sem restrição de valor (Assumptions da spec — qualquer papel, incluindo `administrador`, pode ser atribuído). |
| `ativo`     | `boolean`         | Não tocado por esta feature (sem ação de desativar — Assumptions da spec). Poderia aparecer na listagem como informação, mas não é obrigatório.                               |
| `createdAt` | `timestamp`       | Candidata a coluna complementar da listagem (Assumptions da spec — não obrigatória).                                                                                          |

A senha (`account.password`, hash) nunca é lida nem exibida por esta feature — só escrita, indiretamente, via `auth.api.signUpEmail` no cadastro (research.md D5). Não há campo de senha na edição (FR-010).

### `LinhaUsuario` (novo tipo de apresentação, não uma tabela)

```ts
type LinhaUsuario = {
    id: string
    nome: string
    email: string
    role: Role
    criadoEm: string // ISO
}
```

Retornado por `listarUsuarios` (`identidade/presentation/queries/usuarios.ts`), espelhando `LinhaVoluntario` de `voluntariado/presentation/queries/candidaturas.ts`.

## Regras de validação (camada de apresentação, revalidadas no domínio/aplicação)

| Campo                 | Regra                                                                                                                                               | Onde                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `nome`                | Obrigatório, não vazio                                                                                                                              | Zod no formulário + Server Action                                                          |
| `email` (só cadastro) | Obrigatório, formato de e-mail, único (`user.email` já tem `unique()` no schema — a violação de unicidade é capturada e traduzida em erro de campo) | Zod (formato) + `CriarUsuarioUseCase` (unicidade, via erro do better-auth)                 |
| `senha` (só cadastro) | Obrigatório, mínimo de 8 caracteres (mesmo mínimo já configurado em `auth.ts`, `emailAndPassword.minPasswordLength`)                                | Zod no formulário; o mínimo real é reforçado pelo próprio `signUpEmail`                    |
| `role`                | Obrigatório, um dos valores de `ROLES`                                                                                                              | Zod (enum) — sem restrição adicional de quais valores são permitidos (Assumptions da spec) |

## Transições de estado

Nenhuma máquina de estados nova. `role` já é um campo de valor livre dentro do enum (não uma máquina com transições proibidas, como `voluntario_perfil.status`) — qualquer valor pode suceder qualquer outro, por decisão explícita do stakeholder (Q2 da spec).
