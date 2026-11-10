# Implementation Plan: Criptografia, Mascaramento e Exclusão de Dados Sensíveis (LGPD)

**Branch**: `ccr-2279b88f-ml8sxo` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-criptografia-dados-sensiveis/spec.md`

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

**Language/Version**: TypeScript estrito, Next.js 16.4.3 (App Router, Turbopack), React 19

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
| **IV — Segurança e Defesa em Profundidade** | ✅ Passa (desde v1.1.0) | O princípio **exigia** a decisão documentada para introduzir cripto de campo; a emenda v1.1.0 a registrou e passou a mandatar esta política. Histórico em Complexity Tracking. |
| **V — Auditoria Não Bloqueante / Imutável** | ✅ Passa (desde v1.1.0) | A exceção única de FR-027 — remediar os snapshots já gravados — está agora escrita no próprio princípio. Histórico em Complexity Tracking. |
| **VI — Simplicidade Operacional** | ✅ Passa | Nenhuma dependência nova, nenhum serviço novo, nenhum banco novo. As decisões arquiteturais ficam registradas aqui e em `research.md` antes do código, como o princípio exige. |

**Gate**: ✅ **passa**. As duas divergências que este plano registrou foram resolvidas pela emenda
**v1.1.0** da Constituição (2026-10-31), que adotou a cripto a nível de campo no Princípio IV e
inscreveu a exceção única de FR-027 no Princípio V. O histórico da justificativa fica em Complexity
Tracking, como registro de por que a emenda foi necessária.

**Ressalva de transição**: a emenda descreve o estado final da política — mascaramento, visibilidade
por role e direitos do titular. Isso só existe em código ao fim da US4. Entre a emenda e essa entrega,
o repositório declara política que ainda não cumpre. Decisão consciente: a v1.1.0 vale como alvo
durante a implementação, e a conformidade plena é verificada no checkpoint da US4.

### Bloqueio operacional pré-existente — resolvido

`npm ci` falhava por dessincronia entre `package.json` e `package-lock.json`
(`Missing: esbuild@0.28.2 from lock file`), impedindo CI e `npm test`. **Corrigido** em commit próprio
(`chore: ressincroniza package-lock.json`): `npm ci` conclui com exit 0 e `npm test` passa 549 testes
em 47 arquivos. A baseline de testes está verde, então as tarefas desta feature partem de verde.

### Alerta de segurança descoberto na auditoria de dependências

**Resolvido**: o `npm audit` acusava advisory **crítico** no `next@16.3.8` (faixa 16.0.0–16.4.0), um
dos itens diretamente ligado ao mecanismo que esta feature usa — *"Unauthenticated Remote Code
Execution in `use cache` functions returning typed arrays"* (GHSA-673q-mjm6-r5xr) —, além de RCE na API
de otimização de imagem com SVG e DoS em Server Actions. O Next e o `eslint-config-next` foram
atualizados para **16.4.3**; o advisory saiu do `npm audit`, `npm test` passa 549 testes e
`npm run build` conclui com exit 0.

**Permanece aberto, em decisão à parte**: 1 advisory crítico em `better-auth` (aprovação de login de
dispositivo) e altos em `zod`, `vite`, `js-yaml` e `source-map-js`. O `better-auth` é o núcleo da
autenticação e um bump ali exige validar os fluxos de login — não cabe nesta feature.

## Project Structure

### Documentation (this feature)

```text
specs/025-criptografia-dados-sensiveis/
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

> **Status**: as duas primeiras linhas são **histórico** — resolvidas pela emenda v1.1.0 da
> Constituição. Ficam registradas porque a justificativa é o que sustenta a emenda.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| **Princípio IV** — introduz criptografia a nível de campo, que o texto vigente manda não introduzir sem decisão documentada | É o pedido central da feature, motivado por conformidade com a LGPD (art. 46). A spec é a decisão documentada que o próprio princípio exige | Confiar na criptografia at-rest nativa do Neon — que é o que o princípio descreve hoje — não protege contra dump autorizado, backup extraviado nem acesso indevido ao provedor, que são exatamente os cenários que motivaram o pedido |
| **Princípio V** — FR-027 altera documentos de uma trilha declarada imutável | Os snapshots já gravados contêm CPF, data de nascimento e CEP em texto plano, porque `withAudit` grava o registro inteiro. Sem remediar, cifrar o Postgres deixaria a trilha como cópia legível dos mesmos dados, e a anonimização de um titular (FR-022) seria incompleta | Deixar a trilha intacta tornaria a feature cosmética — o dado seguiria legível no Mongo. Redigir a cada exclusão, em vez de uma vez, abriria uma exceção **recorrente** à imutabilidade; a remediação única é a menor brecha que resolve o problema, e daí em diante FR-026 impede que o texto plano volte a entrar |
| **Blind index** — segunda coluna para o CPF | FR-005 exige preservar unicidade e busca exata por CPF, que a cifra aleatorizada quebra | Criptografia determinística resolveria com uma coluna só, mas entrega igualdade no próprio ciphertext e amarra rotação de chave/algoritmo. Hash sem chave é inseguro: 11 dígitos são força-bruta de segundos |
