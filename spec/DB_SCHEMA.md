# Documento de Modelagem de Dados (DB_SCHEMA.md)

## Projeto: SOS Jaraguá — Gestão e Mobilização em Situações de Emergência

Este documento detalha o schema físico das duas bases de dados definidas no
`REQUISITOS_NAO_FUNCIONAIS.md`: **Neon Postgres** (domínio relacional completo) e
**MongoDB Atlas** (log de auditoria imutável, dedicado). O racional arquitetural de cada
entidade está em `DESIGN.md`; este documento é a referência de campos, tipos e relações.

---

## 1. Visão Geral

- **Postgres** é a única fonte de verdade para todas as entidades de negócio: identidade,
  voluntariado, estoque/doações, logística, notificações.
- **Mongo** armazena **apenas** a coleção `audit_logs` (BR-AUD-01). Não é uma segunda fonte
  de verdade para nenhuma entidade de negócio — nunca é lido para reconstruir estado da
  aplicação, apenas para trilha de auditoria/prestação de contas.
- ORM: **Drizzle**, gerenciando tanto as tabelas de negócio quanto as tabelas geradas pelo
  adapter do **better-auth**.

---

## 2. Convenções

- **Chaves primárias**: UUID (`gen_random_uuid()`) em todas as tabelas de negócio. As
  tabelas do better-auth seguem o padrão de ID do próprio adapter (também string/UUID).
- **Nomenclatura**: camelCase em TypeScript, mapeado para snake_case no banco via a opção
  global `casing: 'snake_case'` do Drizzle — escolhida para que as tabelas da aplicação e
  as tabelas geradas automaticamente pelo adapter Drizzle do better-auth compartilhem uma
  única convenção de nomes de coluna no banco.
- **Timestamps**: toda tabela de negócio tem `criadoEm` (`created_at`) e, quando sujeita a
  edição, `atualizadoEm` (`updated_at`) — exceto onde o gerador do better-auth define outro
  nome (documentado tabela a tabela em §4).
- **Enums**: implementados como Postgres `enum` nativo quando a lista de valores é fixa e
  pequena (definida no BRD); tabelas lookup livres quando a lista deve crescer sem
  deploy (decisão confirmada para Categoria de Atividade e Habilidade).
- **Soft delete**: não utilizado por padrão — entidades são desativadas via flag `ativo`
  (ex.: `kit.ativo`) quando aplicável, preservando histórico e integridade referencial.

---

## 3. Relações por Módulo (visão textual)

```
user (better-auth) ──1:1── voluntario_perfil ──N:N── habilidade
                              │
                              └──1:N── alocacao ──N:1── turno ──N:1── atividade ──N:1── atividade_categoria

item ──1:N── entrada
item ──1:N── saida_item ──N:1── saida
item ──1:N── descarte
item ──1:1── saldo_estoque
item ──N:N── kit  (via kit_receita_item)

crise_variaveis (standalone, append-only)
metrica_kit ──N:1── kit

notificacao ──N:1── user (destinatário)
notificacao ──1:N── notificacao_envio

audit_logs (Mongo, standalone — referencia user.id e as tabelas acima só por id/string)
```

---

## 4. Módulo Identidade

### 4.1. Tabelas core do better-auth

Geradas via `npx @better-auth/cli generate` a partir da configuração de `src/shared/auth/`,
e então aumentadas manualmente com os `additionalFields` abaixo. Nomes de coluna seguem o
padrão do adapter (não necessariamente `criadoEm`/`atualizadoEm`).

**`user`**

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid/string, pk | gerado pelo better-auth |
| `email` | text, único | |
| `emailVerified` | boolean | padrão better-auth |
| `name` | text | padrão better-auth |
| `image` | text, nullable | padrão better-auth |
| `role` | enum(`usuario,voluntario,membro_defesa_civil,coordenador,administrador`) | **additionalField**, default `usuario` |
| `ativo` | boolean | **additionalField**, default `true` — permite desativar acesso sem apagar histórico |
| `createdAt` / `updatedAt` | timestamptz | padrão better-auth |

