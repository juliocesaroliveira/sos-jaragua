# Data Model: Danger Zone

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

A feature não cria tabelas de domínio. Ela acrescenta: (1) um **catálogo** declarativo em código,
(2) três **registros padrão** e um ajuste de índice no Postgres, (3) campos opcionais no
documento de auditoria do Mongo, e (4) objetos de valor transitórios (prévia, impressão digital,
resultado) que vivem só durante a requisição.

---

## 1. Catálogo (código — `src/modules/manutencao/domain/catalogo.ts`)

### TabelaGerenciavel

| Campo | Tipo | Regra |
|---|---|---|
| `nome` | string | nome físico (`saida_item`); único no catálogo |
| `rotulo` | string | pt-BR ("Itens de saída") |
| `area` | `'identidade' \| 'voluntariado' \| 'estoque' \| 'logistica' \| 'notificacoes'` | FR-004 |
| `chavePrimaria` | string[] | `['id']`, `['item_id']` (`saldo_estoque`), `['user_id']` (`preferencia_whatsapp`), `['telefone']` (`whatsapp_resposta_automatica`) |
| `colunaRotulo` | string | coluna usada na amostra e na busca (`nome`, `titulo`, `email`, `destino`…) |
| `colunasExibidas` | string[] | colunas listadas na seleção de registros; nunca inclui credenciais |
| `colunasSensiveis` | string[] | mascaradas por `src/shared/mascara` (`cpf`, `cep`, `data_nascimento`) |
| `colunasCredencial` | string[] | removidas de listagem, amostra e snapshot (research D9) |
| `consequencias` | string[] | frases pt-BR para FR-010 ("Os voluntários perdem o histórico de turnos") |
| `alertaAcesso` | string \| null | só tabelas de autenticação e `user` (FR-006, research D12) |

Tabelas no catálogo (26 — todas as de `db/schema/`): `user`, `session`, `account`, `verification`, `habilidade`,
`atividade_categoria`, `voluntario_perfil`, `voluntario_habilidade`, `atividade`, `turno`,
`alocacao`, `item`, `saldo_estoque`, `kit`, `kit_receita_item`, `entrada`, `saida`, `saida_item`,
`descarte`, `crise_variaveis`, `metrica_kit`, `notificacao`, `notificacao_envio`,
`preferencia_whatsapp`, `consentimento_whatsapp`, `whatsapp_resposta_automatica`.

### Vinculo

| Campo | Tipo | Regra |
|---|---|---|
| `filho` / `coluna` | string | `alocacao` / `participante_user_id` |
| `pai` | string | `user`; a coluna referenciada é a chave primária do pai |
| `obrigatorio` | boolean | espelha `NOT NULL`; conferido contra `pg_catalog` |
| `regraBanco` | `'cascade' \| 'set null' \| 'restrict' \| 'no action'` | informativo na prévia; conferido |
| `classificacao` | `'inseparavel' \| 'historico'` | research D3; prevalece sobre `regraBanco` |

**Invariantes** (verificados por `conferirCatalogo`, função pura, e por teste):
- Todo vínculo `historico` + `obrigatorio` aponta para uma tabela que tem registro padrão
  (`user`, `item`, `atividade_categoria`).
- Todo vínculo do catálogo corresponde a uma FK física, e vice-versa (FR-013a, research D2).
- Nenhum vínculo `historico` + `obrigatorio` participa de índice único não parcial.

## 2. Postgres — migração

| Mudança | Detalhe |
|---|---|
| Registro padrão `user` | `id = 'sistema-usuario-removido'`, `name = 'Usuário removido'`, `email = 'usuario-removido@sistema.invalid'`, `role = 'usuario'`, `ativo = false`, `email_verified = false` |
| Registro padrão `item` | `id = '00000000-0000-4000-8000-000000000001'`, `nome = 'Item removido'`, `categoria = 'outros'`, `unidade_medida = 'unidade'` |
| Registro padrão `atividade_categoria` | `id = '00000000-0000-4000-8000-000000000002'`, `nome = 'Categoria removida'` |
| Índice | `DROP INDEX alocacao_turno_participante_idx`; recriado como `UNIQUE (turno_id, participante_user_id) WHERE participante_user_id <> 'sistema-usuario-removido'` (research D5) |

Inserções com `ON CONFLICT DO NOTHING`. Os ids ficam em `src/shared/kernel/registros-sistema.ts`
(`REGISTROS_SISTEMA`), consumidos pelo módulo `manutencao` e pelos filtros de listagem (research
D15).

## 3. Mongo — extensão de `audit_logs`

Campos **acrescentados** a `RegistroAuditoria` (`src/shared/db/mongo/audit-logs.ts`), todos
opcionais, então nenhum registro existente muda:

