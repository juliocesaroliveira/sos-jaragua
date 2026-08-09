# TASKS.md — Roteiro de Implementação

## Projeto: SOS Jaraguá — Gestão e Mobilização em Situações de Emergência

Este arquivo decompõe as especificações de `spec/REQUISITOS_NEGOCIO.md` (BRD),
`spec/REQUISITOS_NAO_FUNCIONAIS.md` (NFR), `spec/DESIGN.md`, `spec/DESIGN_SYSTEM.md` e
`spec/DB_SCHEMA.md` em tasks executáveis por um agente de IA (Claude Code / Opus). Os
documentos de spec são a **fonte de verdade** — qualquer dúvida de comportamento, campo,
regra ou decisão de arquitetura deve ser resolvida lendo o documento referenciado, nunca
decidida ad-hoc.

## Legenda

- `- [ ]` — pendente
- `- [x]` — concluída e **verificada manualmente** (não apenas código escrito — testada
  rodando a aplicação, conforme AGENTS.md/CLAUDE.md do projeto)

## Regras de uso

1. Marque `[x]` somente após a funcionalidade estar implementada **e** verificada
   manualmente (rodar a app, exercitar o fluxo). Código escrito mas não testado continua
   `[ ]`.
2. A ordem das seções (1→12) reflete dependência real de execução — não é só agrupamento
   temático. Não pule seções: Voluntariado e Estoque dependem de Identidade (`user.id`
   como FK em quase toda tabela de negócio); Logística depende do saldo de Estoque;
   Notificações/Auditoria são cross-cutting mas precisam das tabelas dos módulos que
   auditam/notificam já existirem.
3. Cada task referencia o(s) BR-code(s) do BRD e a seção do documento de spec relevante
   entre parênteses — leia o trecho referenciado antes de implementar.

---

## 1. SETUP — Infraestrutura Base

- [x] SETUP-01 Adicionar dependências novas ao `package.json`: `drizzle-orm`,
      `drizzle-kit`, `better-auth`, `xlsx`, `resend`, `lucide-react` (DESIGN.md §16).
- [x] SETUP-02 Criar `.env.example` com todas as variáveis de `DESIGN.md` §17
      (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `MONGODB_URI`, `BETTER_AUTH_SECRET`,
      `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET`,
      `RESEND_API_KEY`, `CRON_SECRET`, `STAFF_INACTIVITY_TIMEOUT_MINUTES`).
- [x] SETUP-03 Criar `db/schema/index.ts` (barrel) e `drizzle.config.ts` apontando para
      `DATABASE_URL_UNPOOLED`, `casing: 'snake_case'` (DB_SCHEMA.md §2, §11).
- [x] SETUP-04 Criar cliente Drizzle runtime em `src/shared/db/postgres/` usando
      `@neondatabase/serverless` + `DATABASE_URL` (pooled) (DESIGN.md §5, §11).
- [x] SETUP-05 Habilitar `cacheComponents: true` em `next.config.ts` (DESIGN.md §7).
- [x] SETUP-06 Criar `src/shared/kernel/` com `Result<T, E>`, `Entity` base, `UseCase`
      base e `DomainError` (DESIGN.md §5).
- [x] SETUP-07 Criar esqueleto de pastas por módulo em `src/modules/` (`identidade`,
      `voluntariado`, `estoque`, `logistica`, `notificacoes`, `auditoria`, `contingencia`),
      cada um com `domain/`, `application/{use-cases,ports}`, `infrastructure/`,
      `presentation/{actions,queries}` (DESIGN.md §5).
- [x] SETUP-08 Criar `src/shared/cache/` com constantes de `cacheTag` e perfis de
      `cacheLife` usados na tabela de DESIGN.md §7.

---

## 2. IDENTIDADE — Autenticação, Sessão, Perfil de Voluntário

