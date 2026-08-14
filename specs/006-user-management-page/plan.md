# Implementation Plan: Gestão de Usuários

**Branch**: `006-user-management-page` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-user-management-page/spec.md`

## Summary

`REGRAS_DE_ROTA` já reserva `/admin` para `administrador` desde antes desta feature ("Gestão de usuários/permissões") e `navegacao.ts` já reserva o grupo `administracao`, ainda vazio — esta feature é o momento de ocupar os dois. A página vive em `app/(interno)/(staff)/admin/page.tsx`, com uma listagem paginada server-side (mesmo contrato de `listarVoluntarios`) e um único `Dialog` (já responsivo — folha em mobile, modal em desktop, sem precisar de um `Drawer` separado) reaproveitado para cadastro e edição, com `react-hook-form` + Zod no mesmo padrão do único formulário existente do projeto (`candidatura-form.tsx`).

No módulo `identidade` (hoje só um scaffold de tipos de domínio), esta feature constrói: um port `UsuarioRepository` consolidando a leitura/escrita de `user.role` que hoje vive duplicada dentro de `voluntariado` (`AprovarCandidaturaUseCase`); dois casos de uso (`CriarUsuarioUseCase`, `EditarUsuarioUseCase`); e as Server Actions/queries de apresentação. Criar conta com senha usa `auth.api.signUpEmail` do próprio better-auth (que já hasheia a senha) seguido de uma atualização de `role`, já que `role` é `additionalField` com `input: false` em `auth.ts`.

## Technical Context

**Language/Version**: TypeScript estrito, React 19.1, Next.js 16.3 (App Router, Turbopack, Cache Components)

**Primary Dependencies**: `react-hook-form` 7.85 + `@hookform/resolvers` 5.7 (zodResolver) — já dependências instaladas, usadas por esta feature pela segunda vez no projeto; `@tanstack/react-table` (via `Table`/`Pagination` já existentes); `better-auth` 1.6 (`auth.api.signUpEmail`); Drizzle ORM. Nenhuma dependência nova.

**Storage**: Neon Postgres — tabela `user` já existente (`db/schema/identidade.ts`), sem migração nova.

**Testing**: Vitest — TDD em `CriarUsuarioUseCase`/`EditarUsuarioUseCase` e no mapeamento de erro de e-mail duplicado (`application`, Princípio III); teste de integração (`test:integracao`) para o fluxo real `signUpEmail` + `atualizarRole` contra o Neon de teste, análogo a `aprovar-candidatura.integracao.test.ts`. Sem teste de componente (mesmo carve-out de `004`/`005` — projeto não tem `@testing-library/react`).

**Target Platform**: Web responsivo (mobile-first, 360px+), Vercel

**Project Type**: Monolito modular Next.js — módulo `identidade` (todas as camadas) + presentation em `app/(interno)/(staff)/admin/`

**Performance Goals**: Paginação server-side obrigatória (NFR §2.1) — nenhuma consulta retorna a base inteira de contas.

**Constraints**: pt-BR; tema claro/escuro; acesso restrito a `administrador` (defesa em profundidade: `(staff)/layout.tsx` + `exigirAcessoA('/admin')` + revalidação de role em cada Server Action); senha nunca editável fora do cadastro (FR-010); sem restrição sobre quais roles podem ser atribuídas (Assumptions).

**Scale/Scope**: 1 rota nova, 1 port + 1 implementação Drizzle (consolidando uma duplicata existente), 2 casos de uso, 1 query paginada, 2 Server Actions, 1 componente de formulário reaproveitado em 2 modos, 1 item de navegação novo. Nenhuma migração de schema.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio                                  | Avaliação                                                                                                                                                                                                                                                                                                                                                                | Veredito                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| **I. Clean Architecture por Módulo**       | Toda a lógica nova vive em `identidade/{domain,application,infrastructure,presentation}` — o módulo dono da tabela `user`. `voluntariado` deixa de ter uma cópia própria de `UserRepository` e passa a importar o port de `identidade` (research.md D6), **reduzindo** uma violação existente do princípio em vez de criar uma nova.                                     | ✅ PASS                                                                            |
| **II. Tipagem Estrita e Qualidade**        | Sem `any`. Reaproveita `Role`/`ROLES` já tipados. Interface 100% pt-BR (labels, mensagens de erro).                                                                                                                                                                                                                                                                      | ✅ PASS                                                                            |
| **III. Testes em Regras de Negócio**       | `CriarUsuarioUseCase`/`EditarUsuarioUseCase` são regra de negócio nova (quem pode ter qual papel, unicidade de e-mail) — TDD obrigatório, cobertos por Vitest. `presentation`/`infrastructure` seguem finos por desenho, validados por contrato.                                                                                                                         | ✅ PASS                                                                            |
| **IV. Segurança e Defesa em Profundidade** | Ponto central da feature: acesso restrito a `administrador` em duas camadas (`(staff)/layout.tsx` + `exigirAcessoA` + revalidação nas Server Actions), espelhando o padrão já usado por `/crise`/`/relatorios`. Senha nunca é lida de volta nem editável após o cadastro (FR-010). Criação de conta usa o hashing do próprio better-auth, não uma implementação própria. | ✅ PASS                                                                            |
| **V. Auditoria Não Bloqueante**            | Criar conta e editar nome/role são escritas sensíveis em Identidade — devem passar por `withAudit`, mesmo padrão de `AprovarCandidaturaUseCase` (que já grava auditoria para mudança de `role`).                                                                                                                                                                         | ✅ PASS (a confirmar na Phase 1 que os dois novos casos de uso chamam `withAudit`) |
| **VI. Simplicidade Operacional**           | Zero dependência nova (nem plugin `admin` do better-auth, nem hook de `matchMedia` para `Dialog`/`Drawer`). A consolidação do `UserRepository` (D6) remove duplicação em vez de adicionar abstração.                                                                                                                                                                     | ✅ PASS                                                                            |

**Gate pós-desenho (Phase 1)**: reavaliado ao fim deste documento.

## Project Structure

### Documentation (this feature)

```text
specs/006-user-management-page/
├── plan.md               # Este arquivo
├── research.md           # Phase 0 — decisões D1..D8
├── data-model.md         # Phase 1 — Conta de usuário (sem coluna nova), LinhaUsuario
├── quickstart.md         # Phase 1 — roteiro de validação manual
├── contracts/
│   └── gestao-usuarios.md  # Garantias A/L/C/E/R
├── checklists/
│   └── requirements.md   # Já gerado por /speckit-specify
└── tasks.md               # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

