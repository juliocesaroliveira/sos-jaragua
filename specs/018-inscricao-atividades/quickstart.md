# Quickstart: validação da Inscrição Voluntária em Atividades

**Feature**: [spec.md](spec.md) · Contratos: [ações](contracts/acoes-inscricao.md),
[UI](contracts/ui-atividades-abertas.md) · Modelo: [data-model.md](data-model.md)

## Pré-requisitos

- `.env.local` apontando para uma **branch Neon de desenvolvimento** (nunca produção).
- Migração aplicada: `npm run db:generate` (revisar o SQL: backfill entre adicionar coluna e `SET NOT NULL` —
  ver [data-model § Ordem da migração](data-model.md#ordem-da-migração)) → `npm run db:migrate`.
- `npm run db:seed` executado.
- Seis contas para o teste:
  - **V1**: voluntário com perfil aprovado.
  - **V2**: outro voluntário com perfil aprovado.
  - **U1**: usuário comum.
  - **M1**: membro da Defesa Civil sem perfil de voluntário.
  - **C1**: coordenador.
  - **A1**: administrador.
- C1 cria, em `/atividades`:
  - **Atividade X**: 3 turnos de 4h começando amanhã às 08:00, com **1 vaga** por turno.
  - **Atividade Y**: 2 turnos de 4h começando em ~1h, com 5 vagas.

## Verificações automatizadas

```bash
npm test                 # domain/inscricao + casos de uso (rápido, sem rede)
npm run test:integracao  # concorrência na última vaga, reinscrição, backfill
npm run lint
npx tsc --noEmit
```

Todos devem passar. `navegacao.test.ts` falha se menu e `REGRAS_DE_ROTA` divergirem.

## Roteiro manual (`npm run dev`)

| # | Passo | Resultado esperado | Cobre |
| --- | --- | --- | --- |
| 1 | U1 acessa `/voluntariado/atividades-abertas` digitando a URL | Redireciona para `/sem-permissao`; o item não aparece no menu de U1 | FR-002/003, SC-005 |
| 2 | V1 abre "Atividades abertas" pelo menu, no celular (375px) | X e Y aparecem em cartões; os turnos mostram horário, "0 de 1 vagas preenchidas" e o selo "Últimas vagas" (X); não há rolagem horizontal | US1, FR-004..008 |
| 3 | C1 encerra uma terceira atividade Z | Z não aparece para V1 | US1-2 |
| 4 | V1 clica em "Quero participar" no turno 1 de X e depois em Cancelar | Nada muda | FR-012 |
| 5 | V1 confirma a inscrição no turno 1 de X | Toast de sucesso; o turno mostra "Você está inscrito"; o sino de V1 mostra "Nova atividade atribuída"; o turno aparece em "Minhas atividades" | US2-1, FR-016, FR-021 |
| 6 | C1 olha o sino e abre o painel de X | Notificação "V1 se inscreveu…"; V1 aparece no turno 1 com o selo "Inscrição própria" | US4-4, FR-020, FR-022 |
| 7 | V2 tenta se inscrever no turno 1 de X | O turno aparece "Lotado", sem botão | US1-3 |
| 8 | V2 abre a tela, **V1 desiste em outra janela**, e V2 tenta se inscrever | V2 consegue se inscrever, porque a vaga foi liberada | FR-018 |
| 9 | V1 tenta se inscrever em um turno que se sobrepõe ao horário de um turno em que já está | Recusa: "Você já está escalado em outro turno neste horário…" | US2-5 |
| 10 | M1 (sem perfil) se inscreve no turno 1 de Y | Sucesso; no painel de Y, M1 aparece com o ícone `Shield` e a dica "Membro da Defesa Civil" | FR-011, FR-024/025 |
| 11 | Tela de V1 em "Atividades abertas" | Nenhum nome de participante aparece | FR-010a |
| 12 | Quando faltarem ≤ 30 min para o turno 1 de Y, M1 vê o turno | Não há botão "Desistir"; aparece "Para desistir, fale com a coordenação" | US3-2, FR-018a |
| 13a | M1 abre `/atividades/{Y}` e aloca V2 manualmente no turno 2, depois remove | As duas operações funcionam | FR-019a, US4-2 |
| 13b | M1 abre `/atividades` | Não vê "Nova atividade" nem o menu de encerrar/cancelar/reabrir; vê "Abrir escala" | US4-3 |
| 14 | C1 aloca manualmente além das vagas no turno 1 de X | É permitido, como hoje | FR-019, US4-1 |
| 15 | V1 aplica os filtros de categoria, dia e "Somente com vagas" | A lista filtra na hora; "Limpar filtros" restaura a lista | US5 |
| 16 | V1, com a rede desligada (DevTools offline), tenta se inscrever | Toast de erro de conexão; o diálogo continua aberto | Edge: conectividade |
| 17 | Consultar a coleção de auditoria (Mongo) | Há registros `create`/`update` em `alocacao` com o ator V1/M1 e `origem` | FR-023 |

## Verificação de concorrência (SC-003)

O teste de integração dispara N inscrições simultâneas de usuários distintos em um turno de 1 vaga e verifica:
exatamente 1 alocação `confirmado` e N−1 respostas `lotado`. Para reproduzir manualmente, abra duas janelas
(V1 e V2) no mesmo turno de 1 vaga e confirme as duas ao mesmo tempo. Apenas uma pessoa entra.

Caso da mesma pessoa em duas abas: V1 abre dois turnos **sobrepostos** de atividades diferentes em duas janelas e
confirma os dois ao mesmo tempo. Apenas um é aceito; o outro recebe "Você já está escalado em outro turno neste
horário…" (coberto também pelo teste de integração (f)).
