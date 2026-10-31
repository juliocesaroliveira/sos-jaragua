# Specification Quality Checklist: Criptografia e Mascaramento de Dados Sensíveis (LGPD)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-31
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [ ] No [NEEDS CLARIFICATION] markers remain — **3 perguntas abertas (Q1, Q2, Q3)**, consolidadas na
      seção Clarifications em vez de marcadores inline. Precisam de resposta antes de `/speckit-plan`.
- [x] Requirements are testable and unambiguous — com a ressalva de que FR-001, FR-008 e FR-012
      dependem das respostas de Q1 e Q2 para fixar o conjunto de campos e de roles.
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

- **Bloqueador para `/speckit-plan`**: as três perguntas da seção Clarifications. Q1 define o conjunto
  de campos sensíveis, Q2 define quais roles veem texto plano e Q3 define se o titular vê os próprios
  dados. Nenhuma tem padrão seguro assumível sem decisão do responsável.
- **Conflito com a Constituição v1.0.1 (Princípio IV)**: o princípio vigente determina "não introduzir
  criptografia a nível de campo sem decisão documentada". Esta spec é essa decisão, mas a Constituição
  precisa de emenda (bump MINOR via `/speckit-constitution`) antes do merge da implementação — a
  revisão de conformidade da seção Governance exige verificação contra os Princípios I, IV e VI.
- **Impacto em código existente já mapeado** (para o `/speckit-plan`, não é requisito desta spec):
  o CPF é exibido na fila de triagem; CPF, telefone e restrições de saúde aparecem nas consultas de
  relatórios e de candidaturas; existe índice único de CPF e busca por CPF no repositório de
  voluntário.
