# Quickstart: validar a Gestão de Habilidades

**Feature**: 017-gestao-habilidades | Roteiro de validação ponta a ponta. Detalhes de contrato em
[contracts/](contracts/); modelo de dados em [data-model.md](data-model.md).

## Pré-requisitos

- `.env.local` com `DATABASE_URL` / `DATABASE_URL_UNPOOLED` apontando para um branch Neon **de
  desenvolvimento** (a migração altera constraints — não rodar contra produção sem revisão).
- Conta de teste com role `coordenador`, `membro_defesa_civil` ou `administrador` (ver `db/seed.ts`,
  `SEED_TESTE_PASSWORD`), e uma conta `voluntario` para o teste negativo de acesso.

## Pré-condição da migração

O índice único sobre `lower(nome)` falha se a base já tiver nomes que colidem ignorando caixa. Verificar
**antes** de migrar:

```sql
SELECT lower(nome), count(*) FROM habilidade GROUP BY 1 HAVING count(*) > 1;
```

Zero linhas → seguir. Havendo colisões, renomear ou remover as duplicatas primeiro. Na base semeada
("Motosserra", "CNH D/E", "Embarcação", "Primeiros Socorros") não há colisão.

## Setup

```bash
npm install
npm run db:generate     # gera a migração a partir de db/schema/voluntariado.ts
npm run db:migrate      # aplica: índice único lower(nome) + FK RESTRICT
npm run db:seed         # opcional — garante as habilidades iniciais e as contas de teste
npm run dev
```

Confirmar que a migração aplicou as duas mudanças:

```sql
-- deve listar o índice funcional
SELECT indexdef FROM pg_indexes WHERE tablename = 'habilidade';
-- deve mostrar 'r' (RESTRICT) para a FK de habilidade_id
SELECT confdeltype FROM pg_constraint
WHERE conrelid = 'voluntario_habilidade'::regclass AND confdeltype IS NOT NULL;
```

## Testes automatizados

```bash
npm test                 # domain (normalização, limites) + casos de uso com repositório falso
npm run test:integracao  # unicidade sob concorrência (SC-004) e recusa de exclusão vinculada (SC-008)
```

Esperado: tudo verde. Os dois testes de integração são os que provam as invariantes de banco — se
passarem com o repositório falso mas falharem contra o Neon, a migração não foi aplicada.

## Roteiro manual

Autenticar como `coordenador` e abrir **Operação → Habilidades** (`/habilidades`).

### 1. Listagem (US1 · FR-003, FR-004, FR-013, FR-019)

| Passo | Esperado |
| --- | --- |
| Abrir a tela | Primeira página já renderizada, sem piscar de carregamento (veio hidratada). Colunas: Nome, Voluntários, Cadastrada em, Ações. |
| Trocar o tamanho de página no rodapé (5/10/20/50) | A lista responde sem recarregar a rota; a URL reflete `pageSize`. |
| Avançar e voltar de página | Conjunto correto em cada página, sem duplicar nem pular registros. |
| Copiar a URL e abrir em outra aba | Mesma página e mesmo tamanho. |
| Conferir a coluna Voluntários | "Primeiros Socorros" (usada pelo seed) mostra contagem > 0; uma habilidade nova mostra 0. |

### 2. Cadastro (US2 · FR-006, FR-008, FR-009)

| Passo | Esperado |
| --- | --- |
| "Nova habilidade" → confirmar com o campo vazio | Bloqueado, mensagem em pt-BR abaixo do campo; nada é criado. |
| Digitar `A` e confirmar | Bloqueado por tamanho mínimo. |
| Digitar `  Operação de drone  ` e confirmar | Criada; toast de sucesso; aparece na lista como "Operação de drone" (espaços removidos). |
| Cadastrar `motosserra` (minúsculo) | Recusado, mensagem "Já existe uma habilidade com esse nome." **abaixo do campo**, não só no toast. |
| Abrir o diálogo, digitar algo e cancelar | Nada criado; lista inalterada. |

### 3. Edição (US3 · FR-007, FR-012 sobre vínculos preservados)

| Passo | Esperado |
| --- | --- |
| Editar "Operação de drone" | Diálogo abre pré-preenchido com o nome atual. |
| Renomear para `Pilotagem de drone` e salvar | Atualizado na lista; toast de sucesso; "Cadastrada em" inalterada. |
| Editar "Primeiros Socorros" → salvar como `primeiros socorros` | Permitido (é a própria linha, não duplicata). A contagem de voluntários vinculados **não muda**. |
| Abrir o perfil de um voluntário que declarou a habilidade | O novo nome aparece; o vínculo continua lá (INV-05). |
| Tentar renomear uma habilidade para o nome de outra | Recusado, mensagem no campo. |

### 4. Exclusão (US4 · FR-011, FR-012, SC-007, SC-008)

| Passo | Esperado |
| --- | --- |
| Excluir "Pilotagem de drone" (0 vínculos) → cancelar | Nada é excluído. |
| Repetir → confirmar | Removida; toast de sucesso; lista atualizada. |
| Excluir "Primeiros Socorros" (com vínculos) | A confirmação abre informando a quantidade de voluntários vinculados e o botão de confirmar fica desabilitado. |
| Forçar a ação com o payload direto (ver abaixo) | Recusada pelo servidor com código `vinculo_existente`; **nenhuma linha de `voluntario_habilidade` some**. |
| Ficar na última página com um único item e excluí-lo | A tela reposiciona em uma página válida, sem ficar em branco. |

Verificação decisiva de SC-008, antes e depois da tentativa forçada:

```sql
SELECT count(*) FROM voluntario_habilidade
WHERE habilidade_id = (SELECT id FROM habilidade WHERE lower(nome) = 'primeiros socorros');
```

A contagem deve ser idêntica nas duas leituras.

### 5. Acesso (FR-002 · SC-005)

| Passo | Esperado |
| --- | --- |
| Autenticar como `voluntario` e abrir `/habilidades` pela URL | Acesso negado (`/sem-permissao`); o item não aparece no menu. |
| Como `membro_defesa_civil` e como `administrador` | Tela acessível e todas as ações funcionam. |
| Sem sessão, abrir `/habilidades` | Redirecionado para `/login`. |
| Chamar a Server Action de exclusão com sessão de `voluntario` | `nao_autorizado`; a mensagem não revela se a habilidade existe. |

### 6. Propagação (FR-016)

| Passo | Esperado |
| --- | --- |
| Cadastrar uma habilidade nova e abrir `/voluntariado/candidatura` | A habilidade nova aparece entre as opções, sem recarga manual (as duas tags de cache foram invalidadas). |
| Renomear uma habilidade e abrir o filtro de voluntários | O novo nome aparece no filtro. |

### 7. Responsividade e auditoria

| Passo | Esperado |
| --- | --- |
| Repetir cadastro/edição/exclusão em viewport de celular | Diálogo em folha, ações alcançáveis, sem rolagem horizontal (FR-018). |
| Alternar tema claro/escuro | Tabela e diálogos legíveis nos dois. |
| Consultar a coleção de auditoria no Mongo | Um registro por operação, com ator, entidade `Habilidade` e dados anterior/novo (FR-017). |

## Critérios de aceite do roteiro

- Todos os passos acima com o resultado esperado.
- `npm run lint` e `npm run test:tudo` verdes.
- A consulta SQL da seção 4 devolve a mesma contagem antes e depois — nenhum vínculo de voluntário
  perdido em nenhum caminho.
