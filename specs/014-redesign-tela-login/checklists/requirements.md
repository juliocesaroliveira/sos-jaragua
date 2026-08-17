# Specification Quality Checklist: Redesign da Tela de Login

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

**Iteração 1 (2026-08-16)** — 2 marcadores `[NEEDS CLARIFICATION]` abertos e apresentados ao
usuário: direção de composição no desktop (FR-009) e escopo do "mostrar senha" (Assumptions).

**Iteração 2 (2026-08-16)** — ambos resolvidos pelo usuário; 16/16 itens passando.

1. **Composição no desktop → imersiva com fotografia de fundo e cartão translúcido.**
   Gerou a subseção "Composição imersiva com imagem de fundo" (FR-006a a FR-006g), o
   SC-006a, o SC-010, três edge cases novos e a reescrita da US1. As três reservas que eu
   havia levantado ao recomendar contra essa direção (licenciamento da foto, fragilidade do
   contraste sobre imagem, peso em 3G no uso de campo) foram convertidas em restrições
   verificáveis em vez de descartadas — ver Assumptions.
2. **"Mostrar senha" → dentro do escopo, como componente `Password` compartilhado do sistema
   de design** (não adaptação local da tela de login), sobre a base de componentes headless já
   adotada. Gerou a subseção "Campo de senha com alternância de visibilidade" (FR-029 a
   FR-037), a US5 e o SC-011.

**Ambiguidades resolvidas por default documentado**, sem consumir marcador: fluxo em duas
etapas preservado (`001-unified-login-flow` FR-011), nenhuma outra capacidade de autenticação
nova, convite ao cadastro restaurado, tela de cadastro fora de escopo.

**Pontos de atenção para o `/speckit-plan`**, não bloqueantes:

- A fotografia de fundo ainda **não existe** como ativo. A spec não a escolhe (FR-006g exige
  origem e direito de uso documentados). Se o acervo próprio da Defesa Civil não tiver imagem
  adequada, a decisão precisa ser reaberta — a spec veta explicitamente resolver com foto de
  banco genérica.
- O componente `Password` novo é do sistema de design e outras telas com campo de senha
  (cadastro, redefinição no admin) continuarão usando o campo antigo até uma migração de
  acompanhamento. A divergência temporária é aceita e está registrada em Assumptions.

`Key Entities` foi mantida com nota explícita de que a feature não introduz entidades.
