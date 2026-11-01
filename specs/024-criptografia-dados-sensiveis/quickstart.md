# Quickstart — Validação de ponta a ponta

**Feature**: `024-criptografia-dados-sensiveis` | **Data**: 2026-10-31

Roteiro para provar que a feature funciona. Não contém implementação — apenas o que rodar e o que
esperar. Detalhes de schema estão em [data-model.md](./data-model.md); de interface, em
[contracts/](./contracts/).

## Pré-requisitos

### 0. Dependências

O lockfile já foi ressincronizado em commit próprio — `npm ci` funciona:

```bash
npm ci               # baseline verde: 549 testes em 47 arquivos
```

### 1. Gerar e configurar a chave

```bash
openssl rand -base64 32    # mesmo procedimento já documentado para BETTER_AUTH_SECRET
```

Em `.env.local`:

```bash
DADOS_SENSIVEIS_CHAVE="<valor gerado>"
```

Acrescentar a entrada correspondente em `.env.example`, **sem valor real**.

### 2. Banco

```bash
npm run db:migrate                         # estrutura (passo 1 de §5.1 do data-model)
npx tsx scripts/proteger-dados-existentes.ts   # dados (passo 2) — idempotente
npm run db:migrate                         # índices (passo 3)
npx tsx scripts/remediar-auditoria.ts      # remediação única do Mongo (FR-027)
```

> Confira os nomes reais dos scripts em `package.json` antes de rodar.

## Cenário A — A aplicação recusa iniciar sem a chave (FR-003, US1/3)

```bash
DADOS_SENSIVEIS_CHAVE= npm run dev
```

**Esperado**: falha no boot, com mensagem em pt-BR nomeando `DADOS_SENSIVEIS_CHAVE`. **Não** deve
subir e falhar só no primeiro cadastro.

## Cenário B — Nada legível no armazenamento (FR-001, SC-001)

Cadastre um voluntário pelo formulário de candidatura e consulte direto no banco:

```sql
SELECT cpf, data_nascimento, cep, cpf_indice FROM voluntario_perfil ORDER BY criado_em DESC LIMIT 1;
SELECT data_nascimento FROM "user" WHERE id = '<userId>';
```

**Esperado**: `cpf`, `data_nascimento` e `cep` no formato `v1.…`, nunca o valor digitado.
`cpf_indice` é um hash base64url. O `data_nascimento` do `user` **também** está protegido — é a cópia
de FR-008, o ponto mais fácil de esquecer.

## Cenário C — Round-trip e reenvio de candidatura (FR-004, FR-005, SC-007)

1. Abra a fila de Cadastros Pendentes como `coordenador` e revele o CPF.
   **Esperado**: idêntico ao digitado.
2. Reenvie candidatura com o **mesmo CPF**.
   **Esperado**: a candidatura existente é reaproveitada; **não** surge segunda linha.

```sql
SELECT count(*) FROM voluntario_perfil WHERE cpf_indice = '<indice>';  -- 1
```

## Cenário D — Maioridade continua barrando (FR-006, SC-008)

Envie candidatura com data de nascimento de menor de 18 anos.
**Esperado**: recusa com a mensagem de sempre — a proteção do campo não atravessou o domínio.

## Cenário E — Máscara e Matriz de Visibilidade (FR-010 a FR-012, FR-015, SC-002)

Percorra fila de triagem, listagem de voluntários, painéis de relatório e detalhe de alocação com
**uma conta de cada role**:

| Role | CPF | Nascimento | CEP |
| ---- | --- | ---------- | --- |
| `usuario`, `voluntario` (dados de terceiros) | `12•••••••01` | `••/••/1990` | `89••••00` |
| `membro_defesa_civil` | `12•••••••01` | `••/••/1990` | **completo** |
| `coordenador`, `administrador` | revelável | revelável | revelável |

**Esperado**: a máscara aparece **por padrão** em toda superfície, inclusive tooltips e
totalizadores — nenhuma tela escapa.

## Cenário F — Nada sensível em cache (INV-04, D4)

Como `coordenador`, revele um CPF. Em seguida, na **mesma** instância, abra a fila como
`membro_defesa_civil`.

**Esperado**: o CPF aparece mascarado. Se aparecer completo, a entrada de cache de uma role vazou para
outra — é a falha que a arquitetura de D4 existe para impedir.

