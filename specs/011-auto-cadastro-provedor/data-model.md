# Data Model — Auto-cadastro por provedor externo

**Feature**: `011-auto-cadastro-provedor` | **Data**: 2026-08-16

## Alteração de esquema

Uma única alteração estrutural: coluna nova em `user`.

### `user` (módulo Identidade, `db/schema/identidade.ts`)

| Coluna | Tipo | Nulo | Default | Origem |
| --- | --- | --- | --- | --- |
| `id` | `text` PK | não | — | existente |
| `name` | `text` | não | — | existente — provedor externo ou cadastro manual |
| `email` | `text` UNIQUE | não | — | existente |
| `emailVerified` | `boolean` | não | `false` | existente |
| `image` | `text` | sim | — | existente |
| `role` | `role` enum | não | `usuario` | existente |
| `ativo` | `boolean` | não | `true` | existente |
| **`dataNascimento`** | **`date`** | **sim** | **—** | **NOVA** — gravada no primeiro envio de candidatura |
| `createdAt` | `timestamptz` | não | `now()` | existente |
| `updatedAt` | `timestamptz` | não | `now()` | existente |

**Por que `date` e não `timestamp`**: o domínio trabalha com `YYYY-MM-DD`
(`DadosCandidatura.dataNascimento`), o `DatePicker` compartilhado expõe esse mesmo formato na
API externa exatamente para casar com a coluna, e `ehMaiorDeIdade` compara datas civis. Um
`timestamp` introduziria fuso onde não existe hora. Ver [research.md](./research.md) D1.

**Por que nullable**: FR-003 cria a conta com o campo em branco e as contas existentes não têm o
dado. Sem backfill (D11).

**Migração**: gerada por `npm run db:generate` → `db/migrations/0002_*.sql`, aplicada com
`npm run db:migrate`. `ADD COLUMN` nullable é não bloqueante no Postgres; não exige janela.

**Reflexo no better-auth** — `src/shared/auth/auth.ts`, junto de `role` e `ativo`:

```
user.additionalFields.dataNascimento = { type: 'date' | 'string', required: false, input: false }
```

`input: false` é o ponto de segurança: nenhum endpoint do better-auth aceita esse campo do
cliente. A única via de escrita é `UsuarioRepository.definirDataNascimentoSeAusente`.

### Tabelas **não** alteradas

- `account`, `session`, `verification` — inalteradas. O vínculo com provedor externo já existe.
- `voluntario_perfil` — **mantém** suas colunas `nomeCompleto` e `dataNascimento`. O nome
  continua sendo dado próprio da candidatura (decisão Q2 da spec); a data continua persistida
  aqui, agora sempre igual à da conta por construção.

## Entidades de domínio

### Conta de usuário (Identidade)

Fonte de verdade para **e-mail** e **data de nascimento**. O `name` é rótulo de exibição, de
origem social, e não é a mesma coisa que o nome civil da candidatura.

**Invariantes**:

- `email` único e não nulo — não há criação de conta sem e-mail (FR-007 é mensagem, não regra).
- `dataNascimento`, uma vez gravada, **não muda** por esta feature. A idempotência é garantida
  no `WHERE` do UPDATE, não em leitura-seguida-de-escrita.
- `role` de conta criada por provedor externo é sempre `usuario` (FR-006) — já garantido pelo
  `defaultValue` + `input: false` de `role`.
- `name` não é sobrescrito em logins subsequentes (FR-008) — garantido pelos defaults do
  better-auth (`updateUserInfoOnLink: false`), a serem mantidos explicitamente (D3).

### Candidatura a voluntário (Voluntariado)

Sem mudança de forma. Muda **de onde vêm** dois campos:

| Campo | Antes | Depois |
| --- | --- | --- |
| `nomeCompleto` | digitado livre | pré-preenchido da conta, **editável**, gravado como confirmado |
| `dataNascimento` | digitado livre | da conta quando existir; senão digitado e **gravado na conta** |
| demais campos | digitados | inalterados |

