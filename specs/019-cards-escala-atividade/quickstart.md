# Quickstart: validar os cards de escala

**Feature**: 019-cards-escala-atividade

## Pré-requisitos

- `.env` com acesso ao banco de desenvolvimento, o mesmo usado por `npm run dev`.
- Um usuário coordenador, administrador ou membro da Defesa Civil.
- Três atividades de teste, criadas pela tela `/atividades`:
    - **A**: status `aberta` com 5 turnos. Um sem ninguém, um lotado, um com 6 ou mais voluntários e um com um voluntário de nome longo (40+ caracteres).
    - **B**: status `aberta` com um único turno.
    - **C**: status `encerrada` com 2 turnos.

## Checagens estáticas

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Resultado esperado: tudo verde. `npm test` não ganha testes novos (research D5), mas não pode regredir.

## Roteiro manual

Rode `npm run dev` e abra `/atividades/{id}`.

| # | Passo | Esperado | Requisito |
| --- | --- | --- | --- |
| 1 | Abrir **A** em 1280px | Título "Escalas" com "5 escalas". Pelo menos 3 cards por linha, todos com a mesma largura e em ordem cronológica | FR-001/002/005/009, SC-002 |
| 2 | Olhar cada card de **A** | Cabeçalho com horário, data e "X de Y vagas preenchidas". O déficit é destacado. Os voluntários aparecem um por linha, com ícone de papel e selo "Inscrição própria" | FR-006/007 |
| 3 | Card sem voluntários | O card aparece com "Nenhum voluntário escalado ainda." | FR-008 |
| 4 | Card com nome longo | O nome é truncado, o botão de remover continua visível e a dica mostra o nome completo | Edge Case |
| 5 | Card com 6+ voluntários | O card cresce na vertical, e os vizinhos de linha não esticam (alinhados no topo) | US2.4 |
| 6 | Redimensionar de 1920px até 320px | Os cards quebram de linha progressivamente e nunca aparece rolagem horizontal. Abaixo de ~600px, fica 1 card por linha com a largura total | FR-003/004, SC-003/004 |
| 7 | Abrir **B** em 1920px | Um card com a largura de uma coluna, sem esticar | Edge Case |
| 8 | Em **A**, alocar pelo botão de um card | O diálogo mostra o horário daquele turno. Depois de confirmar, o voluntário aparece naquele card e a ocupação atualiza | FR-010, US3.1 |
| 9 | Em **A**, remover um voluntário | O toast "Alocação cancelada" aparece e a pessoa sai daquele card | FR-011, US3.2 |
| 10 | Em **A**, filtrar por habilidade | Nenhum card nem voluntário escalado some. Só muda a lista do diálogo de alocar | US3.4 |
| 11 | Abrir **C** | Aparece o aviso de "não está aberta" e nenhum card tem botão de alocar | FR-012 |
| 12 | Navegar só com teclado e leitor de tela | Cada "Alocar…" anuncia a data e o horário do turno. Cada "Remover…" anuncia o nome. A seção é anunciada como lista de 5 itens | FR-014 |
| 13 | Repetir 1 e 6 em tema escuro | Os cards e o destaque de déficit continuam legíveis | Constituição (Dark/Light) |

## Verificação automatizada de overflow (opcional)

Com o servidor rodando, um script Playwright (Chromium em `/opt/pw-browsers`) pode, para cada largura em `[320, 375, 768, 1280, 1920]`:

1. Abrir a página da atividade **A** já autenticado.
2. Afirmar que `document.documentElement.scrollWidth <= window.innerWidth`.
3. Contar os cards cujo `offsetTop` é igual ao do primeiro card. Esperado: 1 em 320/375 e ≥ 3 em 1280.
