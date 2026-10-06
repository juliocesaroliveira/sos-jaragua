# Quickstart: validar o cadastro de item novo no kit

Feature: [spec.md](./spec.md) · Contratos: [salvar-kit](./contracts/salvar-kit.md),
[lookup-vincular-identico](./contracts/lookup-vincular-identico.md) · Modelo: [data-model.md](./data-model.md)

## Pré-requisitos

- Branch Neon **de dev** com a migration 0007 aplicada: `npm run db:migrate`.
- `npm run dev` e uma sessão de **coordenação**. A Q10 pede também uma sessão de operação.
- Use um nome-teste que não exista no catálogo (ex.: `Sabonete líquido 250 ml QS`) e um que
  exista (ex.: o nome de qualquer item da tabela de estoque).

## Verificações automáticas

```bash
npm test                    # validarReceita, normalizarNomeItem, itensCriticos, SalvarKitUseCase
npm run test:integracao     # salvarComposicao: atomicidade, vínculo, ambiguidade, lock
npx tsc --noEmit && npm run lint
```

## Roteiro manual (`/estoque/kits`)

| # | Passos | Esperado | Spec |
|---|--------|----------|------|
| Q1 | "Novo kit" → no componente, digitar o nome-teste | Sugestões: "Nenhum item com esse nome. Ele será cadastrado como item novo."; o texto permanece | US1-AS1, FR-002 |
| Q2 | Sair do campo | Aparece abaixo da linha o grupo "Item novo" com Categoria e Unidade (vazias) e Estoque mínimo | US1-AS2, FR-003 |
| Q3 | Salvar sem Categoria | Envio bloqueado; erro abaixo de Categoria | US1-AS4 |
| Q4 | Preencher Categoria, Unidade e "Por kit"; salvar | Toast "Kit criado"; card com o item e "0 kit(s) montável(is)"; o item aparece em `/estoque` com saldo 0 e **sem** o selo "abaixo do mínimo" | US1-AS3, US3-AS3, FR-007, FR-015 |
| Q5 | Na Saída (itens avulsos), buscar o nome-teste | Item aparece identificado como sem saldo | Edge case |
| Q6 | Editar o kit da Q4 | O componente mostra o item como existente, sem o grupo "Item novo" | US1-AS7, FR-013 |
| Q7 | Novo kit → digitar outro nome novo, preencher tudo → Cancelar → buscar o nome em `/estoque` | Item não existe | US1-AS5, FR-008 |
| Q8 | Novo kit → digitar o nome de um item existente com outra caixa e sem acento → sair do campo | O campo passa a mostrar o nome do cadastro; o grupo "Item novo" não aparece | US2-AS3, FR-009 |
| Q9 | Selecionar um item existente → editar o texto | Seleção desfeita; o grupo "Item novo" aparece | US2-AS2, FR-005 |
| Q10 | Com sessão de operação, chamar `salvarKit` com `novoItem` (DevTools ou teste) | `nao_autorizado`; nenhum item criado | FR-011 |
| Q11 | Duas linhas com o mesmo nome novo (uma com acento e outra sem) → salvar | Segunda linha: "Este item já está na receita." | US3-AS1, FR-010 |
| Q12 | Duas abas: na aba A, digitar nome novo X no kit (sem salvar); na aba B, criar X pela Entrada; voltar à aba A e salvar | Kit salvo vinculado ao item criado na aba B; nenhum item X duplicado | Edge case, FR-009 |
| Q13 | Derrubar a rede (DevTools offline) → salvar kit com item novo | Erro em pt-BR; tudo o que foi digitado permanece; nenhum item criado | US1-AS6, FR-014 |
| Q14 | Registrar uma Entrada do nome-teste com quantidade abaixo do mínimo | O item passa a mostrar "abaixo do mínimo" em `/estoque` e entra no alerta de estoque crítico | FR-015 |
| Q15 | Auditoria do kit da Q4 | Um registro `kit` (create) com `itensCriados` e um registro `item` (create, `origem: 'kit'`) | FR-012 |
| Q16 | DevTools 375 px: repetir Q1–Q4 só com teclado | Sem rolagem horizontal; todo o fluxo é concluível por teclado | SC-005 |

## Verificação do SC-002 (nenhum item órfão)

Antes e depois da Q7 e da Q13, contar no SQL do Neon de dev: `select count(*) from item;`.
O número não pode mudar.