- [x] ID-01 Configurar `better-auth` em `src/shared/auth/`: `emailAndPassword` habilitado,
      `socialProviders: { google, facebook }` (Instagram fora do MVP), `role` e `ativo`
      como `additionalFields` em `user`, `lastActivityAt` em `session` (DESIGN.md §6.1,
      DB_SCHEMA.md §4.1).
- [x] ID-02 Rodar `npx @better-auth/cli generate` para gerar `user`, `session`, `account`,
      `verification` em `db/schema/identidade.ts` e aumentar manualmente com os
      `additionalFields` de ID-01.
- [x] ID-03 Criar handler `app/api/auth/[...all]/route.ts` do better-auth.
- [x] ID-04 Rodar migration inicial (`drizzle-kit generate` + aplicar) para as tabelas de
      Identidade.
- [x] ID-05 Implementar `proxy.ts` (Node runtime): checagem de sessão via cookie
      (`getSessionCookie`), mapa rota→roles de DESIGN.md §6.2, `config.matcher` excluindo
      `/api/auth/*`/assets/landing pública.
- [ ] ID-06 Implementar timeout de inatividade customizado (DESIGN.md §6.3):
      `lastActivityAt` atualizado em `proxy.ts` para `membro_defesa_civil`/`coordenador`;
      checagem de expiração por `STAFF_INACTIVITY_TIMEOUT_MINUTES` forçando novo login via
      `auth.api.signOut`.
- [x] ID-07 Criar `(staff)/layout.tsx` com re-checagem de sessão/role via
      `auth.api.getSession` no servidor (defesa em profundidade, DESIGN.md §6.2).
- [x] ID-08 Modelar `habilidade` e `voluntario_habilidade` em
      `db/schema/voluntariado.ts` (tabela lookup livre + join N:N) e seed inicial
      (Motosserra, CNH D/E, Embarcação, Primeiros Socorros) (DB_SCHEMA.md §4.3, §14).
- [x] ID-09 Modelar `voluntario_perfil` em `db/schema/voluntariado.ts` com todos os
      campos de DB_SCHEMA.md §4.2 (incluindo índice único de `cpf`).
- [x] ID-10 Implementar validações de domínio em `src/modules/identidade/domain/` (ou
      `voluntariado/domain/`, conforme DESIGN.md §3): maioridade (≥18 anos a partir de
      `dataNascimento`), dígito verificador de CPF, formato de e-mail/telefone.
- [x] ID-11 Criar script/seed de bootstrap de um usuário `administrador` inicial fora do
      fluxo de candidatura pública (DB_SCHEMA.md §14).
- [x] ID-12 Páginas `(auth)/login/page.tsx` com e-mail/senha + botões de login social
      (Google/Facebook).

---

## 3. DESIGN SYSTEM — Tema e Componentes Ark UI

- [x] DS-01 Aplicar tokens de cor (`primary`, `neutral`, `success`, `warning`, `danger`,
      `info`, `surface`, `surface-muted`, `border`, `border-strong`,
      `primary-foreground`) em `app/globals.css`, extendendo `@theme inline` e os blocos
      `:root`/`:root.dark` existentes (DESIGN_SYSTEM.md §1.1, §2).
- [x] DS-02 Adicionar `lucide-react` e definir convenções de tamanho/stroke-width
      (DESIGN_SYSTEM.md §1.8).
- [x] DS-03 Implementar componentes primitivos de formulário: `Button`, `IconButton`
      (DESIGN_SYSTEM.md §4.1) em `src/shared/ui/button/`, `src/shared/ui/icon-button/`.
- [x] DS-04 Implementar `Input`, `Textarea`, `NumberInput` (Ark UI `NumberInput`) em
      `src/shared/ui/{input,textarea,number-input}/` com estado de erro
      (`aria-invalid`/`aria-describedby`) (DESIGN_SYSTEM.md §4.2).
- [x] DS-05 Implementar `Select` (Ark UI) em `src/shared/ui/select/`
      (DESIGN_SYSTEM.md §4.3).
