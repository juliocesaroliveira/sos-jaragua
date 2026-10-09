# Contract: rotas, autorização e consulta paginada

## Rotas de tela

| Rota | Conteúdo | Acesso |
| --- | --- | --- |
| `/relatorios` | Catálogo agrupado + pacote de contingência | `membro_defesa_civil`, `administrador` |
| `/relatorios/[relatorio]` | Filtros, resumo, prévia paginada, exportação | por relatório (abaixo) |
| `/relatorios/<slug inexistente>` | `notFound()` | — |

## `REGRAS_DE_ROTA` (`src/shared/auth/rotas.ts`)

Acrescentar **antes** da regra `/relatorios`:

```text
{ prefixo: '/relatorios/auditoria', roles: ['administrador'] }
```

As regras `/relatorios`, `/api/relatorios/export` e `/api/contingencia/export` não mudam.
`NAVEGACAO` não muda (um item "Relatórios"); o catálogo é que filtra por relatório.

Testes que travam o contrato (`rotas.test.ts`, catálogo):

- `podeAcessar('/relatorios/auditoria', 'membro_defesa_civil') === false`
- `podeAcessar('/relatorios/auditoria', 'administrador') === true`
- para todo slug ≠ `auditoria`: `podeAcessar('/relatorios/<slug>', 'membro_defesa_civil') === true`
- para todo slug: falso para `coordenador`, `voluntario`, `usuario`

## Página `/relatorios/[relatorio]`

1. `connection()`; `exigirAcessoA('/relatorios/<slug>')` (redireciona para `/sem-permissao`).
2. Lê `searchParams`, aplica `esquemaFiltros` e `normalizarPaginacao`.
3. Período inválido ⇒ renderiza o formulário com a mensagem de erro e **não** consulta.
4. Busca a primeira página no servidor e hidrata o TanStack Query (padrão de `relatorios/page.tsx`).

## Server Action `consultarRelatorioAction`

Arquivo: `src/modules/contingencia/presentation/actions/relatorios.ts` (`'use server'`).

```text
entrada: { relatorio: string; page?: number; pageSize?: number; ...filtros }
saída:   ResultadoAction<PaginaRelatorio>
```

| Código de erro | Quando |
| --- | --- |
| `nao_autorizado` | sem sessão ou `podeAcessar(definicao.rota, role)` falso |
| `relatorio_invalido` | slug desconhecido |
| `validacao` | período inválido (mensagem pt-BR do campo) |
| `auditoria_indisponivel` | R-17 com Mongo fora — mensagem "A trilha de auditoria está indisponível no momento. Tente novamente em instantes." |

Camada fina (Princípio I): parse → gate → `GerarRelatorioUseCase.pagina(...)`. Sem cache.

`queryKey` cliente: `chaveRelatorio(slug, params)` = `['relatorios', slug, params]`.

## Consultas por módulo (ports de leitura)

Cada módulo exporta funções `server-only`, sem `'use cache'`, com assinatura
`(filtros, pagina?) => Promise<Linha[]>` e `contar...(filtros) => Promise<number>`:

| Módulo | Arquivo | Relatórios |
| --- | --- | --- |
| Estoque | `estoque/presentation/queries/relatorios.ts` | R-01…R-08 |
| Voluntariado | `voluntariado/presentation/queries/relatorios.ts` | R-09…R-13 |
| Logística | `logistica/presentation/queries/relatorios.ts` | R-14 (R-15 usa `projecaoAtual`) |
| Notificações | `notificacoes/presentation/queries/relatorios.ts` | R-16 |
| Auditoria | `auditoria/presentation/queries/trilha.ts` | R-17 |
| Identidade | `identidade/presentation/queries/relatorios.ts` | `nomesPorIds`, opções do filtro de autor |

Contingência importa **apenas** esses arquivos — nunca `db/schema` nem repositórios de outro
módulo.