**`session`**

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid/string, pk | |
| `userId` | fk → `user.id` | |
| `expiresAt`, `token`, `ipAddress`, `userAgent` | — | padrão better-auth |
| `lastActivityAt` | timestamptz, nullable | **additionalField** — atualizado por `proxy.ts` a cada requisição de staff; base do timeout de inatividade (DESIGN.md §6.3) |

**`account`** (vínculos OAuth) — padrão better-auth, um registro por provider vinculado ao
`user`. Providers habilitados: `credential` (e-mail/senha), `google`, `facebook`.

**`verification`** — padrão better-auth (verificação de e-mail, reset de senha).

### 4.2. `voluntario_perfil`

Extensão 1:1 de `user` com os dados específicos do domínio de voluntariado — mantida
separada de `user` para não poluir a tabela de autenticação com campos de negócio, e para
que a "fila de Cadastros Pendentes" (BR-VOL-01) seja uma query simples sobre esta tabela.

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `id` | uuid, pk | | |
| `userId` | uuid, fk → `user.id`, único | Sim | 1:1 com `user` |
| `nomeCompleto` | text | Sim | |
| `dataNascimento` | date | Sim | Validação de maioridade (≥18) no `domain` |
| `cpf` | text, único | Sim | Validação de dígito verificador no `domain`; índice único |
| `telefone` | text | Sim | WhatsApp |
| `cep` | text | Sim | |
| `bairro` | text | Sim | |
| `profissao` | text | Sim | |
| `restricoesSaude` | text | Não | Alergias, limitações físicas |
| `veiculoProprio` | boolean | Sim | |
| `tipoVeiculo` | enum(`carro,caminhonete,moto,barco`) | Condicional | Obrigatório se `veiculoProprio = true` (validado no `domain`) |
| `disponibilidade` | enum-array(`integral,manha,tarde,noite,fim_de_semana`) | Sim | |
| `status` | enum(`pendente,aprovado,rejeitado`) | Sim | default `pendente`; **é** a fila de Cadastros Pendentes via `status = 'pendente'` |
| `aprovadoPor` | uuid, fk → `user.id`, nullable | | Sobrescrito a cada nova decisão de triagem |
| `aprovadoEm` | timestamptz, nullable | | |
| `motivoRejeicao` | text, nullable | | |
| `criadoEm` / `atualizadoEm` | timestamptz | | |

**Reenvio de candidatura rejeitada** (decisão confirmada): uma nova submissão do mesmo CPF
atualiza a linha existente — `status` volta a `pendente`, dados substituídos,
`aprovadoPor`/`aprovadoEm`/`motivoRejeicao` limpos até a próxima decisão.

### 4.3. `habilidade` e `voluntario_habilidade`

`habilidade` é uma **tabela lookup livre**, extensível por Coordenador/Administrador sem
deploy (decisão confirmada — substitui a lista fechada do BRD, que era exemplificativa:
"Motosserra, CNH D/E, Embarcação, Primeiros Socorros, etc.").

**`habilidade`**

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid, pk | |
| `nome` | text, único | |
| `criadoEm` | timestamptz | |

**`voluntario_habilidade`** (join, N:N)

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid, pk | |
| `voluntarioPerfilId` | uuid, fk → `voluntario_perfil.id` | |
| `habilidadeId` | uuid, fk → `habilidade.id` | |
| — | | `unique(voluntarioPerfilId, habilidadeId)`; indexado para o filtro por habilidade na alocação (§5) |

---

## 5. Módulo Voluntariado

### 5.1. `atividade_categoria`

Tabela lookup livre (decisão confirmada, substitui a lista exemplificativa do BRD:
"Separação de itens, Montagem de kits, Apoio logístico, etc.").

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid, pk | |
| `nome` | text, único | |
| `criadoEm` | timestamptz | |

### 5.2. `atividade`

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `id` | uuid, pk | | |
| `titulo` | text | Sim | |
| `categoriaId` | uuid, fk → `atividade_categoria.id` | Sim | |
| `local` | text | Sim | |
| `status` | enum(`aberta,encerrada,cancelada`) | Sim | default `aberta` |
| `criadoPor` | uuid, fk → `user.id` | Sim | Coordenador |
| `criadoEm` / `atualizadoEm` | timestamptz | | |

