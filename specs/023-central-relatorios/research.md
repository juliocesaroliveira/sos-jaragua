# Research: Central de relatórios

**Feature**: 023-central-relatorios | **Date**: 2026-10-08

Nenhum item do Technical Context ficou como NEEDS CLARIFICATION — as duas decisões de produto
em aberto foram respondidas na spec (Clarifications, sessão 2026-10-08). Esta pesquisa registra
as decisões técnicas tomadas a partir da varredura do código.

---

## D1 — Evoluir `/relatorios` em vez de criar seção nova

- **Decision**: `/relatorios` vira o **catálogo**; cada relatório ganha uma página própria em
  `/relatorios/[relatorio]`. O pacote de contingência fica no catálogo.
- **Rationale**: a rota, o item de menu, o card da home e a regra de acesso
  (`membro_defesa_civil`, `administrador`) já existem e estão travados por
  `navegacao.test.ts` (INV-01..06). Uma página por relatório dá a cada um uma URL estável com os
  filtros no endereço (FR-012) e permite regra de acesso por prefixo de rota — necessária para a
  trilha só-administrador (D3).
- **Alternatives considered**:
  - *Abas numa única página* (modelo atual): 17 abas não cabem em celular (FR-013) e não
    permitem regra de rota por relatório.
  - *Nova rota `/central-relatorios`*: duplicaria item de menu e regra de autorização.

## D2 — Uma definição por relatório, usada pela prévia e pela exportação

- **Decision**: cada relatório é uma `DefinicaoRelatorio` (ver data-model.md) com esquema de
  filtros, colunas (`Coluna<T>` já usado por `planilha.ts`), carregador paginável e resumo
  opcional. A prévia recebe as **células já formatadas no servidor** (`string | number | null`)
  e um único componente cliente genérico as renderiza.
- **Rationale**: hoje as colunas da tela (`painel-relatorios.tsx`) e da exportação
  (`relatorios.ts`) são declaradas duas vezes e já divergem (a tela não mostra "Unidade" nem
  "Estoque mínimo"). Com uma definição só, prévia e arquivo são iguais por construção. Funções
  de coluna não atravessam a fronteira servidor→cliente, por isso a formatação acontece no
  servidor.
- **Alternatives considered**: 17 componentes cliente com colunas próprias — 17 pontos de
  divergência e ~17× o código de UI.

## D3 — Autorização por relatório derivada de `REGRAS_DE_ROTA`

- **Decision**: cada definição declara sua `rota` (`/relatorios/<slug>`). Nova regra
  `{ prefixo: '/relatorios/auditoria', roles: ['administrador'] }` **antes** de `/relatorios`.
  A Server Action de consulta e o Route Handler de exportação checam
  `podeAcessar(definicao.rota, role)` — não uma lista própria. O catálogo exibe só as definições
  em que `podeAcessar` é verdadeiro.
- **Rationale**: o proxy decide por prefixo de **path**; um `?tipo=auditoria` no endpoint de
  exportação não seria distinguível pelo proxy. Derivar o gate do download da rota da tela é o
  mesmo padrão já usado em `app/api/relatorios/export/route.ts` (`rolesExigidas`), e garante que
  "tela proibida ⇒ download proibido" sem segunda lista.
- **Alternatives considered**: endpoint dedicado `/api/relatorios/auditoria/export` com regra
  própria — funciona, mas cria um segundo handler quase idêntico; o gate por definição cobre
  todos os relatórios futuros de uma vez.

## D4 — Leitura dos dados respeita as fronteiras de módulo (Princípio I)

- **Decision**: cada módulo dono dos dados expõe consultas de relatório em
  `src/modules/<modulo>/presentation/queries/relatorios.ts` (Estoque, Voluntariado, Logística,
  Notificações, Identidade) e `auditoria/presentation/queries/trilha.ts`. O módulo
  Contingência/Relatórios só orquestra: catálogo, filtros, colunas, paginação e arquivo.
- **Rationale**: DESIGN.md §3 define Contingência como "orquestrador read-only" sem acesso a
  tabelas de outros módulos; é o que já acontece com `inventarioParaExportacao`.
- **Alternatives considered**: consultas SQL dentro de `contingencia/` — mais rápido de
  escrever, viola o Princípio I.

## D5 — Sem cache nas leituras de relatório

