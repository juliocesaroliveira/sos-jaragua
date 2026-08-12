# Contract: Gate de Roteamento (`proxy.ts` + `src/shared/auth/rotas.ts`)

Contrato de comportamento observável do gate de autenticação/autorização para toda
requisição de navegação. Consumido por: qualquer rota sob `app/` (exceto isenções técnicas
do `config.matcher` de `proxy.ts`, que não mudam nesta feature: `/api/auth/*`,
`_next/static`, `_next/image`, `favicon.ico`, `sitemap.xml`, `robots.txt`, assets estáticos).

## Entrada

- `pathname`: path da requisição.
- Cookie de sessão (presença/ausência) + cache de sessão assinado (`getCookieCache`), quando
  presente.

## Saída (uma das quatro)

| Condição | Resposta |
|---|---|
| `pathname === '/login'` | `NextResponse.next()` — sempre acessível, sem checagem de sessão. |
| Sem cookie de sessão, `pathname !== '/login'` | `redirect('/login?redirecionar=<pathname original>')` |
| Sessão expirada por inatividade (staff, DESIGN.md §6.3) | `redirect('/login?redirecionar=<pathname>&motivo=expirado')` |
| Sessão válida, mas rota exige role que o usuário não tem (`REGRAS_DE_ROTA`) | `redirect('/sem-permissao')` |
| Sessão válida e (rota sem exigência de role OU role compatível) | `NextResponse.next()` |

## Regressão a evitar

- `/`, `/cadastro`, `/voluntariado/candidatura`, `/design-system`, `/sem-permissao` **deixam**
  de cair na linha "sem exigência de role, sem checagem de sessão" — passam a exigir sessão
  válida (linha "sessão válida e rota sem exigência de role" acima), conforme decisão de
  escopo em `spec.md` (Assumptions).
- `/login` continua sendo a única rota que responde `next()` mesmo sem cookie de sessão.
- O caminho de staff (`/estoque/*`, `/dashboard`, `/admin/*` etc.) mantém exatamente o
  comportamento de hoje: `REGRAS_DE_ROTA` inalterado, só passa a ser avaliado **depois** da
  checagem de sessão em vez de ser a única fonte de proteção.

## Verificação

- Teste unitário de `src/shared/auth/rotas.ts` (ou equivalente função pura extraída do gate):
  para cada path de exemplo acima, a classificação (pública / role exigida / qualquer sessão)
  deve bater com a tabela.
- Verificação manual: ver `quickstart.md`.