| Campo | Tipo | Uso |
|---|---|---|
| `manutencao.execucaoId` | string (UUID) | agrupa todos os documentos de uma ação |
| `manutencao.fase` | `'iniciada' \| 'snapshot' \| 'concluida' \| 'falhou' \| 'recusada' \| 'cancelada'` | |
| `manutencao.resumo` | objeto (ver abaixo) | só em `iniciada`, `concluida`, `falhou`, `recusada`, `cancelada` |

Valores novos de vocabulário:
- `EntidadeAuditada` += `'ManutencaoDados'` (rótulo "Manutenção de dados").
- `AcaoAuditada` sem mudança: o resumo usa `delete`; snapshots usam `delete` (linha apagada) ou
  `update` (vínculo redirecionado, com `dadosAnteriores` = linha antes e `dadosNovos` = só a
  coluna alterada).

Índice novo (em `garantirIndicesAuditoria`): `{ 'manutencao.execucaoId': 1, timestamp: 1 }`, nome
`manutencao_execucao_timestamp`, parcial em `manutencao` existente.

### ResumoExecucao (dentro do evento)

| Campo | Tipo |
|---|---|
| `acao` | `'resetar_tabela' \| 'excluir_selecionados'` |
| `tabela` | string |
| `modo` | `'cascata' \| 'preservacao' \| 'sem_dependentes'` |
| `ambiente` | `'production' \| 'preview' \| 'development'` |
| `impressaoDigital` | `ImpressaoDigital` (abaixo) |
| `contagensReais` | `ImpressaoDigital` — só em `concluida` |
| `motivo` | string — só em `recusada` / `falhou` (`dados_mudaram`, `reautenticacao_necessaria`, `auditoria_indisponivel`, `catalogo_divergente`, mensagem do erro) |

## 4. Objetos de valor transitórios (domínio)

### PedidoAcao (entrada da prévia e da execução)

| Campo | Tipo | Validação |
|---|---|---|
| `acao` | `'resetar_tabela' \| 'excluir_selecionados'` | |
| `tabela` | string | precisa existir no catálogo e estar disponível (D2) |
| `chaves` | string[] | só em `excluir_selecionados`; 1..500; registros padrão recusados |
| `modo` | `'cascata' \| 'preservacao'` | obrigatório quando a prévia acusou dependentes |

### Previa

| Campo | Conteúdo |
|---|---|
| `pedido` | `PedidoAcao` |
| `temDependentes` | boolean — verdadeiro só se algum vínculo **de histórico** atinge ≥ 1 linha; decide se a escolha cascata/preservação é exigida (FR-011, cenário 1.1/1.2). Dependentes só inseparáveis → falso, e a prévia já vem completa com os inseparáveis listados |
| `arvore` | lista de `NoImpacto`: tabela, rótulo, nível, vínculo pelo qual foi atingida, `apagar`, `redirecionar`, classificação |
| `redirecionamentos` | por vínculo: contagem e valor padrão ("vazio" ou rótulo do registro padrão) |
| `inseparaveis` | subconjunto da árvore apagado em qualquer modo (FR-013) |
| `preservados` | registros poupados: conta/sessão do executor, registros padrão (FR-018) |
| `saldos` | por item: atual, resultante, `negativo` (FR-015a) |
| `amostras` | até 5 rótulos por tabela, sensíveis mascarados, "e mais N" |
| `consequencias` | frases do catálogo das tabelas atingidas + alerta de acesso |
| `ambiente` | research D17 |
| `textoConfirmacao` | `RESETAR <tabela>` ou `EXCLUIR <n> DE <tabela>` (FR-014) |
| `impressaoDigital` | `ImpressaoDigital` |

### ImpressaoDigital

Mapa ordenado `tabela → { apagar: n, redirecionar: { coluna → n } }`. Igualdade estrutural é o
critério de divergência (research D7).

### ResultadoExecucao

`execucaoId`, contagens reais (`ImpressaoDigital`), saldos recalculados, duração.

## 5. Transições de estado de uma execução

```text
           ┌─────────────┐  cancelar   ┌───────────┐
 prévia ──►│ confirmando │────────────►│ cancelada │
           └──────┬──────┘             └───────────┘
                  │ executar
                  ▼
   checagens (sessão recente, ping auditoria, catálogo, divergência)
        │ falhou                 │ ok
        ▼                        ▼
   ┌──────────┐          ┌──────────┐  commit ok   ┌───────────┐
   │ recusada │          │ iniciada │─────────────►│ concluida │
   └──────────┘          └────┬─────┘              └───────────┘
                              │ erro antes/no commit
                              ▼
                         ┌────────┐
                         │ falhou │
                         └────────┘
   iniciada sem desfecho gravado → exibida como "desfecho não confirmado"
```