## Cenário G — Revelação auditada (FR-016, FR-017, SC-004)

Revele o CPF como `coordenador` e consulte a trilha no período.

**Esperado**: registro com ação `read`, ator, perfil e **nome do campo**. O **valor** revelado não
aparece na trilha — do contrário a auditoria violaria FR-026.

## Cenário H — Recusa por campo (FR-015, SC-003)

Como `membro_defesa_civil`, tente revelar o CPF; depois o CEP.

**Esperado**: CPF recusado, CEP revelado — na mesma tela, para o mesmo voluntário. Prova que a decisão
é por campo, não por tela. Tente também chamar a Server Action direto, fora da UI: deve recusar igual.

## Cenário I — Exportação herda a permissão (FR-018, SC-002)

Exporte um relatório com dados de voluntários como `membro_defesa_civil`.

**Esperado**: no arquivo, CEP completo e CPF/nascimento mascarados — a mesma regra da tela.

## Cenário J — Auditoria sem texto plano (FR-026, SC-012)

Edite um voluntário e inspecione o documento novo no Mongo; depois varra a coleção inteira.

**Esperado**: `dadosAnteriores`/`dadosNovos` não contêm CPF, nascimento nem CEP em claro — nem no
registro novo, nem nos remediados pelo script.

## Cenário K — Titular vê os próprios dados (FR-019, US4/1)

Autentique como voluntário e abra `/conta`.

**Esperado**: CPF, nascimento e CEP **completos**, sem máscara e **sem** precisar clicar em revelar.

## Cenário L — Exclusão: confirmação e impacto (FR-021, US4/2 e 5)

Com alocações futuras confirmadas, acione a exclusão.

**Esperado**: confirmação em pt-BR, dizendo que é irreversível e **quantos turnos futuros** serão
cancelados. Nada acontece antes de confirmar.

## Cenário M — Exclusão preserva o histórico (FR-022 a FR-025, SC-010, SC-011)

Antes: anote o total de turnos cumpridos no relatório de participação do período. Confirme a exclusão.

**Esperado**:
1. Os dados pessoais somem de toda tela, consulta e exportação.
2. O total de turnos daquele período é **exatamente o mesmo** — sem identificar quem cumpriu.
3. A sessão foi encerrada e a conta não autentica mais.
4. As vagas dos turnos futuros voltaram a ficar disponíveis.

```sql
SELECT anonimizado_em, cpf, cpf_indice FROM voluntario_perfil WHERE id = '<perfilId>';
-- anonimizado_em preenchido; cpf e cpf_indice nulos; A LINHA EXISTE
SELECT count(*) FROM alocacao WHERE voluntario_perfil_id = '<perfilId>';
-- inalterado: o histórico sobreviveu
```

> Se a linha de `voluntario_perfil` ou as de `alocacao` desapareceram, a implementação apagou em vez de
> anonimizar — viola FR-024 e contraria D7.

## Cenário N — Exclusão idempotente (FR-025, FR-030)

Acione a exclusão uma segunda vez para o mesmo titular.
**Esperado**: conclui sem erro e sem efeito colateral.

## Cenário O — Chave trocada falha visivelmente (FR-014, edge case)

Troque `DADOS_SENSIVEIS_CHAVE` por outra chave válida e abra um cadastro existente.

**Esperado**: indicação explícita de **erro de leitura**, distinguível de "campo vazio", com o resto do
cadastro utilizável. Se aparecer como vazio, a operação concluiria que o cadastro está incompleto — é
o modo de falha que FR-014 existe para evitar.

## Testes automatizados

```bash
npm test                 # máscara, exposição mínima, matriz, round-trip de cripto, idempotência
npm run test:integracao  # unicidade por blind index, migração, anonimização transacional
```

**Cobertura mínima esperada** (Princípio III — `domain`/`application` exigem teste):

- Máscara: CPF, CEP, data; valor curto (≤5) mascarado por inteiro; vazio → `ausente`
- `campoVisivelPara`: as 6 colunas da Matriz × 3 campos, incluindo o caso titular
- Cripto: round-trip; ciphertext difere entre chamadas; tag alterada → `ValorIlegivelError`
- Blind index: determinístico; `123.456.789-01` ≡ `12345678901`
- Anonimização: idempotência; `alocacao` preservada; turno futuro liberado; sessão encerrada
- Redação de auditoria: nenhum campo sensível no snapshot gravado
