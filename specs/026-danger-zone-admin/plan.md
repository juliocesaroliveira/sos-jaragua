# Implementation Plan: Danger Zone — manutenção irrestrita de dados pelo administrador

**Branch**: `026-danger-zone-admin` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-danger-zone-admin/spec.md`

## Summary

Uma página `/admin/danger-zone`, exclusiva do papel administrador, para **resetar tabelas** e
**excluir registros selecionados** de qualquer uma das 26 tabelas do Postgres. Nenhuma ação
executa sem uma prévia completa do impacto e um texto de confirmação digitado.

O núcleo é um novo módulo **`manutencao`**. Ele descreve o schema físico num **catálogo
declarativo**: tabelas, colunas seguras para exibir e a classificação de cada vínculo como
*inseparável* ou *histórico*. O catálogo é conferido contra `pg_catalog` a cada uso, e um vínculo
não classificado bloqueia as ações nas tabelas que ele liga.

O planejador expande os conjuntos-alvo em tabelas temporárias até um ponto fixo. A mesma rotina
gera a prévia (contagens, amostras, saldos antes → depois) e a execução.

A execução roda numa transação travada e, antes de alterar qualquer coisa, compara as contagens
com a prévia confirmada. Em seguida:
1. grava na auditoria (Mongo) o evento de início e um snapshot redigido de cada linha atingida, em
   modo **bloqueante**;
2. redireciona os vínculos de histórico (para vazio ou para o registro padrão);
3. apaga as linhas em ordem topológica reversa e recalcula `saldo_estoque`;
4. faz o commit e grava o desfecho.

Três registros padrão com id fixo ("Usuário removido", "Item removido", "Categoria removida")
recebem os vínculos obrigatórios preservados. Um índice único de `alocacao` passa a ser parcial
para comportá-los.

## Technical Context

**Language/Version**: TypeScript 5.9 (estrito), Node.js 24 (Vercel Fluid Compute)

**Primary Dependencies**: Next.js 16.4.3 (App Router, Server Actions, `updateTag`/`revalidateTag`),
React 19.1, Drizzle ORM 0.45 (SQL cru via `sql` para tabelas temporárias e `pg_catalog`),
better-auth 1.6 (`session.createdAt` para sessão recente), driver `mongodb` 6, Zod 4, Ark UI 5.38,
Tailwind v4, TanStack Query 5. **Nenhuma dependência nova.**

**Storage**: Neon Postgres via `Pool` WebSocket (transações multi-statement, já em uso). Uma
migração: 3 registros padrão e o índice parcial em `alocacao` (data-model §2). Mongo `audit_logs`:
campo opcional `manutencao.*`, entidade `ManutencaoDados` e um índice novo (data-model §3).

**Testing**: Vitest.
- `npm test`: domínio do `manutencao` (catálogo, grafo, ponto fixo, confirmação, impressão
  digital) e redação de credenciais. Tudo com TDD (Princípio III).
- `npm run test:integracao`: catálogo × `pg_catalog`, invariância do recálculo de saldo, e
  exclusão de selecionados em linhas criadas pelo próprio teste.
- Resets inteiros só no roteiro manual, em branch Neon descartável (quickstart).

**Target Platform**: Vercel (Fluid Compute, timeout padrão de 300 s), navegadores modernos, mobile
≥ 360 px.

**Project Type**: aplicação web, monolito modular Next.js.

**Performance Goals**: prévia ≤ 5 s com o volume de produção (SC-005). Execução sem meta de tempo,
mas limitada ao timeout da função; com o volume atual (dezenas de milhares de linhas) cabe com
folga.

**Constraints**:
- execução atômica no Postgres (FR-015);
- nenhum efeito sem auditoria (FR-016);
- nenhum texto plano sensível nem credencial fora do banco (Princípio IV, research D9);
- a trava de escrita suspende operações de campo nas tabelas atingidas durante a execução.

**Scale/Scope**: poucos administradores; 26 tabelas; 30 vínculos; 1 página com 2 abas; 6 Server
Actions.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio | Avaliação | Status |
|---|---|---|
| **I. Clean Architecture por Módulo** | O módulo `manutencao` tem as 4 camadas. O domínio é puro (catálogo, grafo, regras de confirmação e divergência), sem Next nem Drizzle. A presentation é fina: Zod, sessão/role, um caso de uso e a invalidação. **Desvio**: a infraestrutura de `manutencao` lê e escreve em tabelas de outros módulos sem passar pelos ports deles. Do lado do Mongo, o acesso continua pela porta do módulo Auditoria. | ⚠️ justificado (Complexity Tracking) |
| **II. Tipagem estrita e qualidade** | Sem `any`: as linhas cruas são tipadas como `Record<string, unknown>` na fronteira. Conventional Commits. Textos em pt-BR. | ✅ |
| **III. Testes focados em regra de negócio** | TDD no domínio e na aplicação (planejamento, ponto fixo, classificação, comparação). O fluxo transacional crítico tem teste de integração. Resets destrutivos ficam fora do conjunto automático porque o banco de integração é compartilhado. | ✅ |
| **IV. Segurança e defesa em profundidade** | Proxy com regra `/admin` mais `exigirAcessoA` na página e releitura de role em cada action. Sessão recente para executar. Sensíveis mascarados na listagem e na amostra, redigidos nos snapshots. Credenciais removidas. Registros padrão não autenticam. A rota fica no mapa de roles. A eliminação a pedido do titular continua sendo a anonimização (a prévia de `user` aponta para ela). | ✅ |
| **V. Auditoria não bloqueante** | Toda execução é auditada com snapshots. **Desvio**: a escrita é bloqueante e não passa por `withAudit`. Ela usa uma porta nova do módulo Auditoria que propaga a falha. A política de degradação continua valendo para o resto do sistema. Decisão Q4 da clarificação. | ⚠️ justificado (Complexity Tracking) |
| **VI. Simplicidade operacional** | Sem serviço, fila ou dependência nova. O catálogo fica em código. As decisões estão registradas em `research.md` e vão para `spec/DESIGN.md` (research D18). | ✅ |
| Stack | Drizzle/Neon, Mongo só para auditoria, Server Actions, paginação server-side, Ark UI + Tailwind. | ✅ |

**Gate inicial**: aprovado com 2 desvios justificados. **Reavaliação pós-design** (após
data-model e contratos): sem desvios novos. O redirecionamento para os registros padrão exige
filtros nas listagens de outros módulos (research D15). Isso é uma mudança pequena *dentro*
desses módulos, feita pelo próprio código de cada um com a constante compartilhada, e não amplia o
desvio do Princípio I.

## Project Structure

### Documentation (this feature)

```text
specs/026-danger-zone-admin/
├── plan.md              # este arquivo
├── research.md          # D1–D18
├── data-model.md        # catálogo, migração, extensão do audit_logs, objetos de valor
├── quickstart.md        # testes + roteiro manual em branch Neon descartável
├── contracts/
│   ├── acoes-danger-zone.md      # Server Actions C-01..C-06
│   ├── auditoria-manutencao.md   # porta bloqueante do módulo Auditoria
│   └── ui-danger-zone.md         # página, fluxo de confirmação, navegação
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
db/
├── migrations/00NN_danger_zone.sql          # registros padrão + índice parcial (gerado + SQL manual)
└── schema/voluntariado.ts                   # alocacao_turno_participante_idx → .where(...)

