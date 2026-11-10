# Phase 1 — Data Model: Criptografia, Mascaramento e Exclusão

**Feature**: `025-criptografia-dados-sensiveis` | **Data**: 2026-10-31

## 1. Mudanças de schema

### 1.1 `voluntario_perfil` (`db/schema/voluntariado.ts`)

| Coluna | Antes | Depois | Motivo |
| ------ | ----- | ------ | ------ |
| `cpf` | `text notNull`, índice único | `text` **nulável**, sem índice único | Passa a guardar o ciphertext aleatorizado. Nulável para a anonimização (D7) |
| `cpf_indice` | — | `text` **nulável**, **índice único** | Blind index `HMAC-SHA256(subchave, cpf)`. Sustenta unicidade e `buscarPorCpf` (D2) |
| `data_nascimento` | `date notNull` | `text` **nulável** | Ciphertext; o domínio já opera sobre `'YYYY-MM-DD'` (D6) |
| `cep` | `text notNull` | `text` **nulável** | Ciphertext |
| `nome_completo`, `telefone`, `bairro`, `profissao` | `text notNull` | `text` **nulável** | Não são cifrados (fora do escopo de Q1), mas são **eliminados** na anonimização (FR-023) |
| `restricoes_saude` | `text` nulável | inalterado | Já nulável; eliminado na anonimização |
| `anonimizado_em` | — | `timestamptz` nulável | Marca o estado de titular anônimo; é o que a apresentação consulta para renderizar "titular anônimo" |

**Índices**: `voluntario_perfil_cpf_idx` (único, em `cpf`) é **substituído** por
`voluntario_perfil_cpf_indice_idx` (único, em `cpf_indice`). O índice único do Postgres admite
múltiplos nulos, então vários titulares anonimizados coexistem sem colisão.
`voluntario_perfil_status_idx` permanece.

### 1.2 `user` (`db/schema/identidade.ts`)

| Coluna | Antes | Depois | Motivo |
| ------ | ----- | ------ | ------ |
| `data_nascimento` | `date` nulável | `text` nulável | Ciphertext. É a cópia que FR-008 exige proteger também |
| `name` | `text notNull` | inalterado | Recebe valor neutro na anonimização |
| `email` | `text notNull unique` | inalterado | Recebe valor neutro **irrepetível** na anonimização — não nulo, para não reativar a conta nem bloquear futuro cadastro |

> **Atenção**: `user.dataNascimento` é um `additionalField` do better-auth. O tipo que a sessão expõe
> muda de data para string. Conferir os consumidores de `dataNascimentoDaConta` em
> `submeter-candidatura.ts`.

### 1.3 Nenhuma tabela nova

A feature não cria tabela. O registro de revelação e o de exclusão vivem na trilha de auditoria já
existente (Mongo), por FR-017 e FR-024.

## 2. Formato do valor protegido

```text
v1.<iv_base64url>.<ciphertext_base64url>.<tag_base64url>
```

- `v1` — versão do envelope; permite trocar algoritmo ou chave sem ambiguidade de leitura
- `iv` — 12 bytes aleatórios, único por valor
- `tag` — 16 bytes de autenticação do AES-256-GCM

Um valor que não casa com o formato, ou cuja tag não valida, produz **falha de leitura explícita**
(FR-014), nunca string vazia nem valor silenciosamente errado.

**Blind index**: `base64url(HMAC-SHA256(subchave_indice, cpf_somente_digitos))`.

## 3. Entidades e tipos

### 3.1 `CampoSensivel` — fonte única de verdade

Declarado em `src/shared/mascara/campos-sensiveis.ts`. É o módulo que FR-012, FR-015 e FR-026 leem,
para que apresentação, exportação e redação de auditoria nunca divirjam.

| Campo | Chave | Máscara | Protegido no banco | Redigido na auditoria |
| ----- | ----- | ------- | ------------------ | --------------------- |
| CPF | `cpf` | 2 primeiros + 2 últimos | Sim | Sim |
| Data de nascimento | `dataNascimento` | dia e mês ocultos, ano visível | Sim | Sim |
| CEP | `cep` | 2 primeiros + 2 últimos | Sim | Sim |

### 3.2 Matriz de Visibilidade

Mesma fonte única. Lida **apenas fora de escopo de cache** (D4).

| Campo | `usuario` | `voluntario` (terceiros) | Titular | `membro_defesa_civil` | `coordenador` | `administrador` |
| ----- | --------- | ------------------------ | ------- | --------------------- | ------------- | --------------- |
| `cpf` | — | — | ✅ | — | ✅ | ✅ |
| `dataNascimento` | — | — | ✅ | — | ✅ | ✅ |
| `cep` | — | — | ✅ | ✅ | ✅ | ✅ |

### 3.3 Forma de apresentação

Todo campo sensível chega à UI como um de três estados mutuamente exclusivos — o que torna FR-010,
FR-013 e FR-014 distinguíveis na tela:

| Estado | Significado | Render |
| ------ | ----------- | ------ |
| `mascarado` | Há valor; quem pede não pode ver completo | `12•••••••01` |
| `ausente` | Não há valor | Indicação de ausência já usada no sistema |
| `ilegivel` | Há valor, mas não foi possível decifrar | Indicação explícita de erro de leitura |

