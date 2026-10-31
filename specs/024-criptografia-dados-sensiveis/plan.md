# Implementation Plan: Criptografia, Mascaramento e Exclusão de Dados Sensíveis (LGPD)

**Branch**: `ccr-2279b88f-ml8sxo` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-criptografia-dados-sensiveis/spec.md`

## Summary

Proteger CPF, data de nascimento e CEP dos voluntários com criptografia a nível de campo, mascarar sua
exibição por padrão, liberar o valor completo apenas conforme a Matriz de Visibilidade — com registro
em auditoria — e dar ao titular uma área de conta onde vê os próprios dados e pede a eliminação.

A abordagem técnica se apoia em quatro decisões (detalhadas em [research.md](./research.md)):

1. **AES-256-GCM via `node:crypto`**, sem dependência nova, com envelope versionado; mais um **blind
   index HMAC-SHA256** para o CPF, que é o único campo que precisa de unicidade e busca exata (D1, D2).
2. **O valor mascarado é o que entra no cache; a revelação fica fora dele.** `'use cache'` não admite
   `cookies()`/`headers()` no Next 16, e `DESIGN.md` §7 já proíbe cachear dado derivado de sessão.
   Resultado: nenhum texto plano sensível entra em cache algum, de servidor ou de navegador (D4).
3. **A exclusão anonimiza no lugar, nunca apaga.** A análise das FKs mostra que um `DELETE` falharia
   para quem tem histórico operacional e, quando passasse, destruiria o histórico de turnos (D7).
4. **A redação da auditoria mora dentro de `withAudit`**, o único ponto de passagem da trilha, mais uma
   remediação única dos documentos já gravados no Mongo (D8).

## Technical Context

**Language/Version**: TypeScript estrito, Next.js 16.3.8 (App Router, Turbopack), React 19

**Primary Dependencies**: `node:crypto` (embutido — **nenhuma dependência nova**), Drizzle ORM,
better-auth, MongoDB driver, Ark UI + Tailwind v4, TanStack Query/Table

**Storage**: Neon Postgres (dados de domínio) + MongoDB Atlas (apenas trilha de auditoria imutável)

**Testing**: Vitest — `npm test` (domain/application, sem rede) e `npm run test:integracao` (Neon real)

**Target Platform**: Vercel serverless (Node runtime); `proxy.ts` na borda, sem necessidade de cripto

**Project Type**: Monolito modular Next.js por bounded context (`src/modules/<modulo>/`)

**Performance Goals**: manter a meta vigente de <300 ms nas leituras críticas de campo (SC-006).
Decifrar 3 campos × 50 linhas custa <1 ms — irrelevante contra a latência do Neon (D11)

**Constraints**: chave exclusivamente por variável de ambiente; aplicação recusa iniciar sem ela;
nenhum texto plano sensível em cache, log, mensagem de erro ou notificação; migração idempotente

**Scale/Scope**: 3 campos sensíveis × 2 tabelas; 5 roles na matriz de visibilidade; ~8 superfícies de
apresentação existentes a cobrir; 1 tela nova; 2 migrações de dados (Postgres e Mongo)

## Constitution Check

_GATE: avaliado contra `.specify/memory/constitution.md` v1.0.1._

| Princípio | Resultado | Observação |
| --------- | --------- | ---------- |
| **I — Clean Architecture por Módulo** | ✅ Passa | Cripto em `src/shared/cripto/` (infra transversal, no precedente de `shared/db` e `shared/auth`); máscara em `src/shared/mascara/` como funções puras, sem import de Next/Drizzle/Mongo. O `domain/` não ganha dependência de infraestrutura (D10). |
| **II — Tipagem Estrita e pt-BR** | ✅ Passa | Sem `any`; textos e rótulos novos em pt-BR; Conventional Commits. |
| **III — Testes em Regras de Negócio** | ✅ Passa | Máscara, classificação de campos e matriz de visibilidade são puros → unitários rápidos. Round-trip de cripto → unitário. Migração, unicidade de CPF e anonimização tocam o Neon → `test:integracao`. |
| **IV — Segurança e Defesa em Profundidade** | ⚠️ **Viola — exige emenda** | O princípio determina hoje *"não introduzir criptografia a nível de campo sem decisão documentada"*. Esta feature é a decisão. Ver Complexity Tracking. |
| **V — Auditoria Não Bloqueante / Imutável** | ⚠️ **Viola — exige emenda** | FR-027 abre uma exceção única à imutabilidade: remediar os snapshots já gravados que contêm dado sensível em texto plano. Ver Complexity Tracking. |
| **VI — Simplicidade Operacional** | ✅ Passa | Nenhuma dependência nova, nenhum serviço novo, nenhum banco novo. As decisões arquiteturais ficam registradas aqui e em `research.md` antes do código, como o princípio exige. |

**Gate**: as duas violações são **conscientes, justificadas e inerentes ao pedido** — não são desvios
incidentais. Ambas estão documentadas em Complexity Tracking e exigem `/speckit-constitution` (bump
MINOR) **antes do merge da implementação**. O gate passa para seguir ao design; não passa para merge
sem a emenda.

### Bloqueio operacional pré-existente

`npm ci` falha neste repositório: `package-lock.json` está dessincronizado de `package.json`
(`Missing: esbuild@0.28.2 from lock file`). Não foi introduzido por esta feature, mas impede CI e
`npm test`. Deve ser corrigido com `npm install` em um commit próprio, antes da implementação.

## Project Structure

### Documentation (this feature)

```text
specs/024-criptografia-dados-sensiveis/
├── spec.md              # Especificação (4 histórias, 31 FRs, 13 SCs)
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — 12 decisões técnicas
├── data-model.md        # Fase 1 — schema, migrações, estados
├── quickstart.md        # Fase 1 — roteiro de validação ponta a ponta
├── contracts/           # Fase 1 — contratos de Server Actions e portas
│   ├── cripto-mascara.md
│   ├── revelar-dado-sensivel.md
│   └── excluir-meus-dados.md
└── tasks.md             # Fase 2 — criado por /speckit-tasks, NÃO por este comando
```

### Source Code (repository root)

```text
src/shared/
├── cripto/                        # NOVO — infraestrutura de cripto
│   ├── index.ts                   # cifrar / decifrar / indiceCego
│   ├── chave.ts                   # leitura e validação de DADOS_SENSIVEIS_CHAVE + HKDF
│   └── envelope.ts                # formato v1.<iv>.<ct>.<tag>
├── mascara/                       # NOVO — funções puras de máscara
│   ├── index.ts                   # mascararCpf / mascararCep / mascararData
│   └── campos-sensiveis.ts        # classificação + Matriz de Visibilidade (fonte única)
└── cache/tags.ts                  # + tag da área de conta, se necessário