- **Decision**: consultas de relatório não usam `'use cache'`; as páginas chamam
  `connection()`. No cliente, a `queryKey` é `['relatorios', slug, filtros, página]`.
- **Rationale**: FR-009 (estado do momento). Relatórios são lidos raramente e com filtros de
  alta cardinalidade — cache teria baixa taxa de acerto e encheria o cache de entradas únicas
  (mesmo argumento usado para `sugerirItens`). A trilha de auditoria nem teria tag de
  invalidação (escritas no Mongo não passam por `updateTag`).
- **Alternatives considered**: reaproveitar `listarSaidas` cacheado com tag — correto para
  saídas, mas não generaliza para Mongo nem para os agregados.

## D6 — Período em horário de Brasília

- **Decision**: filtro de período chega como datas `AAAA-MM-DD` (inclusivas). Função pura de
  domínio converte para o intervalo semiaberto `[início 00:00 BRT, (fim + 1 dia) 00:00 BRT)` em
  instantes UTC, obtendo o deslocamento do fuso via `Intl` (não constante `-03:00`). Padrão:
  últimos 30 dias, incluindo hoje. Rejeita `início > fim` e `início` no futuro.
- **Rationale**: edge case da spec (23h30 de 05/10 pertence a 05/10). Intervalo semiaberto evita
  o `23:59:59.999`. `Intl` mantém o cálculo certo se o horário de verão voltar.
- **Alternatives considered**: `AT TIME ZONE` no SQL — não serve ao Mongo; manter a regra em um
  único lugar testável é mais seguro.

## D7 — Cabeçalho do documento e proteção contra fórmula nas exportações

- **Decision**: `Aba<T>` ganha `cabecalhoDocumento?: { rotulo: string; valor: string }[]` e
  `resumo?: { rotulo: string; valor: string | number }[]`. XLSX: linhas de identificação no topo,
  linha em branco, cabeçalho da tabela; o painel congelado passa a ficar abaixo do cabeçalho da
  tabela. CSV: as mesmas linhas como `rotulo;valor`, linha em branco, tabela. Textos que começam
  com `=`, `+`, `-`, `@`, TAB ou CR recebem prefixo `'` **no CSV**; no XLSX as células de texto
  já são gravadas como string (o `exceljs` só cria fórmula com `{ formula }`), e um teste trava
  isso.
- **Rationale**: FR-008 e FR-011 (recomendação OWASP de CSV injection). O pacote de contingência
  não usa os campos novos e continua igual (FR-004).
- **Alternatives considered**: aba separada "Sobre este relatório" — some no CSV e ninguém lê.

## D8 — Limite e transporte da exportação

- **Decision**: o Route Handler responde em **streaming** (`ReadableStream`), nunca com um
  buffer pronto. CSV: lê as linhas em lotes de 2.000 (`carregar` com paginação interna) e
  envia cada lote assim que fica pronto. XLSX: `ExcelJS.stream.xlsx.WorkbookWriter` gravando
  num `PassThrough`, convertido com `Readable.toWeb`. O teto de **50.000 linhas** (SC-004)
  continua valendo, agora para limitar duração e memória e não o tamanho da resposta. O
  handler conta antes de começar; acima do teto responde `422` orientando a reduzir o
  período, e a tela desabilita os botões quando `totalCount` passa do limite.
- **Rationale**: o limite de 4,5 MB vale para o corpo de resposta das Vercel Functions, mas
  **não para respostas em streaming** (Vercel KB, "How do I bypass the 4.5MB body size limit
  of Vercel Functions"). 50 mil saídas em CSV dão cerca de 7–10 MB, então um buffer pronto
  falharia com `413 FUNCTION_PAYLOAD_TOO_LARGE`. Ler em lotes também evita ter as 50 mil
  linhas inteiras na memória.
- **Alternatives considered**: (a) baixar o teto até caber em 4,5 MB, o que corta o volume
  útil de prestação de contas; (b) gerar o arquivo no Vercel Blob e redirecionar, o que
  exige armazenamento temporário e limpeza, contra o Princípio VI.

## D9 — Trilha de auditoria (Mongo)

- **Decision**: leitor em `auditoria/infrastructure/audit-reader.ts` (somente `find`/
  `countDocuments`, nunca update/delete — FR-022), com `maxTimeMS` e timeout de seleção de
  servidor curtos. Indisponibilidade vira erro tipado `auditoria_indisponivel`, tratado só na
  página da trilha (FR-023). Filtros: período (`timestamp`), entidade, ação, autor (`userId`).
  Ordenação `timestamp: -1` usa os índices existentes (`{timestamp:-1}`,
  `{userId:1,timestamp:-1}`). Nome do autor resolvido em lote por
  `identidade/presentation/queries/relatorios.ts#nomesPorIds`; ausente ⇒ "usuário não
  encontrado". O diff antes/depois é função pura de domínio (campos alterados, adicionados,
  removidos) usada pela prévia (detalhe expansível) e pela coluna "Alterações" da exportação.