### 5.3. `turno`

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `id` | uuid, pk | | |
| `atividadeId` | uuid, fk → `atividade.id` | Sim | |
| `inicio` | timestamptz | Sim | Bloco de 4h validado no `domain` (BR-VOL-04) |
| `fim` | timestamptz | Sim | |
| `vagas` | integer | Sim | > 0 |
| `criadoEm` | timestamptz | | |

### 5.4. `alocacao`

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `id` | uuid, pk | | |
| `turnoId` | uuid, fk → `turno.id` | Sim | |
| `voluntarioPerfilId` | uuid, fk → `voluntario_perfil.id` | Sim | |
| `status` | enum(`confirmado,cancelado`) | Sim | default `confirmado` |
| `alocadoPor` | uuid, fk → `user.id` | Sim | Coordenador |
| `lembreteEnviadoEm` | timestamptz, nullable | | Flag de dedupe do cron de lembrete (DESIGN.md §12) |
| `criadoEm` | timestamptz | | |
| — | | | `unique(turnoId, voluntarioPerfilId)` — mesmo voluntário não pode ser alocado duas vezes ao mesmo turno |

---

## 6. Módulo Estoque/Doações

Modelo **ledger + saldo materializado** (decisão confirmada): toda movimentação gera uma
linha imutável em sua tabela de origem (`entrada`, `saida_item`, `descarte`); o saldo atual
é mantido em `saldo_estoque`, atualizado transacionalmente junto de cada movimentação — evita
reagregar o ledger inteiro a cada leitura, atendendo ao NFR de <300ms.

### 6.1. `item`

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `id` | uuid, pk | | |
| `nome` | text | Sim | Índice trigram (`pg_trgm`) para autocomplete-dedup (BR-EST-01) |
| `categoria` | enum(`agua,alimentacao,higiene,limpeza,acomodacao,materiais_construcao,vestuario,outros`) | Sim | Lista fechada do BRD §4.1 |
| `unidadeMedida` | enum(`unidade,kg,litro,fardo,caixa`) | Sim | |
| `criadoEm` | timestamptz | | |

### 6.2. `entrada`

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `id` | uuid, pk | | |
| `itemId` | uuid, fk → `item.id` | Sim | |
| `quantidade` | numeric | Sim | > 0 |
| `condicao` | enum(`novo,usado_bom_estado,necessita_higienizacao`) | Sim | |
| `perecivel` | boolean | Sim | |
| `dataValidade` | date, nullable | Condicional | Obrigatório se `perecivel = true`; não pode ser data passada (validado no `domain`) |
| `kitDestinoId` | uuid, fk → `kit.id`, nullable | Não | **Apenas informativo** (decisão confirmada) — não reserva saldo; item entra no saldo geral |
| `registradoPor` | uuid, fk → `user.id` | Sim | |
| `criadoEm` | timestamptz | | |

### 6.3. `kit` e `kit_receita_item`

**`kit`**

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid, pk | |
| `nome` | text | |
| `descricao` | text, nullable | |
| `ativo` | boolean | default `true` |
| `criadoEm` / `atualizadoEm` | timestamptz | |

**`kit_receita_item`** (a "receita" — BR-EST-03)

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid, pk | |
| `kitId` | uuid, fk → `kit.id` | |
| `itemId` | uuid, fk → `item.id` | |
| `quantidade` | numeric | Quantidade do item por unidade de kit |
| — | | `unique(kitId, itemId)` |

### 6.4. `saida` e `saida_item`

**`saida`**

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `id` | uuid, pk | | |
| `tipo` | enum(`avulso,kit`) | Sim | |
| `destino` | text | Sim | Bairro/abrigo/família (texto livre) |
| `responsavelTransporte` | text | Sim | |
| `registradoPor` | uuid, fk → `user.id` | Sim | |
| `criadoEm` | timestamptz | | |

**`saida_item`** (itens efetivamente deduzidos — populado tanto para saída avulsa quanto
para a expansão da receita de kits, BR-EST-04)

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid, pk | |
| `saidaId` | uuid, fk → `saida.id` | |
| `itemId` | uuid, fk → `item.id` | |
| `quantidade` | numeric | Quantidade efetivamente deduzida do saldo |