## Regras e transições

### R1 — Resolução da data de nascimento (função pura, `domain`)

```
resolverDataNascimento(daConta: string | null, doFormulario: string | undefined): string | undefined
  daConta != null  → daConta          (o formulário é ignorado, venha o que vier)
  daConta == null  → doFormulario
```

Vive em `src/modules/voluntariado/domain/candidatura.ts`. É o que implementa FR-017 no servidor,
independentemente do `disabled` do navegador. Testável sem infraestrutura.

O resultado alimenta `validarCandidatura`, que segue aplicando a regra de maioridade
(`ehMaiorDeIdade`) — FR-020 e o cenário 9 da User Story 2. Uma data vinda da conta que resulte
em menor de idade **é recusada do mesmo jeito**; o pré-preenchimento não contorna a regra.

### R2 — Gravação da data na conta (transacional)

Dentro de `unidadeDeTrabalho.executar(({ voluntarios, usuarios }) => ...)`:

1. `voluntarios.salvarCandidatura(...)` — cria ou reaproveita a linha de `voluntario_perfil`
2. `usuarios.definirDataNascimentoSeAusente(userId, dataResolvida)`

Ambos commitam juntos. Estado "candidatura gravada, conta sem data" é impossível — se ocorresse,
o campo voltaria a aparecer editável no próximo acesso, contradizendo FR-014.

**Idempotência**: o método traduz para
`UPDATE "user" SET data_nascimento = $2 WHERE id = $1 AND data_nascimento IS NULL`. Dois envios
simultâneos não competem; o segundo não faz nada. Implementa diretamente a borda "a data é
gravada uma única vez, na primeira candidatura que a informa".

### R3 — Estado dos campos no formulário

Derivado no servidor (`page.tsx`), nunca no cliente:

| Campo | Valor | Estado |
| --- | --- | --- |
| E-mail | `sessao.email` | somente leitura, **sempre** |
| Nome completo | `voluntario_perfil.nomeCompleto` no reenvio; senão `sessao.nome` | editável, **sempre** |
| Data de nascimento | `sessao.dataNascimento` | somente leitura se presente; editável e obrigatória se `null` |

O nome no reenvio prefere o valor já confirmado na candidatura anterior ao rótulo social —
quem corrigiu o nome uma vez não deve ver a correção desfeita (cenário 8 da User Story 2).

### R4 — Auditoria do auto-cadastro

| Campo do registro | Valor |
| --- | --- |
| `entidade` | `'Usuario'` (já existe em `ENTIDADES_AUDITADAS`) |
| `entidadeId` | `user.id` recém-criado |
| `acao` | `'create'` |
| `tabela` | `'user'` |
| `userId` / `userRole` | o próprio usuário criado / `'usuario'` — ator **explícito**, pois não há sessão ainda |
| `dadosAnteriores` | `null` |
| `dadosNovos` | `{ id, name, email, role, provedor }` — sem tokens, sem `image` |
| `metadata` | ip/userAgent quando disponíveis no contexto do hook |

Falha aqui **não** impede o login (Princípio V).

## Impacto em tipos existentes

| Tipo | Arquivo | Mudança |
| --- | --- | --- |
| `SessaoAtor` | `src/shared/auth/sessao.ts` | `+ dataNascimento: string | null` |
| `UsuarioRepository` | `src/modules/identidade/application/ports/usuario-repository.ts` | `+ definirDataNascimentoSeAusente`, `+ buscarDataNascimento` |
| `EntradaSubmeterCandidatura` | `src/modules/voluntariado/application/use-cases/submeter-candidatura.ts` | `+ dataNascimentoDaConta: string | null` |
| `CandidaturaFormProps` | `app/(interno)/voluntariado/candidatura/candidatura-form.tsx` | `+ email`, `+ nomeInicial`, `+ dataNascimentoDaConta` |
| `LinhaUsuario` | port de Identidade | **inalterado** — `/admin` não exibe data de nascimento nesta feature |