O valor completo **nunca** viaja nesta forma: chega só pela resposta da revelação (contrato próprio).

### 3.4 Vocabulário de auditoria — extensão necessária

`AcaoAuditada` em `src/shared/db/mongo/audit-logs.ts`:

```text
antes:  'create' | 'update' | 'delete'
depois: 'create' | 'update' | 'delete' | 'read' | 'anonimizar'
```

Uma revelação é leitura; uma anonimização não é nenhum dos três (D8). Também precisam de atualização
`ACOES_AUDITADAS` e `ROTULO_ACAO_AUDITADA` em
`src/modules/auditoria/presentation/queries/trilha.ts`, que alimentam o filtro da tela de trilha.

## 4. Transição de estado — titular

```text
                 pede exclusão + confirma
   ativo  ─────────────────────────────────────▶  anonimizado
                                                 (anonimizado_em preenchido)
```

**Irreversível e idempotente**: uma segunda solicitação encontra `anonimizado_em` preenchido e conclui
sem erro nem efeito (FR-030).

### O que a anonimização faz, por tabela

| Tabela | Operação |
| ------ | -------- |
| `voluntario_perfil` | `UPDATE`: campos pessoais a nulo (incluindo `cpf`, `cpf_indice`, `data_nascimento`, `cep`), `anonimizado_em = now()`. A **linha permanece** |
| `user` | `UPDATE`: `name` e `email` para valores neutros e irrepetíveis, `data_nascimento` a nulo, `ativo = false`. A **linha permanece** |
| `session` | `DELETE` de todas as linhas do titular — encerra a sessão (FR-028) |
| `account` | `DELETE` — remove vínculos de login social e senha |
| `voluntario_habilidade` | `DELETE` — habilidades declaradas são dado do titular (FR-023) |
| `alocacao` | **Preservada.** Turnos futuros confirmados passam a `cancelado`, liberando vaga (FR-025); turnos passados ficam como estão (FR-024) |
| `notificacao` | `DELETE` — conteúdo pode carregar dado pessoal |
| `audit_logs` (Mongo) | **Preservada e imutável.** Já não contém texto plano sensível, por FR-026 e pela remediação de FR-027 |

> **Por que `UPDATE` e não `DELETE`**: ver D7 em `research.md`. Resumo: `alocacao.participanteUserId`
> é `cascade` e destruiria o histórico; `alocacao.alocadoPor`, `atividade.criadoPor` e as três tabelas
> de estoque não declaram `onDelete`, então o `DELETE` **falharia** para qualquer pessoa com histórico
> operacional.

## 5. Migrações

### 5.1 Postgres — migration Drizzle + script de dados

Ordem obrigatória, porque os dados precisam ser lidos em claro antes de a coluna mudar de forma:

1. **Migration (estrutura)**: adiciona `cpf_indice` e `anonimizado_em`; relaxa `notNull` nas colunas
   afetadas; **mantém** `cpf` e as demais com os valores atuais em claro.
2. **Script de dados** (`scripts/proteger-dados-existentes.ts`, FR-007): para cada linha, cifra
   `cpf`/`data_nascimento`/`cep`, calcula `cpf_indice`, grava. **Idempotente** — reconhece pelo prefixo
   `v1.` o que já está protegido e salta, podendo ser re-executado após interrupção.
3. **Migration (índices)**: cria o índice único em `cpf_indice` e remove o de `cpf`.

> O índice único em `cpf_indice` só pode ser criado **depois** do passo 2: antes dele a coluna está
> inteira nula, e nulos não colidem — mas criar o índice antes esconderia uma colisão real de CPF
> duplicado que o passo 2 precisa expor.

### 5.2 Mongo — remediação única (FR-027)

`scripts/remediar-auditoria.ts`: varre `audit_logs` e, nos documentos cujo `tabela` é
`voluntario_perfil` ou `user`, substitui em `dadosAnteriores`/`dadosNovos` os campos sensíveis pela
forma redigida. Idempotente. Registra um evento próprio marcando a remediação — é a única exceção
admitida à imutabilidade da trilha.

## 6. Invariantes

| # | Invariante | Onde é garantida |
| - | ---------- | ---------------- |
| INV-01 | Dois voluntários não compartilham CPF | Índice único em `cpf_indice` (banco, não aplicação — mesmo raciocínio de 017/INV-01) |
| INV-02 | Nenhum valor sensível em texto plano no Postgres | Repositório cifra na escrita; script de migração cobre o legado |
| INV-03 | Nenhum valor sensível em texto plano no Mongo | Redação em `withAudit` + remediação única |
| INV-04 | Nenhum valor sensível em texto plano em cache | As funções `'use cache'` só devolvem a forma de apresentação (D4) |
| INV-05 | Valor completo só sai conforme a Matriz | Único caminho de revelação, em caso de uso que confere a matriz e audita |
| INV-06 | Titular anonimizado não reaparece | `anonimizado_em` consultado pela apresentação; `user.ativo = false` |
| INV-07 | Histórico de turnos sobrevive à exclusão | Anonimização por `UPDATE`; `alocacao` nunca é apagada |