src/shared/
├── kernel/registros-sistema.ts              # REGISTROS_SISTEMA (ids fixos) — novo
├── auth/sessao.ts                           # SessaoAtor += sessaoCriadaEm
├── auth/navegacao.ts                        # item "Danger Zone", campo opcional `perigo`
├── db/mongo/audit-logs.ts                   # EntidadeAuditada += ManutencaoDados; campo execucao; índice
└── ui/shell/…                               # estilo de item `perigo`

src/modules/auditoria/
├── index.ts                                 # export da porta RegistroExecucaoManutencao
├── infrastructure/registro-manutencao.ts    # escritor bloqueante + leitor de execuções — novo
└── redacao.ts                               # (reuso) + remoção de credenciais por lista recebida

src/modules/manutencao/                      # novo bounded context
├── domain/
│   ├── catalogo.ts                          # 26 tabelas, 30 vínculos, classificação
│   ├── conferir-catalogo.ts                 # catálogo × FKs físicas (puro)
│   ├── grafo.ts                             # ordem topológica, expansão até ponto fixo (puro)
│   ├── previa.ts                            # Previa, ImpressaoDigital, texto de confirmação, comparação
│   └── *.test.ts
├── application/
│   ├── ports/                               # LeitorEsquema, ExecutorConjuntos, RegistroExecucao, Relogio
│   └── use-cases/                           # inventario, listar-registros, gerar-previa,
│                                            # executar-acao, cancelar-acao, historico (+ testes)
├── infrastructure/drizzle/
│   ├── leitor-esquema.ts                    # pg_constraint / contagens
│   ├── executor-conjuntos.ts                # tabelas temporárias, travas, UPDATE/DELETE, saldo
│   └── *.integracao.test.ts
└── presentation/
    ├── actions/danger-zone.ts               # C-01..C-06
    └── consequencias.ts                     # frases pt-BR por tabela (FR-010)