### 6.5. `descarte`

Tabela dedicada (BR-EST-05) — não uma flag em `saida`, para exclusão estrutural dos
relatórios de "itens entregues à população".

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `id` | uuid, pk | | |
| `itemId` | uuid, fk → `item.id` | Sim | |
| `quantidade` | numeric | Sim | |
| `motivo` | text, nullable | Não | |
| `registradoPor` | uuid, fk → `user.id` | Sim | |
| `criadoEm` | timestamptz | | |

### 6.6. `saldo_estoque` (read-model materializado)

| Campo | Tipo | Regras |
|---|---|---|
| `itemId` | uuid, pk, fk → `item.id` | 1:1 com `item` |
| `quantidadeAtual` | numeric | Atualizado transacionalmente por `entrada` (+), `saida_item` (-), `descarte` (-) |
| `atualizadoEm` | timestamptz | |

---

## 7. Módulo Logística

### 7.1. `crise_variaveis`

Linhas **append-only** — a mais recente (`atualizadoEm` mais alto) representa o valor
vigente; histórico preservado de graça, sem necessidade de tabela de auditoria separada
para esta entidade.

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `id` | uuid, pk | | |
| `totalFamiliasAfetadas` | integer | Sim | |
| `totalPessoasAfetadas` | integer | Sim | |
| `atualizadoPor` | uuid, fk → `user.id` | Sim | |
| `atualizadoEm` | timestamptz | | |

### 7.2. `metrica_kit`

Configuração da proporção usada no cálculo de demanda (BR-INT-01).

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid, pk | |
| `kitId` | uuid, fk → `kit.id` | |
| `baseDemanda` | enum(`por_familia,por_pessoa_desabrigada`) | |
| `proporcao` | numeric | Ex.: `1` = 1 kit por família/pessoa |

---

## 8. Módulo Notificações

### 8.1. `notificacao`

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `id` | uuid, pk | | |
| `destinatarioUserId` | uuid, fk → `user.id` | Sim | |
| `tipo` | enum(`triagem_concluida,atividade_atribuida,alteracao_atividade,lembrete_turno,broadcast_urgencia,cadastros_acumulados,estoque_critico,deficit_atendimento`) | Sim | Espelha a matriz de comunicação do BRD §6 |
| `titulo` | text | Sim | |
| `mensagem` | text | Sim | |
| `lida` | boolean | Sim | default `false` |
| `contexto` | jsonb, nullable | Não | Payload adicional (ex.: id da atividade/turno referenciado) |
| `criadoEm` | timestamptz | | |

### 8.2. `notificacao_envio`

Separado de `notificacao` para que falha de entrega em um canal (ex.: bounce de e-mail)
não corrompa o estado lido/não-lido in-app.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid, pk | |
| `notificacaoId` | uuid, fk → `notificacao.id` | |
| `canal` | enum(`email,plataforma`) | Sem push real no MVP (decisão confirmada) |
| `status` | enum(`pendente,enviado,falhou`) | default `pendente` |
| `enviadoEm` | timestamptz, nullable | |
| `erro` | text, nullable | |

---

## 9. Mongo — `audit_logs`

Coleção única (não uma por entidade) para manter a trilha cronológica simples de consultar
e exportar.

```jsonc
{
  "_id": ObjectId,
  "timestamp": ISODate,
  "entidade": "Doacao" | "Voluntario" | "Atividade",
  "entidadeId": "string (uuid da linha Postgres afetada)",
  "acao": "create" | "update" | "delete",
  "userId": "string (uuid do ator)",
  "userRole": "string (role do ator no momento da ação — denormalizado, roles mudam ao longo do tempo)",
  "dadosAnteriores": { /* snapshot pré-mutação, null em create */ },
  "dadosNovos": { /* snapshot pós-mutação, null em delete */ },
  "metadata": { "ip": "string?", "userAgent": "string?" }
}
```

**Índices**: `{ entidade: 1, entidadeId: 1, timestamp: -1 }` (histórico de uma entidade
específica), `{ userId: 1, timestamp: -1 }` (atividade de um ator), `{ timestamp: -1 }`
(consultas cronológicas gerais, alimenta BR-REL-01).