- [x] DS-06 Implementar `Combobox` (Ark UI) em `src/shared/ui/combobox/`, genérico o
      suficiente para ser reusado no autocomplete de item de estoque (DESIGN_SYSTEM.md
      §4.4).
- [x] DS-07 Implementar `CheckboxGroup`, `RadioGroup`, `Switch` (Ark UI) em
      `src/shared/ui/{checkbox-group,radio-group,switch}/` (DESIGN_SYSTEM.md §4.5).
- [x] DS-08 Implementar `DatePicker` (Ark UI, locale pt-BR, formato `dd/mm/aaaa`) em
      `src/shared/ui/date-picker/` (DESIGN_SYSTEM.md §4.6).
- [x] DS-09 Implementar `Dialog`/`Drawer` (Ark UI) em `src/shared/ui/{dialog,drawer}/`
      (DESIGN_SYSTEM.md §4.7).
- [x] DS-10 Implementar `Toast` (Ark UI `createToaster`) em `src/shared/ui/toast/`
      (DESIGN_SYSTEM.md §4.8).
- [x] DS-11 Implementar `Tabs`, `Accordion` (Ark UI) em
      `src/shared/ui/{tabs,accordion}/` (DESIGN_SYSTEM.md §4.9).
- [x] DS-12 Implementar `Tooltip`, `Popover`, `Menu` (Ark UI) em
      `src/shared/ui/{tooltip,popover,menu}/` (DESIGN_SYSTEM.md §4.10).
- [x] DS-13 Implementar `Avatar` (Ark UI) e `Badge`/Tag próprio (cores da tabela §3) em
      `src/shared/ui/{avatar,badge}/` (DESIGN_SYSTEM.md §4.11, §3).
- [x] DS-14 Implementar `Progress`/`ProgressCircle` (Ark UI) e `StatCard` próprio em
      `src/shared/ui/{progress,stat-card}/` (DESIGN_SYSTEM.md §4.12).
- [x] DS-15 Implementar `Pagination` (Ark UI, server-side) e `Table` (wrapper sobre
      TanStack Table headless) em `src/shared/ui/{pagination,table}/`
      (DESIGN_SYSTEM.md §4.13).
- [x] DS-16 Implementar `Alert`/Banner próprio em `src/shared/ui/alert/`
      (DESIGN_SYSTEM.md §4.14).
- [x] DS-17 Implementar `Skeleton` próprio em `src/shared/ui/skeleton/`
      (DESIGN_SYSTEM.md §4.15).
- [x] DS-18 Implementar `KanbanCard`/`KanbanColumn` próprios (sem drag-and-drop) em
      `src/shared/ui/kanban/`, com destaque de déficit por turno (DESIGN_SYSTEM.md §4.16,
      §3).
- [x] DS-19 Validar todos os componentes DS-03..DS-18 em claro/escuro e em duas larguras
      (mobile ~375px, desktop ~1280px) antes de integrá-los a telas de negócio
      (DESIGN_SYSTEM.md §6, §7).

---

## 4. VOLUNTARIADO — Candidatura, Triagem, Atividades e Turnos

- [ ] VOL-01 Modelar `atividade_categoria`, `atividade`, `turno`, `alocacao` em
      `db/schema/voluntariado.ts` e gerar/aplicar migration (DB_SCHEMA.md §5).
- [ ] VOL-02 Implementar formulário público de candidatura
      (`app/(public)/voluntariado/candidatura/page.tsx`) com todos os campos de BRD §3.1
      (react-hook-form + zod), incluindo campo condicional `Tipo de Veículo` quando
      `veiculoProprio = true`.
- [ ] VOL-03 UseCase `SubmeterCandidaturaUseCase`: cria/atualiza `voluntario_perfil` com
      `status = 'pendente'`; reenvio de candidatura rejeitada reaproveita a mesma linha
      por CPF, limpando `aprovadoPor`/`aprovadoEm`/`motivoRejeicao` (BR-VOL-01,
      DESIGN.md §10.1).
