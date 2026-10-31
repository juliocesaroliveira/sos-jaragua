# Specification Quality Checklist: Criptografia, Mascaramento e Exclusão de Dados Sensíveis (LGPD)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-31
**Updated**: 2026-10-31 (após as respostas de Q1, Q2, Q3 e Q4)
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — as quatro perguntas foram resolvidas pelo responsável
      em 2026-10-31.
- [x] Requirements are testable and unambiguous — o conjunto de campos, a matriz de visibilidade e o
      alcance da exclusão estão fixados em tabelas explícitas.
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

**Status: 16/16. Pronta para `/speckit-plan`.**

## Notes

### Emenda da Constituição exigida antes do merge da implementação

A Constituição v1.0.1 precisa de emenda (bump MINOR via `/speckit-constitution`) cobrindo **dois**
princípios:

1. **Princípio IV** — hoje determina "não introduzir criptografia a nível de campo sem decisão
   documentada". Esta spec é a decisão documentada; o texto do princípio precisa refletir a nova
   postura e a motivação de conformidade com a LGPD.
2. **Princípio V** — auditoria imutável (BR-AUD-01). FR-027 abre uma exceção única e documentada:
   a remediação dos snapshots já gravados que contêm campos sensíveis em texto plano. Sem essa
   remediação a anonimização de Q4 seria incompleta.

### Decisões tomadas por padrão razoável (não solicitadas — contestáveis)

- **FR-026**: a trilha de auditoria passa a registrar que um campo sensível mudou, sem reproduzir o
  valor. Custo aceito: não se reconstitui pela trilha qual era o CPF antes de uma correção.
- **FR-025**: as vagas de turnos futuros do titular excluído voltam a ficar disponíveis.
- Exclusão imediata, sem período de arrependimento.
- Portabilidade de dados (LGPD art. 18, V) fora de escopo.

### Riscos de conformidade registrados na spec

- `restricoesSaude` e `telefone` ficaram fora do conjunto criptografado por decisão de Q1, embora a
  LGPD classifique dado de saúde como **dado pessoal sensível** (art. 5º, II) — categoria mais estrita
  que CPF e CEP. A Constituição (Princípio IV) também cita `restricoesSaude` ao lado de `cpf`.
  Decisão do responsável mantida; risco documentado em **Riscos Conhecidos**.
- Backups e cópias de retenção do provedor de banco não são alcançados pela exclusão.

### Impacto em código existente já mapeado (insumo para `/speckit-plan`, não requisito desta spec)

- `voluntario_perfil.cpf` tem índice único (`voluntario_perfil_cpf_idx`) e é usado em `buscarPorCpf` —
  a proteção precisa preservar unicidade e busca por valor exato.
- A data de nascimento é **duplicada** em `user.dataNascimento` e `voluntario_perfil.dataNascimento`,
  sincronizadas por `definirDataNascimentoSeAusente`. Proteger só uma deixa a outra legível (FR-008).
- A validação de maioridade (`ehMaiorDeIdade`) vive no `domain` e consome a data completa (FR-006).
- `withAudit` grava o snapshot inteiro do registro (`dadosAnteriores`/`dadosNovos`) no Mongo — origem
  do problema tratado em FR-026 e FR-027.
- CPF é exibido na fila de triagem (`fila-triagem.tsx`) e nas colunas de relatório das definições de
  contingência; os relatórios exportam via rota dedicada (FR-018).
- **Não existe nenhuma tela de conta ou perfil** em `app/` — a User Story 4 cria essa superfície do
  zero, o que a torna a maior fatia de trabalho novo desta feature.