**Imutabilidade** (BR-AUD-01 — "log não é apagável"): garantida em duas camadas — (1) o
repositório de aplicação nunca expõe operações de update/delete sobre esta coleção; (2)
recomendação operacional de configurar o usuário do Atlas usado pela aplicação **sem grant
de delete/update** nesta coleção, já que RBAC do Postgres não tem jurisdição sobre o Mongo.

---

## 10. Mapeamento BR-AUD-01 → Tabelas Concretas

O BRD referencia auditoria para as entidades abstratas "Doacao", "Voluntario" e
"Atividade" — nenhuma delas existe como tabela única no schema físico. Mapeamento:

| Entidade do BRD | Tabelas Postgres correspondentes |
|---|---|
| **Voluntario** | `voluntario_perfil` (especialmente transições de `status`) |
| **Atividade** | `atividade`, `turno`, `alocacao` |
| **Doacao** | `entrada`, `saida` / `saida_item`, `descarte`, `kit` / `kit_receita_item` (mudanças de receita incluídas, por afetarem diretamente a capacidade de montagem de kits) |

---

## 11. Drizzle — Tooling

- Schema organizado em `db/schema/{identidade,voluntariado,estoque,logistica,notificacoes}.ts`
  + `index.ts` (barrel usado por `drizzle.config.ts` e pelo cliente runtime).
- `drizzle.config.ts` aponta para `DATABASE_URL_UNPOOLED` (conexão direta) — necessário
  para `drizzle-kit generate`/`push`, seguindo a recomendação do skill `neon-postgres` deste
  projeto (conexões pooled via PgBouncer em modo transação não suportam bem operações de
  sessão/migration).
- Runtime da aplicação usa `DATABASE_URL` (pooled) via `@neondatabase/serverless`.
- Tabelas do better-auth são geradas por `npx @better-auth/cli generate` diretamente na
  pasta `db/schema/identidade.ts`, depois aumentadas manualmente com os `additionalFields`
  documentados em §4.1.

---

## 12. Estratégia de Índices

| Índice | Motivo |
|---|---|
| `item.nome` — GIN/trigram (`pg_trgm`) | Autocomplete-dedup na Entrada (BR-EST-01) |
| `voluntario_perfil.status` | Query da fila de Cadastros Pendentes |
| `voluntario_perfil.cpf` — único | Regra de negócio (documento único por voluntário) |
| `alocacao(turnoId, voluntarioPerfilId)` — único | Impede alocação duplicada |
| `entrada(itemId, criadoEm)`, `saida_item(itemId, criadoEm)` (via `saidaId`→`saida.criadoEm`), `descarte(itemId, criadoEm)` | Agregações de relatório/histórico por item e período |
| `notificacao(destinatarioUserId, lida)` | Contagem de não-lidas por usuário |
| `atividade_categoria.nome`, `habilidade.nome` — único | Evita duplicidade nas tabelas lookup livres |

---

## 13. Campos Sensíveis e Criptografia

`voluntario_perfil.cpf` e `voluntario_perfil.restricoesSaude` são dados pessoais sensíveis
sob a ótica da LGPD. Proteção adotada (decisão confirmada): **criptografia at-rest nativa
do Neon Postgres** (volume/disco criptografado) + **TLS em trânsito** — sem
`pgcrypto`/criptografia a nível de campo, para manter `cpf` indexável/buscável via índice
único padrão do Postgres, sem a complexidade adicional de key management que a
criptografia de campo exigiria.

---

## 14. Seeds / Dados Iniciais

- `habilidade`: valores iniciais sugeridos pelo BRD (Motosserra, CNH D/E, Embarcação,
  Primeiros Socorros) — inseridos como seed, mas a tabela permanece editável por
  Coordenador/Administrador.
- `atividade_categoria`: valores iniciais sugeridos pelo BRD (Separação de itens, Montagem
  de kits, Apoio logístico) — mesma lógica de seed editável.
- `item.categoria`, `entrada.condicao`, `item.unidadeMedida`: enums fixos, sem seed
  necessário (valores literais do BRD).
- Um usuário `administrador` inicial (bootstrap), criado fora do fluxo de candidatura
  pública, para a primeira configuração do sistema.
