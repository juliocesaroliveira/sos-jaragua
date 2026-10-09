# Quickstart: validar a central de relatórios

**Feature**: 023-central-relatorios

## Pré-requisitos

- `.env.local` com `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `MONGODB_URI` e
  `ALERTA_ESTOQUE_MINIMO`.
- Migration dos índices aplicada: `npm run db:generate` (gera a migration de
  [data-model.md §5](./data-model.md#5-índices-novos-migration)) e `npm run db:migrate`.
- Índices do Mongo: `npm run mongo:setup`.
- Usuários de teste: um `administrador`, um `membro_defesa_civil`, um `coordenador`.

## 1. Testes automatizados

```bash
npm test                 # domínio/aplicação: período BRT, catálogo e acesso, diff de auditoria,
                         # escape de fórmula, regras de R-05/06/07/08/10/12/13/14
npm run test:integracao  # Neon: filtro de período nas fronteiras de dia, fechamento de R-07
                         # contra saldo_estoque, agrupamento de destinos; Mongo: leitura da trilha
npm run lint
```

Esperado: tudo verde. `navegacao.test.ts` e `rotas.test.ts` continuam passando com a regra nova
de `/relatorios/auditoria`.

## 2. Roteiro manual (`npm run dev`)

| # | Passo | Resultado esperado | Spec |
| --- | --- | --- | --- |
| 1 | Entrar como `membro_defesa_civil`, abrir "Relatórios" | Catálogo com Estoque, Voluntariado, Crise, Comunicação; **sem** Auditoria; pacote de contingência no fim | FR-003, FR-020 |
| 2 | Acessar `/relatorios/auditoria` e `/api/relatorios/export?tipo=auditoria` direto | `/sem-permissao` e `403` | US4-4, SC-005 |
| 3 | Registrar duas saídas (uma hoje, outra com data antiga no seed); abrir "Histórico de saídas" com "7 dias" | Só a saída de hoje; URL contém `de`/`ate` | US1-2, FR-012 |
| 4 | Exportar XLSX e CSV | Cabeçalho com relatório, período, filtros, gerado em/por; todas as linhas; CSV abre no Excel pt-BR com acentos | FR-007, FR-008 |
| 5 | Criar saída com destino `=1+1`; exportar CSV e abrir no Excel | Célula mostra `=1+1` como texto | FR-011 |
| 6 | Registrar descarte; ver "Histórico de saídas" e "Descartes" | Só aparece em Descartes, com motivo | US1-4 |
| 7 | "Estoque crítico" e "Validades" com entradas perecíveis variadas | Ordenação por falta proporcional; "Vencida"/"A vencer"; aviso de validade | US2 |
| 8 | "Movimentação por item" do período até hoje | Saldo final = Inventário atual para todo item | SC-003 |
| 9 | "Voluntários cadastrados" | CPF e restrições completos; aviso LGPD junto da exportação | FR-014 |
| 10 | "Demanda × capacidade de kits" ao lado do Painel | Números idênticos | SC-007 |
| 11 | Entrar como `administrador`, abrir "Trilha de auditoria", filtrar pelo autor do passo 3 | Saídas do passo 3; "Ver alterações" mostra os campos | US4-1/2 |
| 12 | Com `MONGODB_URI` apontando para host inválido, reabrir a trilha e outro relatório | Trilha mostra indisponibilidade + "Tentar novamente"; outro relatório funciona | FR-023, SC-008 |
| 13 | Entrar como `coordenador` e acessar `/relatorios` | `/sem-permissao` | FR-002 |
| 14 | Período com início depois do fim | Erro no campo; nada é consultado | Edge case |
| 15 | Abrir uma página de relatório em viewport de 375 px | Sem rolagem horizontal da página | FR-013 |

## 3. Desempenho (SC-002, SC-004)

Com a carga de volume (`npm run db:seed:volume`; remover depois com `npm run db:seed:volume -- --limpar`), gerar a prévia de
"Histórico de saídas" com ~10.000 linhas no período (≤ 3 s) e exportar ~50.000 linhas
(≤ 30 s). Acima de 50.000: botões desabilitados e `422` no endpoint.

## Resultado da validação (2026-10-08, implementação)

**Automatizado — verde**

- `npm test`: 46 arquivos, 547 testes.
- `npm run test:integracao`: 61 de 65. As 4 falhas são **anteriores a esta feature** e estão todas em
  `voluntariado/infrastructure/drizzle/habilidade-repository.integracao.test.ts` (mapeamento de
  `DuplicadoError`/`VinculoExistenteError` e sobras `Teste xxxx` do próprio teste no banco de
  desenvolvimento); a feature não toca esses arquivos.
- `npm run lint`: limpo nos arquivos da feature; restam 8 erros anteriores (`no-restricted-imports`
  do barrel `@/src/shared/paginacao` nos arquivos de habilidades).
- `next build`: ok — `/relatorios`, `/relatorios/[relatorio]` (PPR) e `/api/relatorios/export`.
- Testes do Mongo rodaram com a coleção `audit_logs_teste`. Neste ambiente o Node via o DNS como
  `127.0.0.1` e não resolvia o registro SRV do Atlas; a execução usou um preload local
  (`dns.setServers`), sem mudança no repositório.

**Desempenho (§3), medido localmente contra o Neon de desenvolvimento** com `db:seed:volume`
(60.000 linhas, removidas depois com `--limpar`):

| Medida | Resultado | Meta |
| --- | --- | --- |
| Prévia de "Histórico de saídas" com 60.006 linhas no período | 1,1 s | ≤ 3 s (SC-002) |
| Exportação CSV de 47.382 linhas (streaming) | 9,2 s · 6,0 MB | ≤ 30 s (SC-004) |
| Exportação XLSX de 47.382 linhas (streaming) | 9,5 s · 1,9 MB | ≤ 30 s (SC-004) |
| Exportação acima de 50.000 linhas | `limite_exportacao` | `422` |

O CSV de 6 MB confirma que o arquivo passaria do limite de 4,5 MB sem streaming (research D8).

**Roteiro manual — parcial** (`next start` local, contas do seed):

| # | Resultado |
| --- | --- |
| 1 | ✅ Membro: catálogo com Estoque, Voluntariado, Crise, Comunicação; sem Auditoria; pacote de contingência presente |
| 2 | ✅ Membro: `/relatorios/auditoria` → `/sem-permissao`; export `tipo=auditoria` → `403` |
| 4 | ✅ CSV começa por `Relatório;Histórico de saídas`, `Período;…`; XLSX gerado (abertura no Excel não verificada) |
| 9 | ✅ Aviso de dados sensíveis presente em "Voluntários cadastrados" |
| 13 | ✅ Coordenador: `/relatorios`, `/relatorios/saidas` e a API → `/sem-permissao` |
| 14 | ✅ Período invertido: a página mostra o erro no campo; a API responde `400` |
| — | ⚠️ Slug inexistente renderiza "Endereço não encontrado" (com `noindex`), mas com status `200`: com Cache Components o `notFound()` chega depois do shell em streaming, e `dynamicParams` não existe nesse modo — mesmo comportamento de `/atividades/[id]` |
| 3, 5–8, 10–12, 15 | ⏳ Pendentes: exigem dados montados à mão, conta de administrador, derrubar o Mongo ou inspeção visual (viewport de 375 px) |

**Pendente fora deste ambiente**: medir a exportação de 50.000 linhas num deploy de preview da
Vercel (T063) — aqui a medição foi local.