- **Rationale**: a coleção já tem os índices certos (DB_SCHEMA.md §9); diff no domínio é
  testável sem Mongo.
- **Alternatives considered**: diff no cliente — mandaria os snapshots inteiros ao navegador.

## D10 — Dados sensíveis completos (Clarification Q1 = C)

- **Decision**: CPF e restrições de saúde aparecem completos em R-09 e na trilha. A página do
  relatório mostra um `Alert` de aviso LGPD acima dos botões de exportação quando a definição
  tem `contemDadosSensiveis: true`.
- **Rationale**: decisão do responsável; o aviso é o mínimo de controle sem esconder dado.
  A proteção at-rest/TLS continua sendo a do Princípio IV.

## D11 — Regras de cálculo dos relatórios agregados

| Relatório | Regra |
| --- | --- |
| R-05 Estoque crítico | Reusa `itensCriticos`/`limiarDoItem` (`estoque/domain/estoque-minimo.ts`) e `limiarEstoqueMinimoGlobal()`; ordena por falta proporcional `(limiar − saldo) / limiar` desc. Itens com mínimo `0` nunca entram; itens "aguardando primeira entrada" ficam fora (feature 022). |
| R-06 Validades | `entrada.perecivel = true` e `dataValidade <= hoje + horizonte`; situação "Vencida" se `< hoje`. Horizonte: 1–365 dias, padrão 30. |
| R-07 Movimentação | Por item: `E`, `S`, `D` somados no período; `saldoFinal = saldoAtual − (E′ − S′ − D′)` onde `′` são movimentos **após** o fim do período; `saldoInicial = saldoFinal − E + S + D`. Teste de integração garante o fechamento contra `saldo_estoque` (SC-003). |
| R-08 Entregas por destino | Chave de agrupamento `lower(trim(destino))` com colapso de espaços internos; exibe a grafia mais frequente. |
| R-10 Triagem | Período sobre a data de envio. Envio = `atualizadoEm` para pendentes (reenvio reescreve a linha), `criadoEm` para decididos; tempo até decisão = `aprovadoEm − criadoEm`. Limitação (reenvio apaga a decisão anterior) declarada na prévia. |
| R-12 Ocupação | `confirmados = count(alocacao.status = 'confirmado')`; ocupação = confirmados ÷ vagas. Período sobre `turno.inicio`. |
| R-13 Participação | Soma de `fim − inicio` dos turnos com alocação confirmada que começam no período. |
| R-14 Evolução da crise | Variação = valor − valor da atualização imediatamente anterior (inclusive anterior ao período, para a primeira linha). |
| R-15 Demanda × capacidade | Chama `projecaoAtual()` (sem cache) de `logistica/presentation/queries/dashboard.ts` — mesmo use case do Painel (SC-007). |
| R-16 Notificações | Totais por `tipo × canal × status` de `notificacao_envio` cuja notificação foi criada no período; lista as `falhou` com `erro`. |

## D12 — Índices novos

- **Decision**: migration com três índices: `entrada(criado_em)`, `descarte(criado_em)`,
  `notificacao(criado_em)`.
- **Rationale**: os índices existentes começam por `item_id`/`tipo` e não servem a filtro só por
  período; `notificacao` cresce rápido com broadcast. Demais tabelas filtradas por período já
  têm índice (`saida_criado_idx`, `turno_inicio_idx`, `crise_variaveis_atualizado_idx`) ou são
  pequenas (`voluntario_perfil`).
- **Alternatives considered**: não indexar — aceitável hoje, mas a trilha de notificações é a
  primeira a degradar numa crise real.