app/(interno)/(staff)/admin/danger-zone/
├── page.tsx                                 # exigirAcessoA, faixa de ambiente, abas
├── inventario.tsx                           # U-03
├── registros-drawer.tsx                     # U-04
├── fluxo-confirmacao.tsx                    # U-05 (dialog em passos)
└── historico.tsx                            # U-06

# filtros de registros padrão (research D15)
src/modules/estoque/presentation/{lookups,queries}/…       # exclui "Item removido"
src/modules/voluntariado/…/atividades|categorias          # exclui "Categoria removida"
src/modules/identidade/…/listagem de usuários              # exclui "Usuário removido"

spec/DESIGN.md, spec/DB_SCHEMA.md                          # research D18
```

**Structure Decision**: o projeto existente é um monolito modular. A feature acrescenta o bounded
context `src/modules/manutencao/`, com as camadas do Princípio I, mais a rota sob o grupo `(staff)`
já protegido por `/admin`. Mudanças fora do módulo novo:
- `src/shared/` (constante de registros padrão, sessão e navegação);
- a porta nova do módulo Auditoria;
- filtros pontuais nas listagens de Estoque, Voluntariado e Identidade;
- uma migração.

## Complexity Tracking

| Violação | Por que é necessária | Alternativa mais simples rejeitada porque |
|---|---|---|
| **Princípio I**: `manutencao` acessa diretamente as tabelas de Identidade, Voluntariado, Estoque, Logística e Notificações | A operação é sobre linhas, não sobre regras de domínio. Uma cascata atravessa módulos e precisa caber numa única transação Postgres com travas comuns. O catálogo centraliza a única informação usada (tabela, chave, FK), que é física e não de domínio. | Um port de "apagar/redirecionar em massa dentro da transação T" em cada módulo criaria cerca de 18 métodos sem outro consumidor. Eles vazariam o mesmo detalhe físico e espalhariam a lógica de cascata por sete módulos (research D1). |
| **Princípio V**: auditoria **bloqueante** para ações da Danger Zone, fora do `withAudit` | Decisão Q4 da clarificação: uma ação destrutiva em massa sem rastro é exatamente o que a auditoria existe para impedir, e a Danger Zone não é operação de campo. Os snapshots precisam ser gravados *antes* do commit para que não exista ação efetivada sem eles (research D8). | Usar `withAudit` grava depois da mutação e engole a falha, o que deixaria uma execução sem rastro quando o Mongo estiver fora. Emendar a constituição foi descartado pela decisão Q4: a exceção é restrita e fica registrada aqui e em `spec/DESIGN.md`. |
