# Specification Quality Checklist: Criptografia, Mascaramento e Exclusão de Dados Sensíveis (LGPD)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-31
**Updated**: 2026-10-31 (após respostas de Q1, Q2 e Q3)
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [ ] No [NEEDS CLARIFICATION] markers remain — **1 pergunta aberta (Q4)**: o alcance da exclusão
      diante da auditoria imutável. Q1, Q2 e Q3 foram resolvidas pelo responsável em 2026-10-31.
- [x] Requirements are testable and unambiguous — o conjunto de campos (Q1) e a matriz de
      visibilidade (Q2) estão fixados em tabelas explícitas. FR-022 depende de Q4.
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

### Bloqueador para `/speckit-plan`

- **Q4** — exclusão física vs. anonimização. O Princípio V da Constituição estabelece auditoria
  imutável (BR-AUD-01); "apagar todos os dados" ao pé da letra contradiz esse princípio e abre lacuna
  no histórico de turnos. Recomendação registrada na spec: anonimizar (opção A).

### Conflitos com a Constituição v1.0.1

1. **Princípio IV** — "não introduzir criptografia a nível de campo sem decisão documentada". Esta
   spec é a decisão; a Constituição precisa de emenda (bump MINOR via `/speckit-constitution`) antes
   do merge da implementação.
2. **Princípio V** — auditoria imutável. Dependente da resposta de Q4: a opção B exigiria uma segunda
   emenda, de impacto maior.

### Risco de conformidade registrado na spec

- `restricoesSaude` ficou fora do conjunto protegido por decisão de Q1, embora a LGPD classifique dado
  de saúde como **dado pessoal sensível** (art. 5º, II) — categoria mais estrita que CPF e CEP, que
  serão criptografados. A Constituição (Princípio IV) também o cita junto com `cpf`. Registrado em
  **Riscos Conhecidos**; decisão do responsável mantida.

### Impacto em código existente já mapeado (insumo para `/speckit-plan`, não requisito desta spec)

- `voluntario_perfil.cpf` tem índice único e é usado em `buscarPorCpf` — a proteção precisa preservar
  unicidade e busca por valor exato.
- A data de nascimento é **duplicada** em `user.dataNascimento` e `voluntario_perfil.dataNascimento`,
  sincronizadas por `definirDataNascimentoSeAusente`. Proteger só uma deixa a outra legível (FR-008).
- A validação de maioridade (`ehMaiorDeIdade`) vive no `domain` e consome a data completa (FR-006).
- CPF é exibido na fila de triagem (`fila-triagem.tsx`); CPF, telefone e restrições de saúde aparecem
  nas consultas de relatórios e de candidaturas; os relatórios exportam via rota dedicada.
- **Não existe nenhuma tela de conta ou perfil** em `app/` — a User Story 4 cria essa superfície do
  zero, o que a torna a maior fatia de trabalho novo desta feature.
