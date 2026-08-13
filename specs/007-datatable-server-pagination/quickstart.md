# Quickstart: validar a paginação server-side

**Feature**: 007-datatable-server-pagination

Guia de validação ponta a ponta. Detalhes de contrato ficam em [contracts/](./contracts/); o modelo de dados em [data-model.md](./data-model.md).

## Pré-requisitos

- `.env.local` com `DATABASE_URL` (Neon) e as variáveis de auth já usadas pelo projeto.
- Conta com role `administrador` para acessar `/admin`.
- **Massa de dados**: pelo menos **47 contas** e **47 itens de estoque** — abaixo de 21 registros a paginação não é observável nos cenários abaixo. Se o banco de desenvolvimento estiver enxuto, semear via a tela de cadastro ou seed do projeto antes de começar.

## Subir a aplicação

```bash
npm run dev          # Next 16 + Turbopack
```

## Verificações automatizadas

```bash
npm test             # unitários — inclui o saneamento de src/shared/paginacao
npm run lint
npx tsc --noEmit     # tipagem estrita (Princípio II)
```

O único teste unitário novo esperado é o do saneamento de parâmetros (regra pura): page/pageSize ausentes, `0`, negativos, `abc`, `7`, e o clamp de página além do fim.

## Cenário 1 — Rodapé em `/admin` (US1)

1. Abrir `http://localhost:3000/admin` autenticado como `administrador`.
2. **Esperado**: rodapé sob a tabela com `Exibindo 1–20 de 47 registros`, `Página 1 de 3`, seletor mostrando `20` e os controles de página.
3. Clicar em "próxima página".
4. **Esperado**: linhas 21–40; rodapé em `Página 2 de 3`; URL vira `?page=2`; o rodapé **não** desaparece durante o carregamento.
5. Ir até a página 3.
6. **Esperado**: avançar desabilitado, voltar habilitado.

**Como confirmar que é server-side (FR-008)**: com a aba Network aberta, cada troca de página gera **uma** requisição POST de server action; o payload de resposta traz no máximo `pageSize` registros. Nenhuma requisição inicial carrega as 47 contas.

## Cenário 2 — Registros por página (US2)

1. Em `/admin`, trocar o seletor de `20` para `5`.
2. **Esperado**: 5 linhas; `Página 1 de 10`; URL com `?page=1&pageSize=5`.
3. Navegar até a página 3 e trocar para `50`.
4. **Esperado**: volta para a página 1, 47 linhas, `Página 1 de 1`, controles de navegação desabilitados mas visíveis.
5. Recarregar a página (F5).
6. **Esperado**: `pageSize=50` preservado.

## Cenário 3 — URL compartilhável e entradas inválidas

| URL | Esperado |
|---|---|
| `/admin?page=2&pageSize=5` | abre direto na página 2 com 5 por página (SC-006) |
| `/admin?page=999` | primeira página válida ou última página válida, sem erro nem tela em branco |
| `/admin?page=0` / `?page=abc` | página 1 |
| `/admin?pageSize=7` | `pageSize` 20 (padrão) |

## Cenário 4 — Rollout nas demais telas (US3)

Repetir os cenários 1 e 2 em:

- `/voluntarios` — **além disso**: aplicar o filtro de status, ir para a página 2 e confirmar que o filtro permanece na URL e nos resultados (FR-019).
- `/estoque` — idem com o filtro de categoria.
- `/relatorios` — abas Inventário e Saídas devem exibir o mesmo rodapé; o botão de exportar continua baixando o arquivo **completo**, não só a página visível.

**Esperado em todas**: rótulos idênticos aos de `/admin` (SC-004).

## Cenário 5 — Acessibilidade e responsividade

1. Percorrer o rodapé apenas com `Tab`/`Shift+Tab` e acionar com `Enter`/`Espaço`.
   **Esperado**: todos os controles alcançáveis, anel de foco visível, sem armadilha de foco (SC-005).
2. Com leitor de tela, trocar de página.
   **Esperado**: a nova faixa é anunciada; a página ativa é identificada como atual.
3. DevTools em 360px de largura.
   **Esperado**: rodapé empilhado, sem rolagem horizontal da página (SC-007).

## Cenário 6 — Erros e lista vazia

1. Interromper a conexão (offline no DevTools) e trocar de página.
   **Esperado**: mensagem de erro em pt-BR com opção de tentar novamente; sem carregamento infinito (FR-014).
2. Aplicar um filtro sem resultados em `/estoque`.
   **Esperado**: mensagem de lista vazia; rodapé com "Nenhum registro" e `Página 1 de 1`; controles desabilitados.

## Cenário 7 — Regressão do design system

Abrir `/design-system` e localizar a seção do `Table`.
**Esperado**: demo com o rodapé completo; e alguma tabela sem a prop `paginacao` continuar renderizando sem rodapé (U-01.1).
