# Implementation Plan: Redefinição de senha e e-mail somente leitura na edição de conta

**Branch**: `008-admin-password-reset` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-admin-password-reset/spec.md`

## Summary

Mostrar o e-mail como campo desabilitado na edição de conta em `/admin`, e acrescentar ao rodapé do diálogo uma ação "Trocar Senha" que revela um campo de senha — exibida apenas para contas com senha própria, nunca para contas de Google/Facebook.

Abordagem técnica (detalhada em [research.md](./research.md)): a redefinição usa `auth.$context` do better-auth (`password.hash` + `internalAdapter.updatePassword`), que é exatamente o que o plugin oficial `admin` faz internamente, sem trazer o modelo de papéis conflitante desse plugin. A distinção "tem senha própria" sai de `account.providerId = 'credential'`, dado que a tabela já guarda, exposto como o booleano derivado `podeTrocarSenha`. Nome, papel e senha viajam numa única Server Action e são aplicados por `EditarUsuarioUseCase`, na ordem senha → papel, para satisfazer o tudo-ou-nada de FR-015.

## Technical Context

**Language/Version**: TypeScript estrito, React 19, Next.js 16 (App Router, `cacheComponents: true`)

**Primary Dependencies**: better-auth ^1.6.26 (`auth.$context`, `internalAdapter`), Drizzle ORM, react-hook-form + zodResolver, Zod (`@/src/shared/validacao/zod-ptbr`), design system próprio (`Dialog`, `Input`, `Button`)

**Storage**: Neon Postgres — tabelas `user` e `account` (existentes, **sem migração**); MongoDB para o log de auditoria (existente)

**Testing**: Vitest (`npm test` unitário sobre `domain`/`application`; `npm run test:integracao` contra o Neon real)

**Target Platform**: Web responsivo, área `(staff)` restrita a `administrador`, pt-BR

**Performance Goals**: redefinição concluída dentro do tempo de um envio de formulário comum (< 1s percebido); a coluna derivada não pode regredir a listagem de `/admin`

**Constraints**: hash de senha **sempre** delegado ao better-auth, nunca implementado aqui; senha nunca aparece em resposta, log ou auditoria; nenhuma dependência nova (Princípio VI); o plugin `admin` do better-auth é incompatível com o modelo de papéis do projeto

**Scale/Scope**: 1 tela (`/admin`), 1 módulo (`identidade`), ~8 arquivos tocados, 0 migrações

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio                                             | Gate                                                                                                                                                                                                                                                                            | Status                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| I. Clean Architecture por Módulo                      | A regra "só redefine quem tem senha própria" vive em `application` (caso de uso), não na tela; `definirSenha` entra como port implementado em `infrastructure/better-auth`; `presentation` só valida e chama. Identidade continua sendo o único módulo a tocar `user`/`account` | ✅ PASS                     |
| II. Tipagem Estrita e Qualidade                       | Sem `any`; senha como campo opcional tipado, não `Record<string, unknown>`; mensagens em pt-BR; Conventional Commits                                                                                                                                                            | ✅ PASS                     |
| III. Testes de Regra de Negócio                       | A regra nova é de `application` — **exige teste** (TDD): redefinir em conta sem senha própria deve falhar; sem `novaSenha`, a senha não é tocada; ordem senha → papel                                                                                                           | ✅ PASS (teste obrigatório) |
| IV. Segurança e Defesa em Profundidade                | `editarUsuario` já revalida sessão e exige `administrador`; a ausência do botão **não** é a proteção (FR-013 é checada no servidor); e-mail rejeitado pelo schema mesmo se forjado; sessões da conta afetada encerradas                                                         | ✅ PASS                     |
| V. Auditoria Não Bloqueante                           | Reusa o `withAudit` já presente no caso de uso; marca `senhaRedefinida: true` sem o valor; falha de auditoria não desfaz a operação                                                                                                                                             | ✅ PASS                     |
| VI. Simplicidade Operacional                          | Zero dependências novas; plugin `admin` rejeitado com justificativa registrada (research D1); nenhuma migração de schema                                                                                                                                                        | ✅ PASS                     |
| §Stack: better-auth com roles como `additionalFields` | Preservado — o plugin `admin` foi rejeitado justamente por impor um segundo modelo de papéis                                                                                                                                                                                    | ✅ PASS                     |
| §Segurança: senha e hash                              | O hash continua 100% no better-auth; nenhuma criptografia própria introduzida                                                                                                                                                                                                   | ✅ PASS                     |

**Resultado**: nenhuma violação. Complexity Tracking não se aplica.

**Re-avaliação pós-Phase 1**: mantido. Os contratos em `contracts/` não criam superfície HTTP nova (nenhum Route Handler), não alteram schema e não introduzem armazenamento. O único ponto de atenção que a Fase 1 revelou — FR-015 não é uma transação atômica real entre better-auth e Postgres — está tratado e justificado em research D3, com a ordem de escrita escolhida para que a falha provável ocorra antes de qualquer mudança.

## Project Structure

### Documentation (this feature)

```text
specs/008-admin-password-reset/
├── plan.md              # Este arquivo
├── spec.md
├── research.md          # Phase 0 — D1..D9
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── edicao-conta.md      # Server Action, caso de uso e ports
│   └── formulario-conta.md  # Contrato de UI do diálogo
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks — NÃO criado aqui
```

### Source Code (repository root)

```text
src/modules/identidade/
├── application/
│   ├── ports/
│   │   ├── autenticacao-service.ts    # ALTERADO — + definirSenha, + encerrarSessoes
│   │   └── usuario-repository.ts      # ALTERADO — + possuiSenhaPropria; LinhaUsuario ganha podeTrocarSenha
│   └── use-cases/
│       ├── editar-usuario.ts          # ALTERADO — aceita novaSenha, ordem senha → papel
│       └── editar-usuario.test.ts     # ALTERADO — casos novos (TDD, Princípio III)
├── infrastructure/
│   ├── better-auth/
│   │   └── autenticacao-service.ts    # ALTERADO — auth.$context: hash + updatePassword + deleteSessions
│   └── drizzle/
│       └── usuario-repository.ts      # ALTERADO — exists() sobre account; podeTrocarSenha na listagem
└── presentation/
    ├── actions/usuarios.ts            # ALTERADO — esquemaEditar + novaSenha opcional
    └── queries/usuarios.ts            # (sem mudança — o tipo vem do port)