- [ ] VOL-04 Query + página `(staff)/cadastros-pendentes/page.tsx`: fila de candidaturas
      `status = 'pendente'`, com detalhe (Dialog) e ações Aprovar/Rejeitar (BR-VOL-01,
      BR-VOL-02).
- [ ] VOL-05 UseCase `AprovarCandidaturaUseCase`: transação Postgres atualizando
      `voluntario_perfil.status = 'aprovado'` + `user.role = 'voluntario'`, seguido de
      notificação `triagem_concluida` e auditoria best-effort (BR-VOL-03, DESIGN.md §4
      trace, §10.1).
- [ ] VOL-06 UseCase `RejeitarCandidaturaUseCase`: `status = 'rejeitado'` +
      `motivoRejeicao` (BR-VOL-02).
- [ ] VOL-07 Server Actions `aprovarCandidatura`/`rejeitarCandidatura` em
      `presentation/actions/`, com `revalidateTag('voluntariado:pendentes')`.
- [ ] VOL-08 CRUD de `atividade` (Título, Categoria, Local, Vagas) — página
      `(staff)/atividades/page.tsx` + Server Actions de criar/editar/cancelar
      (BRD §3.3).
- [ ] VOL-09 Fragmentação de Atividade em `turno`s de 4 horas: validação no `domain`
      (não `CHECK` de banco) rejeitando blocos ≠ 4h, com mensagem de erro específica
      (BR-VOL-04, DESIGN.md §10.2).
- [ ] VOL-10 UseCase de Alocação: Coordenador seleciona voluntário (filtrável por
      `habilidade` via `voluntario_habilidade`) e vincula a um `turno`, respeitando
      `unique(turnoId, voluntarioPerfilId)` (BR-VOL-05).
- [ ] VOL-11 Página `(staff)/atividades/[id]/page.tsx` — painel Kanban/lista por
      atividade, exibindo vagas preenchidas (`count(alocacao where status='confirmado')`)
      vs. `turno.vagas`, destaque vermelho em turnos deficitários, usando
      `KanbanColumn`/`KanbanCard` (DS-18) e colapsando para lista em mobile
      (BRD §3.3, DESIGN.md §10.2).
- [ ] VOL-12 Listagem paginada de voluntários (TanStack Table, server-side pagination),
      filtrável por habilidade/status (DESIGN.md §7, §8).
- [ ] VOL-13 Página `voluntariado/minhas-atividades` para o voluntário visualizar suas
      atividades/turnos atribuídos (BRD §2, matriz de permissões).

---

## 5. ESTOQUE/DOAÇÕES — Item, Entrada, Kits, Saída, Descarte, Saldo

- [ ] EST-01 Modelar `item`, `saldo_estoque` em `db/schema/estoque.ts` com índice
      GIN/trigram (`pg_trgm`) em `item.nome` e gerar/aplicar migration (DB_SCHEMA.md §6.1,
      §6.6, §12).
- [ ] EST-02 Modelar `entrada` em `db/schema/estoque.ts` com todos os campos de BRD §4.1
      (categoria/condição/unidade como enums fixos, `kitDestinoId` apenas informativo)
      (DB_SCHEMA.md §6.2).
- [ ] EST-03 Implementar Combobox de "Nome do Item" com autocomplete via índice trigram
      (debounce 200–300ms), reusando DS-06, para evitar duplicidade de cadastro
      (BR-EST-01).
- [ ] EST-04 UseCase `RegistrarEntradaUseCase`: valida `dataValidade` obrigatória e não
      retroativa quando `perecivel = true` (domínio); em uma transação, cria `entrada` e
      incrementa `saldo_estoque.quantidadeAtual` (DESIGN.md §9.1). Página
      `(staff)/estoque/entrada/page.tsx`.
