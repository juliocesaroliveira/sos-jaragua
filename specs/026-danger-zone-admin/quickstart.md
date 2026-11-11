# Quickstart: validar a Danger Zone

**Feature**: 026-danger-zone-admin | Contratos: [contracts/](./contracts/) | Modelo:
[data-model.md](./data-model.md)

> ⚠️ **Nunca valide resets no banco de desenvolvimento compartilhado.** Os testes de integração do
> projeto rodam contra o Neon de desenvolvimento (`vitest.integracao.config.ts`). Para tudo que
> envolve **resetar tabela**, crie um branch Neon descartável e aponte `DATABASE_URL` para ele.

## Pré-requisitos

1. `.env.local` com `DATABASE_URL`, `MONGODB_URI`, `BETTER_AUTH_*`, chave de criptografia (025).
2. Branch Neon descartável a partir do de desenvolvimento (console Neon ou `neonctl branches
   create`), com `DATABASE_URL` apontando para ele durante o roteiro manual.
3. `npm run db:migrate` (aplica registros padrão + índice parcial de `alocacao`), `npm run
   mongo:setup` (índice `manutencao_execucao_timestamp`), `npm run db:seed`.
4. Uma conta `administrador` (bootstrap `ADMIN_EMAIL`) e uma `coordenador`.

## Testes automatizados

| Comando | O que prova |
|---|---|
| `npm test` | domínio puro: `conferirCatalogo`, ordem topológica e ponto fixo (ciclo artificial incluso), regra "exclusão prevalece sobre redirecionamento", texto de confirmação, comparação de impressão digital, redação de credenciais |
| `npm run test:integracao` | catálogo × `pg_catalog` (FR-013a); **recalcular saldo de banco intacto não muda nenhum saldo** (research D10); `excluir_selecionados` sobre registros criados pelo próprio teste — cascata e preservação; divergência → `dados_mudaram`; falha simulada da auditoria → nada muda no Postgres |

Os testes de integração **só** usam `excluir_selecionados` sobre linhas que eles mesmos criam;
resets inteiros ficam no roteiro manual em branch descartável.

## Roteiro manual (branch descartável)

| # | Passo | Esperado |
|---|---|---|
| 1 | Entrar como `coordenador` e abrir `/admin/danger-zone` | `/sem-permissao`; item de menu ausente (SC-002) |
| 2 | Chamar `executarAcaoAction` como `coordenador` (devtools / script) | `nao_autorizado` |
| 3 | Entrar como `administrador` | item "Danger Zone" em cor de alerta; faixa de ambiente no topo |
| 4 | Inventário | 26 tabelas por área, contagens, dependências; `kit` mostra `kit_receita_item`, `metrica_kit`, `entrada` |
| 5 | Resetar `kit` → **Preservar** | prévia: `kit_receita_item` e `metrica_kit` em "apagados em qualquer modo"; `entrada.kit_destino_id` → vazio; texto `RESETAR kit` |
| 6 | Executar | resultado bate com a prévia (SC-001); entradas continuam lá sem kit de destino; trilha com `iniciada`, snapshots, `concluida` |
| 7 | Resetar `item` → **Cascata** | prévia lista `entrada`, `saida_item`, `descarte`, `saldo_estoque`, `kit_receita_item`; "Item removido" em preservados |
| 8 | Voltar, escolher **Preservar** | movimentações → "Item removido"; saldos antes→depois; negativos destacados |
| 9 | Abrir a prévia em duas abas; executar na 1ª; criar uma entrada; executar na 2ª | 2ª recebe `dados_mudaram` e a prévia nova |
| 10 | Resetar `user` → Preservar | sua conta e sessão em preservados; alocações → "Usuário removido"; alerta "desconectadas em até 5 min" |
| 11 | Executar e entrar como outro usuário em seguida | a outra conta não existe mais; seu login continua ativo |
| 12 | Conferir telas: lookup de item, `/admin`, categoria em nova atividade | registros padrão não aparecem como opção; relatórios mostram "Usuário removido" como autor |
| 13 | Esperar 16 min após o login e tentar executar | passo de confirmação mostra **Entrar novamente** (FR-003) |
| 14 | Derrubar o Mongo (URI inválida) e executar | `auditoria_indisponivel`; contagens do Postgres inalteradas |
| 15 | Aba Histórico | todas as execuções acima, com recusas e cancelamentos (SC-006) |
| 16 | Excluir 1 `item` selecionado com entradas | prévia só com dependentes daquele item (US2) |
| 17 | Abrir registros de `voluntario_perfil` | CPF/CEP/nascimento mascarados; `account` sem senha/tokens |

Ao final, apague o branch Neon descartável.