app/(interno)/(staff)/admin/
└── usuario-form-dialog.tsx            # ALTERADO — e-mail disabled, ação "Trocar Senha", campo revelável
```

**Structure Decision**: estrutura existente preservada. Nenhum diretório novo e nenhum arquivo novo de produção — a feature é uma extensão do fluxo de edição de conta entregue em 006, e cada mudança cai exatamente na camada que a constituição prescreve. `db/schema/identidade.ts` **não** é alterado.

## Ordem de execução sugerida

1. **US1 (P1) — e-mail somente leitura**: só `usuario-form-dialog.tsx`. Entregável e verificável sozinho, sem tocar em servidor.
2. **Base de US2/US3** — ports (`definirSenha`, `possuiSenhaPropria`), repositório Drizzle e `podeTrocarSenha` chegando à tela.
3. **US3 (P2) — visibilidade condicional**: com `podeTrocarSenha` disponível, a ação aparece/some corretamente antes de fazer qualquer coisa.
4. **US2 (P2) — redefinição**: testes do caso de uso primeiro (Princípio III), depois caso de uso, service, action e o campo revelável.

US3 antes de US2 é deliberado: entregar a redefinição antes da regra de visibilidade colocaria em produção, ainda que por pouco tempo, um botão que promete o que não pode cumprir.

## Complexity Tracking

Não aplicável — Constitution Check sem violações.