src/modules/voluntariado/
├── domain/candidatura.ts          # inalterado — já opera sobre 'YYYY-MM-DD'
├── application/use-cases/
│   ├── revelar-dado-sensivel.ts   # NOVO — confere matriz, decifra, audita (read)
│   └── anonimizar-titular.ts      # NOVO — UPDATE no lugar, nunca DELETE
├── infrastructure/drizzle/
│   └── voluntario-repository.ts   # cifra na escrita, decifra na leitura, busca por blind index
└── presentation/
    ├── queries/candidaturas.ts    # 'use cache' passa a devolver só o mascarado
    ├── queries/relatorios.ts      # idem, e a exportação herda a regra (FR-018)
    └── actions/dados-sensiveis.ts # NOVO — Server Actions de revelar e excluir

src/modules/auditoria/
├── index.ts                       # withAudit redige campos sensíveis antes de gravar
└── presentation/queries/trilha.ts # + ações 'read' e 'anonimizar' no filtro e nos rótulos

src/shared/db/mongo/audit-logs.ts  # AcaoAuditada += 'read' | 'anonimizar'

app/(interno)/conta/               # NOVO — área de conta do titular (US4)
├── page.tsx                       # dados próprios completos (nunca cacheada)
└── excluir-dados.tsx              # botão + confirmação explícita

db/schema/
├── voluntariado.ts                # cpf → ciphertext, + cpf_indice, + anonimizado_em, nuláveis
└── identidade.ts                  # user.dataNascimento: date → text (ciphertext)

db/migrations/                     # nova migration Drizzle

instrumentation.ts                 # NOVO (raiz) — register() valida a chave no boot

scripts/
├── proteger-dados-existentes.ts   # NOVO — migração idempotente (FR-007)
└── remediar-auditoria.ts          # NOVO — remediação única do Mongo (FR-027)
```

**Structure Decision**: a feature segue a estrutura existente do monolito modular. O que é transversal
(cripto, máscara, classificação de campos) vai para `src/shared/`, no mesmo nível de `shared/db` e
`shared/auth`, que são o precedente do repositório para capacidade de infraestrutura compartilhada. O
que é regra de negócio (revelar, anonimizar) vira caso de uso em
`src/modules/voluntariado/application/`, consumido por Server Actions finas na `presentation/`,
conforme o Princípio I. A única superfície nova de UI é `app/(interno)/conta/`, deliberadamente fora de
`(staff)` (D12).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| **Princípio IV** — introduz criptografia a nível de campo, que o texto vigente manda não introduzir sem decisão documentada | É o pedido central da feature, motivado por conformidade com a LGPD (art. 46). A spec é a decisão documentada que o próprio princípio exige | Confiar na criptografia at-rest nativa do Neon — que é o que o princípio descreve hoje — não protege contra dump autorizado, backup extraviado nem acesso indevido ao provedor, que são exatamente os cenários que motivaram o pedido |
| **Princípio V** — FR-027 altera documentos de uma trilha declarada imutável | Os snapshots já gravados contêm CPF, data de nascimento e CEP em texto plano, porque `withAudit` grava o registro inteiro. Sem remediar, cifrar o Postgres deixaria a trilha como cópia legível dos mesmos dados, e a anonimização de um titular (FR-022) seria incompleta | Deixar a trilha intacta tornaria a feature cosmética — o dado seguiria legível no Mongo. Redigir a cada exclusão, em vez de uma vez, abriria uma exceção **recorrente** à imutabilidade; a remediação única é a menor brecha que resolve o problema, e daí em diante FR-026 impede que o texto plano volte a entrar |
| **Blind index** — segunda coluna para o CPF | FR-005 exige preservar unicidade e busca exata por CPF, que a cifra aleatorizada quebra | Criptografia determinística resolveria com uma coluna só, mas entrega igualdade no próprio ciphertext e amarra rotação de chave/algoritmo. Hash sem chave é inseguro: 11 dígitos são força-bruta de segundos |
