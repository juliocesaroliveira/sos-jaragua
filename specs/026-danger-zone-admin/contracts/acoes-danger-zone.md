# Contrato: Server Actions da Danger Zone

Arquivo: `src/modules/manutencao/presentation/actions/danger-zone.ts` (`'use server'`).
Todas devolvem `ResultadoAction<T>` (`src/shared/kernel/action.ts`). Entradas validadas por Zod
como **contrato** (forma), não como regra — a regra mora no domínio.

## Regras comuns (A-00)

- **A-00.1** Toda action relê a sessão com `obterSessao()` e exige `role = 'administrador'`;
  caso contrário devolve `nao_autorizado` sem revelar nada sobre tabelas ou registros.
- **A-00.2** Actions que **alteram** dados (`executarAcaoAction`) exigem também sessão criada há
  ≤ 15 min (research D11); senão `reautenticacao_necessaria`.
- **A-00.3** Todas rodam dentro de `comAtorDaSessao`, para que o ator chegue à auditoria.
- **A-00.4** Nenhuma resposta contém valor sensível em texto plano nem coluna de credencial.
- **A-00.5** Mensagens de erro em pt-BR; códigos estáveis abaixo.

| Código | Quando |
|---|---|
| `nao_autorizado` | sem sessão ou não-admin |
| `reautenticacao_necessaria` | sessão com mais de 15 min (só execução) |
| `tabela_desconhecida` | tabela fora do catálogo |
| `catalogo_divergente` | tabela ligada a vínculo não classificado (FR-013a); `detalhes.vinculos` |
| `registro_protegido` | seleção inclui registro padrão ou a própria conta |
| `modo_obrigatorio` | há dependentes e `modo` ausente |
| `confirmacao_invalida` | texto digitado ≠ `textoConfirmacao` |
| `dados_mudaram` | impressão digital divergente; `detalhes.previa` traz a prévia nova |
| `auditoria_indisponivel` | ping ou gravação de snapshots falhou |
| `falha_execucao` | erro no Postgres; nada foi alterado |

---

## C-01 `inventarioAction()`

Lista as tabelas do catálogo (FR-004, FR-005).

**Saída**: `{ ambiente, tabelas: Array<{ nome, rotulo, area, registros, registrosSistema,
dependentes: string[], dependeDe: string[], disponivel: boolean, motivoIndisponivel?: string }> }`

`registros` exclui registros padrão; `registrosSistema` os conta à parte. `disponivel = false` com
`registros = 0` → "sem registros" (edge case tabela vazia); com vínculo não classificado →
`motivoIndisponivel`.

## C-02 `listarRegistrosAction({ tabela, pagina, tamanho, busca? })`

Paginação server-side (padrão do projeto, `normalizarPaginacao`). Busca por `ILIKE` em
`colunaRotulo` (com `escaparLike`). Devolve `colunasExibidas` com sensíveis **mascarados**; registros
padrão vêm com `sistema: true` e não são selecionáveis (US2, edge case).

## C-03 `gerarPreviaAction(pedido: PedidoAcao)`

Calcula a prévia sem alterar nada (FR-010, FR-011, FR-012, FR-013, FR-015a). Pode ser chamada sem
`modo` para descobrir `temDependentes`; com dependentes **de histórico**, a UI exige a escolha e
chama de novo com `modo`. Sem eles (só inseparáveis, ou nenhum), `modo` é ignorado e a prévia vem
completa como `sem_dependentes`, já listando os inseparáveis.

**Saída**: `Previa` (data-model §4). Tempo-alvo ≤ 5 s (SC-005).

## C-04 `executarAcaoAction({ pedido, impressaoDigital, confirmacao })`

Executa conforme research D6–D8:

1. A-00.1, A-00.2; `confirmacao === textoConfirmacao` do pedido.
2. Ping da auditoria.
3. Transação: travas → recálculo → comparação da impressão digital.
4. Evento `iniciada` + snapshots (bloqueante).
5. Redirecionamentos → exclusões (ordem topológica reversa) → recálculo de saldo → commit.
6. Evento `concluida` (ou `falhou`); invalidação de cache (research D12).

**Saída** (`ok`): `ResultadoExecucao`. Toda recusa e falha também gera evento na trilha
(SC-006), exceto `nao_autorizado`: sem sessão válida não há ator comprovado (spec, edge case
"sessão expira"). Nesse caso a action grava `console.warn('[manutencao] tentativa sem sessão
válida', { acao, tabela, ip, timestamp })` — nunca chaves nem conteúdo de linhas — e devolve a
recusa.

## C-05 `cancelarAcaoAction({ pedido, impressaoDigital })`

Registra o evento `cancelada` (US3 cenário 2). Best-effort: falha de auditoria aqui não é
mostrada como erro.

## C-06 `historicoAction({ pagina, tamanho })`

Execuções agrupadas por `execucaoId`, mais recentes primeiro: ator (nome), data/hora, ação, tabela,
modo, situação (`concluida`, `falhou`, `recusada`, `cancelada`, `desfecho_nao_confirmado`),
contagens por tabela. Se o Mongo estiver indisponível → `auditoria_indisponivel` (a página
continua utilizável para leitura do inventário, mas a execução será recusada de qualquer forma).