`+` novo, `~` alterado, `→` movido.

```text
app/(interno)/(staff)/admin/
├── page.tsx                   # + Server Component: exigirAcessoA('/admin'), lê searchParams,
│                              #   chama listarUsuarios, Suspense + SkeletonLista
├── tabela-usuarios.tsx        # + Client: Table + Pagination (mesmo padrão de tabela-voluntarios.tsx),
│                              #   coluna de ações (editar) abre UsuarioFormDialog em modo "editar";
│                              #   botão "Nova conta" abre em modo "criar"
└── usuario-form-dialog.tsx    # + Client: Dialog (responsivo, research.md D3) + react-hook-form,
                               #   dois modos (criar/editar), chama criarUsuario/editarUsuario

src/modules/identidade/
├── application/
│   ├── ports/
│   │   └── usuario-repository.ts   # + UsuarioRepository (research.md D6, substitui
│   │                               #   voluntario-repository.ts#UserRepository)
│   └── use-cases/
│       ├── criar-usuario.ts        # + CriarUsuarioUseCase — signUpEmail + atualizarRole + withAudit
│       ├── criar-usuario.test.ts   # +
│       ├── editar-usuario.ts       # + EditarUsuarioUseCase — atualizarNomeERole + withAudit
│       └── editar-usuario.test.ts  # +
├── infrastructure/
│   └── drizzle/
│       └── usuario-repository.ts   # + implementação Drizzle (movida de voluntario-repository.ts)
└── presentation/
    ├── queries/
    │   └── usuarios.ts             # + listarUsuarios (research.md D7, mesmo contrato de
    │                               #   listarVoluntarios)
    └── actions/
        └── usuarios.ts             # + criarUsuario, editarUsuario (Server Actions)

src/modules/voluntariado/
├── application/ports/voluntario-repository.ts   # ~ remove UserRepository local; importa
│                                                 #   UsuarioRepository de identidade
└── infrastructure/drizzle/voluntario-repository.ts  # ~ remove criarUserRepository local;
                                                      #   unidadeDeTrabalho passa a compor com a
                                                      #   implementação de identidade

src/shared/
├── auth/navegacao.ts       # ~ + item '/admin' no grupo 'administracao' (research.md D2)
└── cache/tags.ts           # ~ + identidadeListagem: 'identidade:listagem'
```