- [ ] EST-05 Modelar `kit`, `kit_receita_item` em `db/schema/estoque.ts`
      (`unique(kitId, itemId)`) e gerar/aplicar migration (DB_SCHEMA.md §6.3).
- [ ] EST-06 CRUD de Kits (nome, descrição, ativo) + composição da receita
      (kit + item + quantidade por unidade de kit) — página `(staff)/estoque/kits/page.tsx`
      (BR-EST-02, BR-EST-03).
- [ ] EST-07 Modelar `saida`, `saida_item` em `db/schema/estoque.ts` e gerar/aplicar
      migration (DB_SCHEMA.md §6.4).
- [ ] EST-08 UseCase `RegistrarSaidaUseCase` (uma única Server Action, payload em lote):
      para saída de kit, expande a receita × quantidade e consolida por item; lê
      `saldo_estoque` com `FOR UPDATE`; valida saldo suficiente por item; se déficit,
      aborta a transação e retorna erro específico por item ("Saída bloqueada. Faltam
      X {unidade} de {item}..."); se ok, insere `saida`/`saida_item` e decrementa o saldo
      — tudo na mesma transação (BR-EST-04, DESIGN.md §9.3, pseudocódigo completo).
- [ ] EST-09 Página `(staff)/estoque/saida/page.tsx`: formulário com seleção
      Avulso/Kit, quantidade, destino (texto livre), responsável pelo transporte;
      exibição do erro de déficit por item vindo do UseCase.
- [ ] EST-10 Modelar `descarte` em `db/schema/estoque.ts` e gerar/aplicar migration
      (tabela dedicada, nunca flag em `saida`) (DB_SCHEMA.md §6.5, DESIGN.md §9.4).
- [ ] EST-11 UseCase `RegistrarDescarteUseCase` + página
      `(staff)/estoque/descarte/page.tsx` (BR-EST-05).
- [ ] EST-12 Listagem paginada de estoque (TanStack Table, server-side pagination,
      filtro por categoria/condição), com leitura de listagem respeitando o requisito de
      <300ms via cache (`estoque:listagem`) (DESIGN.md §7, NFR §4.1).

---

## 6. LOGÍSTICA/INTELIGÊNCIA — Dashboard de Crise

- [ ] LOG-01 Modelar `crise_variaveis` (append-only) e `metrica_kit` em
      `db/schema/logistica.ts` e gerar/aplicar migration (DB_SCHEMA.md §7).
- [ ] LOG-02 Tela para a Defesa Civil atualizar `totalFamiliasAfetadas` e
      `totalPessoasAfetadas` (nova linha append-only a cada atualização) (BRD §5).
- [ ] LOG-03 Tela/CRUD de `metrica_kit` (associar kit a `baseDemanda` e `proporcao`)
      (BR-INT-01).
- [ ] LOG-04 Implementar cálculo de "Kits Necessários (Demanda)": para kits
      `por_familia`, `totalFamiliasAfetadas × proporcao`; para `por_pessoa_desabrigada`,
      `totalPessoasAfetadas × proporcao` (BR-INT-01, DESIGN.md §11).
- [ ] LOG-05 Implementar cálculo de "Kits Possíveis (Capacidade)": para cada kit,
      `min` sobre `floor(saldo_estoque[componente].quantidadeAtual /
      kit_receita_item.quantidade)` entre todos os componentes (BR-INT-02, DESIGN.md
      §11).
- [ ] LOG-06 Página `(staff)/dashboard/page.tsx` com `StatCard`s (DS-14) para os dois
      indicadores, usando `cacheTag('dashboard:kits')` invalidado por entrada, saída,
      descarte, alteração de receita de kit ou de `crise_variaveis`/`metrica_kit`
      (BR-INT-02, DESIGN.md §7, §11).

---

## 7. NOTIFICAÇÕES — Eventos, E-mail, Cron, Alertas

- [ ] NOT-01 Modelar `notificacao`, `notificacao_envio` em
      `db/schema/notificacoes.ts` e gerar/aplicar migration (DB_SCHEMA.md §8).
- [ ] NOT-02 Definir interface `NotificacaoService` em
      `src/modules/notificacoes/application/ports/` com catálogo de eventos 1:1 com BRD
      §6 (`triagem_concluida`, `atividade_atribuida`, `alteracao_atividade`,
      `lembrete_turno`, `broadcast_urgencia`, `cadastros_acumulados`, `estoque_critico`,
      `deficit_atendimento`) (DESIGN.md §12).
- [ ] NOT-03 Implementar adapter de e-mail (Resend) e adapter in-plataforma (grava em
      `notificacao`) em `src/modules/notificacoes/infrastructure/` (DESIGN.md §12).
- [ ] NOT-04 Ligar disparo de `triagem_concluida` ao UseCase de aprovação (VOL-05) e
      `atividade_atribuida`/`alteracao_atividade` aos UseCases de alocação/edição de
      atividade (BRD §6).
- [ ] NOT-05 Implementar Server Action de Broadcast de Urgência em lote (Coordenador →
      todos os voluntários ou subconjunto filtrado), processando em chunks dentro da
      mesma invocação (DESIGN.md §12).
- [ ] NOT-06 Implementar rota `app/api/cron/lembrete-turno/route.ts` (protegida por
      `Authorization: Bearer $CRON_SECRET`): busca `alocacao` join `turno` com
      `turno.inicio` entre 105–120 min no futuro e `lembreteEnviadoEm IS NULL`, dispara
      notificação e marca `lembreteEnviadoEm = now()` (DESIGN.md §12).
- [ ] NOT-07 Configurar `vercel.json` com Cron agendando
      `GET /api/cron/lembrete-turno` a cada ~15 minutos (DESIGN.md §12).
- [ ] NOT-08 Implementar alertas de coordenador gerados em leitura (não job separado):
      `cadastros_acumulados` (contador da fila pendente), `estoque_critico` (item abaixo
      do mínimo de segurança), `deficit_atendimento` (capacidade de kits abaixo da
      demanda) — idempotentes, uma notificação por condição ativa (BRD §6, DESIGN.md
      §12).
- [ ] NOT-09 Sino/lista de notificações in-app (contador de não lidas via índice
      `notificacao(destinatarioUserId, lida)`) no header/shell da área `(staff)`.

---

## 8. AUDITORIA — Log Imutável (BR-AUD-01)

- [ ] AUD-01 Criar coleção `audit_logs` no MongoDB Atlas (reusando
      `src/shared/db/mongo/client.ts` já existente) com os índices de DB_SCHEMA.md §9:
      `{entidade,entidadeId,timestamp}`, `{userId,timestamp}`, `{timestamp}`.
- [ ] AUD-02 Configurar usuário do Atlas usado pela aplicação sem grant de
      delete/update na coleção `audit_logs` (recomendação operacional de DB_SCHEMA.md §9).
- [ ] AUD-03 Implementar `AsyncLocalStorage` para propagar `{userId, role}` do ator uma
      vez por requisição, populado a partir da sessão autenticada (DESIGN.md §13).
- [ ] AUD-04 Implementar wrapper `withAudit(actor, entidade, acao, fn)` em
      `src/modules/auditoria/`: captura `dadosAnteriores` (leitura pré-mutação) e
      `dadosNovos` (resultado da mutação), grava em `audit_logs`; falha degrada
      graciosamente (operação Postgres original prossegue) com 1 retry automático antes
      de logar a falha (DESIGN.md §13).
- [ ] AUD-05 Integrar `withAudit` em todos os UseCases de escrita de `voluntario_perfil`
      (transições de status), `atividade`/`turno`/`alocacao`, e
      `entrada`/`saida`/`saida_item`/`descarte`/`kit`/`kit_receita_item` (DB_SCHEMA.md
      §10 — mapeamento BR-AUD-01 → tabelas concretas).

---

## 9. RELATÓRIOS E EXPORTAÇÃO (BR-REL-01)

- [ ] REL-01 Implementar `GET /api/relatorios/export?tipo=inventario&formato=csv|xlsx`
      a partir de `saldo_estoque` + `item`, usando `xlsx` (SheetJS), protegido pela role
      de `(staff)/relatorios` (DESIGN.md §14).
- [ ] REL-02 Implementar `GET /api/relatorios/export?tipo=saidas&formato=csv|xlsx` a
      partir de `saida`/`saida_item` (DESIGN.md §14).
- [ ] REL-03 Página `(staff)/relatorios/page.tsx` com `Tabs` (DS-11) separando
      Inventário Atual e Histórico de Saídas, com botões de exportação CSV/XLSX.

---

## 10. PACOTE DE CONTINGÊNCIA (BR-CON-01)

- [ ] CON-01 Implementar `GET /api/contingencia/export`: workbook `xlsx` com 4 abas —
      (1) saldo exato de `saldo_estoque`+`item` no momento do download, (2) formulário em
      branco para Entradas, (3) formulário em branco para Saídas, (4) formulário em
      branco para gestão de turnos de voluntários (DESIGN.md §15).
- [ ] CON-02 Botão "Gerar Pacote de Contingência" (link simples `<a href=...>`, nunca
      cacheado) acessível a Coordenador/Administrador (DESIGN.md §15).

---

## 11. TESTES

- [ ] TEST-01 Adicionar `vitest` como devDependency e configurar `vitest.config.ts`
      (DESIGN.md §18).
- [ ] TEST-02 Testes unitários de `domain`: maioridade (≥18), dígito verificador de CPF,
      validação de bloco de 4h por turno, validação de data de validade não retroativa.
- [ ] TEST-03 Testes unitários de `application`: expansão de receita de kit +
      consolidação por item (múltiplos kits na mesma saída).
- [ ] TEST-04 Teste de integração (banco Neon de desenvolvimento): fluxo completo de
      aprovação de candidatura (troca de `role` na mesma transação).
- [ ] TEST-05 Teste de integração: fluxo completo de saída de kit — cenário de sucesso
      (dedução atômica) e cenário de falha (bloqueio com mensagem de déficit por item,
      saldo inalterado).

---

## 12. DEPLOY/FINALIZAÇÃO

- [ ] DEPLOY-01 Configurar todas as variáveis de ambiente de DESIGN.md §17 no projeto
      Vercel (produção/preview).
- [ ] DEPLOY-02 Validar `vercel.json` (cron de lembrete de turno) em produção.
- [ ] DEPLOY-03 Checklist final de responsividade: cada tela testada em mobile (~375px),
      tablet (~768px) e desktop (~1280px) (DESIGN_SYSTEM.md §1.7, §6).
- [ ] DEPLOY-04 Checklist final de tema: cada tela testada em claro e escuro
      (DESIGN_SYSTEM.md §6).
- [ ] DEPLOY-05 Checklist final de idioma: nenhum texto em inglês hardcoded na UI —
      toda a interface em pt-BR (NFR §2.2, DESIGN_SYSTEM.md §6).
- [ ] DEPLOY-06 Verificação end-to-end de cada BR-code do BRD (§3–§7) contra a aplicação
      implementada — percorrer a matriz de atores/permissões (BRD §2) com um usuário de
      cada role.

---

## Como usar este arquivo

1. Marque `[x]` somente após a funcionalidade estar implementada **e** verificada
   manualmente — código escrito sem teste funcional permanece `[ ]`.
2. Não pule a ordem das seções sem necessidade: há dependências reais entre módulos
   (ex.: nenhuma task de Estoque/Voluntariado antes de Identidade, pois quase toda tabela
   de negócio referencia `user.id`).
3. Qualquer dúvida sobre comportamento, campo ou regra deve ser resolvida lendo o
   documento de spec referenciado na task — não deve ser decidida ad-hoc.
