# Implementation Plan: Notificações que chegam sozinhas à tela

**Branch**: `012-notificacoes-tempo-real` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-notificacoes-tempo-real/spec.md`

## Summary

O sino deixa de ser um componente puramente alimentado por props do servidor e passa a manter uma
query no cliente que se reconsulta a cada 30 segundos com a aba visível, e imediatamente quando o
usuário volta para a aba. Os dados já resolvidos pelo Server Component viram `initialData`, então
nada pisca nem gera requisição extra na abertura.

A leitura periódica vai por **Route Handler `GET`**, não por Server Action — a documentação do
Next instalado é explícita ao dizer que Server Actions são despachadas uma de cada vez por
cliente, e um polling nessa fila competiria com as ações reais do usuário. As escritas continuam
Server Actions, mas "marcar como lida" passa a ser mutação otimista com `cancelQueries`, o que é
o que impede um refetch em voo de desfazer visualmente a leitura.

Nenhuma dependência nova, nenhuma mudança de banco, nenhuma migração. O comportamento de suspender
em segundo plano sai do padrão do TanStack Query, sem código nosso.

## Technical Context

**Language/Version**: TypeScript 5.9 (estrito)

**Primary Dependencies**: Next.js 16.3.0 (App Router, `cacheComponents: true`), React 19.1,
`@tanstack/react-query` 5.101 (já instalado e já montado na área autenticada), Drizzle ORM 0.45,
Ark UI 5.38, Tailwind CSS v4

**Storage**: Neon Postgres via Drizzle. **Sem alteração de esquema** — a feature só lê
`notificacao`, que já existe

**Testing**: Vitest — `npm test` (unitário, sem rede); `npm run test:integracao` (Neon real)

**Target Platform**: Vercel (funções sob demanda), navegadores desktop e mobile

**Project Type**: Monolito modular Next.js com bounded contexts em `src/modules/<modulo>/`

**Performance Goals**: uma requisição por usuário a cada 30s com a aba visível, resolvendo duas
consultas indexadas em paralelo; zero requisições com a aba oculta; sem regressão nas telas de
operação de campo (meta de leitura crítica < 300ms mantida)

**Constraints**: sem conexão persistente (FR-008); sem dependência nova; sem push do navegador
(FR-020); destinatário sempre derivado da sessão no servidor (FR-005); interface 100% pt-BR

**Scale/Scope**: 1 módulo tocado (`notificacoes`) mais o shell e o factory de chaves; 1 Route
Handler novo; 0 migrações; 0 rotas de página novas

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio | Avaliação | Status |
| --- | --- | --- |
| **I. Clean Architecture por Módulo** | O Route Handler é `presentation` de `notificacoes`: checa sessão, chama as queries existentes, serializa. Nenhuma regra de negócio nova — não há `domain` a criar, porque a feature não introduz regra, só um caminho de leitura. As queries de leitura permanecem onde estão. | ✅ PASS |
| **II. Tipagem Estrita e Qualidade** | Sem `any`. Nomes em pt-BR (`chaveNotificacoes`, `useNotificacoes`). Textos de interface inalterados e em pt-BR. Commits Conventional. | ✅ PASS |
| **III. Testes Focados em Regras de Negócio** | A feature **não adiciona regra de negócio** em `domain`/`application` — é orquestração de `presentation` e comportamento de cliente. A constituição diz explicitamente que essas camadas "são finas por design e não exigem a mesma cobertura exaustiva — validação de contrato e dos casos de erro mais prováveis basta". O plano cobre isso: teste da função de intervalo (pura, decide backoff/parada) e teste de contrato do Route Handler (401 sem sessão, só notificações do próprio usuário). | ✅ PASS |
| **IV. Segurança e Defesa em Profundidade** | Endpoint novo deriva destinatário de `obterSessao()` e ignora qualquer identificador do cliente; `401` sem corpo quando não há sessão. Nenhuma rota sob `(staff)`, matriz de roles intocada. A expiração por inatividade continua sendo a autoridade — o 401 apenas propaga a decisão dela ao cliente (D8). | ✅ PASS |
| **V. Auditoria Não Bloqueante** | Não se aplica: a feature **lê**. Nenhuma escrita nova em Voluntariado, Estoque ou Atividade. `marcarComoLida` já existia e sua semântica não muda — só a forma como a interface reage a ela. | ✅ PASS |
| **VI. Simplicidade Operacional** | Zero infraestrutura nova, zero dependência nova, zero serviço externo — foi exatamente o motivo da decisão Q1. O provider do TanStack Query já existe e ganha um segundo consumidor. Três decisões de "não fazer" ficam registradas (D2, D9, e a ausência de conexão persistente) para que ninguém adicione código redundante depois. | ✅ PASS |

**Gate result**: aprovado, sem violações. `Complexity Tracking` não se aplica.

**Re-avaliação pós-Fase 1**: o design não introduziu nada além do previsto — um Route Handler, um
hook de cliente, uma chave no factory e a conversão de duas chamadas em mutações. Os gates
permanecem aprovados.

## Project Structure

### Documentation (this feature)

```text
specs/012-notificacoes-tempo-real/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — D1..D12 e riscos residuais
├── data-model.md        # Fase 1 — formas de dado e regras de estado (sem mudança de esquema)
├── quickstart.md        # Fase 1 — roteiro de validação
├── contracts/
│   ├── leitura-notificacoes.md   # Contrato do Route Handler GET
│   └── sino-cliente.md           # Contrato do hook e do componente
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
app/
├── api/notificacoes/route.ts              # NOVO — GET de leitura (lista + contador)
├── _shell/shell-autenticado.tsx           # passa os dados do servidor como semente
└── (interno)/sino-notificacoes.tsx        # consome o hook; marcar como lida vira mutação

src/shared/query/
├── chaves.ts                              # + chaveNotificacoes
└── index.ts                               # exporta a chave nova

src/modules/notificacoes/
└── presentation/
    ├── queries/notificacoes.ts            # inalterado — reusado pelo Route Handler
    ├── actions/notificacoes.ts            # inalterado — as Server Actions continuam as mesmas
    └── client/use-notificacoes.ts         # NOVO — hook de query + mutações + política de intervalo
```

**Structure Decision**: mantida a estrutura de bounded contexts. O hook de cliente entra em
`presentation/client/` do módulo `notificacoes` — é apresentação do módulo dono do dado, não
infraestrutura compartilhada, e assim o sino em `app/` importa do módulo em vez de reimplementar
a política de intervalo inline. O Route Handler fica em `app/api/` por exigência do App Router,
mas é fino: sessão → queries existentes → JSON.

## Ordem de execução sugerida

1. **Contrato de servidor** — Route Handler `GET` com autorização e teste de contrato.
2. **Chave** — `chaveNotificacoes` no factory e no barril.
3. **Hook** — política de intervalo (função pura, testada), query com semente e foco.
4. **Semente** — shell passa os dados já resolvidos.
5. **Componente** — sino consome o hook; leitura vira mutação otimista.
6. **Validação** — roteiro do `quickstart.md`.

Passos 1–5 entregam a User Story 1; o passo 5 completa também a User Story 2, cujas garantias
(suspensão, backoff, otimismo) estão concentradas no hook e na mutação.

## Complexity Tracking

Não aplicável — Constitution Check passou sem violações.