**Structure Decision**: `identidade` deixa de ser um scaffold vazio e passa a ter as quatro camadas povoadas, na mesma convenção dos outros módulos (`voluntariado`, `estoque`). Nenhuma pasta fora dessa convenção é criada.

As três escolhas que importam:

1. **`identidade`, não um módulo novo "administracao".** A regra de negócio é sobre contas de usuário — pertence ao bounded context que já existe para isso, não a um módulo nomeado pela tela que o consome.
2. **Consolidar em vez de duplicar (research.md D6).** `voluntariado` já tinha a metade da capacidade que esta feature precisa (`atualizarRole`); mover essa metade para `identidade` e apontar `voluntariado` para lá é o caminho que reduz duplicação, não o que a mantém intacta "para não arriscar".
3. **`signUpEmail` + atualização de role, não um plugin novo.** Ver research.md D5 — o ganho de instalar o plugin `admin` do better-auth só para este caso de uso não paga a complexidade nova.

## Complexity Tracking

> Preenchido apenas se o Constitution Check tiver violações a justificar.

Sem violações. A consolidação do `UserRepository` (D6) toca um módulo existente (`voluntariado`) além do módulo desta feature — registrado aqui não como violação, mas como escopo de refatoração explícito: é reversível, coberto pelo teste de integração já existente daquele módulo, e motivado pelo mesmo princípio (I) que o Constitution Check verifica.

## Constitution Re-Check (pós Phase 1)

- **III** — `criar-usuario.test.ts`/`editar-usuario.test.ts` cobrem a regra de negócio nova (unicidade de e-mail, ausência de restrição de role); `contracts/gestao-usuarios.md` isola o restante como contrato de apresentação. ✅
- **IV** — o contrato (`A-01`..`A-03`) fixa a checagem em duas camadas mais a revalidação por Server Action; nenhuma rota nova escapa de `REGRAS_DE_ROTA`. ✅
- **V** — pendente confirmar na implementação que `CriarUsuarioUseCase`/`EditarUsuarioUseCase` chamam `withAudit`, como `AprovarCandidaturaUseCase` já faz — registrado como tarefa, não como violação. ⚠️ verificar no `/speckit-tasks`.
- **VI** — zero dependência nova; D6 remove superfície duplicada em vez de somar. ✅

Gate mantido: **PASS**, com um item de verificação explícito para a fase de tasks (auditoria nos dois casos de uso novos).

## Riscos e Pontos de Atenção

1. **Falha parcial entre `signUpEmail` e `atualizarRole` (research.md D5).** As duas escritas não compartilham transação Postgres — se a segunda falhar após a primeira ter sucesso, a conta existe com o papel padrão. A Server Action precisa distinguir esse caso de uma falha total e orientar a correção via edição (contrato C-05), não apresentar como se nada tivesse sido criado.
2. **Migração do `UserRepository` não pode regredir `aprovar-candidatura.integracao.test.ts`.** O teste de integração existente referencia o caminho atual de `voluntariado`; a consolidação (D6) precisa manter esse teste verde, ajustando só o import, não o comportamento.
3. **Ambiente de validação manual.** Como em `004-sticky-topbar`/`005-mobile-menu-panel`, o roteiro de `quickstart.md` depende de sessão autenticada contra um banco acessível — confirmar que a conectividade com o Neon já foi restabelecida antes de validar esta feature manualmente.
4. **Dados sensíveis em auditoria.** `withAudit` para `CriarUsuarioUseCase` precisa registrar a criação sem incluir a senha em texto claro nos dados de auditoria (`dadosNovos`) — só campos não sensíveis (nome, e-mail, role).
