# Specification Quality Checklist: Auto-cadastro por provedor externo e pré-preenchimento da candidatura

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-16
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

Duas ambiguidades foram resolvidas antes de fechar a spec e estão registradas em
**Decisões de escopo** no `spec.md`:

- **Origem da data de nascimento**: não é solicitada aos provedores externos (FR-004). A conta
  nasce com o campo em branco e ele é preenchido pela primeira candidatura enviada (FR-016).
  Elimina a dependência de escopo adicional/App Review em Google e Facebook.
- **Edição do nome completo**: o campo é pré-preenchido a partir da conta mas permanece
  editável (FR-013, FR-018). E-mail fica sempre desabilitado; data de nascimento fica
  desabilitada apenas depois de registrada na conta. Evita empurrar para a fila de triagem a
  correção de apelidos vindos do provedor.

Checklist completo — spec pronta para `/speckit-plan`.

**Emenda pós-plano (2026-08-16)**: durante a Fase 0 do `/speckit-plan`, a leitura de
`better-auth@1.6.26` mostrou que a vinculação automática de um provedor externo a uma conta
local exige `user.emailVerified = true`, o que este projeto nunca produz (não há verificação de
e-mail no cadastro por senha). O cenário 3 da User Story 1 e o FR-005 prometiam uma vinculação
que o sistema não faz. Ambos foram corrigidos para descrever a **recusa com mensagem clara**
(novo FR-005a), e o caso de borda Google→Facebook foi reescrito. A alternativa — afrouxar
`requireLocalEmailVerified` — foi rejeitada por reabrir vetor de tomada de conta (Princípio IV).
Ver [research.md](../research.md) D4.
