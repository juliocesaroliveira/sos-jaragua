# Quickstart: validar o Lookup (021)

## Pré-requisitos

- `.env.local` apontando para um branch Neon de desenvolvimento.
- `npm run db:migrate` (aplica a migration com `unaccent`, `f_unaccent` e o índice novo).
- `npm run db:seed` — itens com e sem acento (ex.: "Água mineral 5L") e ao menos um item com
  saldo 0 e um kit ativo sem receita. Para validar paginação, mais de 5 itens.
- Usuário `coordenador` (acessa Entrada, Saída, Descarte e Kits).

## Verificações automáticas

```bash
npm test          # inclui escapar-like.test.ts (L-04)
npm run lint
npx tsc --noEmit
npm run build
```

Conferir o plano da busca (opcional, no SQL editor do Neon):
`explain analyze select … where f_unaccent(nome) % f_unaccent('agua') …` deve usar
`item_nome_unaccent_trgm_idx`.

## Cenários manuais (`npm run dev`)

| # | Onde | Passos | Esperado | Ref. |
| - | ---- | ------ | -------- | ---- |
| Q1 | Descarte | Digitar "a" | Dica "Digite ao menos 2 caracteres", sem requisição | C-02 |
| Q2 | Descarte | Digitar "agua" | ≤ 5 sugestões, inclui "Água mineral 5L" com categoria · unidade · saldo | FR-003, FR-015 |
| Q3 | Descarte | Escolher sugestão com setas + Enter | Input mostra o nome; saldo do item aparece; envio registra o descarte desse item | FR-004, FR-008, FR-019 |
| Q4 | Descarte | Após Q3, apagar uma letra e enviar | Envio bloqueado; erro "Selecione o item." abaixo do campo, foco nele | FR-010, FR-011 |
| Q5 | Descarte | Botão de pesquisa → página 2 → clicar linha | Diálogo fecha, campo preenchido; DevTools mostra 1 requisição por página | FR-005, FR-006, SC-003 |
| Q6 | Descarte | Abrir diálogo, digitar no filtro, Esc | Tabela filtrou e voltou à página 1; ao fechar, campo inalterado | FR-007, FR-009 |
| Q7 | Descarte | Só teclado: Tab até o botão, Enter, Tab até linha, Enter | Item selecionado | FR-017, SC-006 |
| Q8 | Saída (avulso) e Descarte | Buscar item com saldo 0 (sugestão e tabela) nos dois formulários | Exibido com "Sem saldo", não selecionável | FR-013, FR-019, FR-020, FR-024 |
| Q9 | Saída (kit) | Buscar kit sem receita | "Sem receita", não selecionável; kit com receita seleciona e a saída é registrada | FR-023 |
| Q10 | Saída | Adicionar 3 linhas, preencher cada uma por um caminho diferente | Linhas independentes | US3-AS4 |
| Q11 | Kits | Editar kit existente | Componentes mostram os nomes gravados; escolher item repetido mostra erro de duplicidade | FR-012, FR-021 |
| Q12 | Entrada | Selecionar item existente | Categoria/unidade preenchidas, aviso "Item existente" | FR-022 |
| Q13 | Entrada | Digitar nome inexistente, preencher categoria/unidade, salvar | Item novo criado com o nome digitado | FR-025 |
| Q14 | Entrada | Destinação (kit): selecionar e depois limpar | Seleção e limpeza funcionam (campo opcional) | FR-014, FR-023 |
| Q15 | Qualquer | DevTools → offline → digitar | Mensagem de erro com "Tentar de novo"; texto preservado; online + tentar ⇒ sugestões | FR-016 |
| Q16 | Qualquer | Largura 375 px | Diálogo como folha inferior, sem rolagem horizontal da página | edge "celular" |
| Q17 | Qualquer | Usuário `voluntario` chama `sugerirItensAction` (console/fetch) | `nao_autorizado` | FR-018 |
| Q18 | Saída | Registrar saída e voltar a buscar o mesmo item | Saldo nas sugestões já reflete a saída | L-07 |
| Q19 | Descarte | Selecionar um item; em outra aba, registrar saída de todo o saldo dele; voltar e enviar o descarte | Recusa do servidor exibida abaixo do campo (`quantidade`/`itemId`), sem perder os dados do formulário | Edge case "item alterado entre seleção e envio" |

## Medições (T035, 2026-10-05)

Branch Neon de dev, com 2.000 itens inseridos **dentro de uma transação desfeita com
`ROLLBACK`** (2.008 itens no total; nada persistiu). `EXPLAIN ANALYZE` da segunda execução de
cada consulta, que é a mesma SQL gerada por `sugerirItens` e `listarItensLookup`:

| Consulta | Execução | Usa `item_nome_unaccent_trgm_idx` |
| -------- | -------- | --------------------------------- |
| Sugestões "agua" (limit 5) | 3,83 ms | sim |
| Sugestões "feijao 1" (limit 5) | 3,70 ms | sim |
| Página 1, sem termo | 1,35 ms | — (ordem por `nome`) |
| Página 20, sem termo | 1,45 ms | — |
| `count` sem termo | 0,27 ms | — |
| Página 1, termo "arroz" | 2,97 ms | sim |
| Página 20, termo "arroz" | 3,03 ms | sim |
| `count` com termo "arroz" | 1,93 ms | sim |

Ida e volta da consulta de sugestões a partir da máquina de desenvolvimento, com a rede até o
Neon incluída: **159 ms**. Todas abaixo da meta de 300 ms da constituição.
