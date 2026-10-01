# Quickstart: validação da feature 020

Roteiro para provar que cada parte da feature funciona. Os detalhes de comportamento estão
em [contracts/](./contracts/) e [data-model.md](./data-model.md). Aqui fica só o **como
verificar**.

## Pré-requisitos

- `.env.local` com `DATABASE_URL*`, `BETTER_AUTH_*`, `MONGODB_URI` (string não-SRV se a
  rede local bloquear SRV, ver o README depois de V7).
- Usuários de teste por papel: tabela em `specs/002-role-based-app-shell/quickstart.md`
  (`admin@sosjaragua.local`, `coordenador1@teste.local`, `voluntario1@teste.local`,
  `usuario1@teste.local`, …).
- `npm ci` funcionando, o que exige o lockfile regenerado (V0).

## V0. Dependências e auditoria (D1, D5, SC-003)

```bash
npm ci                       # deve concluir (hoje falha: lockfile fora de sincronia)
npm audit --omit=dev         # sem high/critical; xlsx ausente
npm ls xlsx                  # "(empty)"
npm run lint && npx tsc --noEmit && npm test && npm run build
```

**Esperado**: tudo verde. Do audit sobram só moderadas documentadas (`drizzle-kit`,
`uuid` via `exceljs`).

## V1. Planilhas equivalentes (US2, SC-004)

1. **Antes** da troca (na `develop` atual), logado como `admin`, baixar:
   `/api/relatorios/export?tipo=inventario&formato=xlsx`, `…&formato=csv`,
   `/api/relatorios/export?tipo=saidas&formato=xlsx` e `/api/contingencia/export`.
2. **Depois** da troca, baixar os mesmos arquivos.
3. Abrir os pares no Excel (ou LibreOffice com locale pt-BR) e comparar abas, cabeçalhos,
   valores e larguras.

**Esperado**: conteúdo igual. Diferenças aceitas: o cabeçalho agora fica congelado ao
rolar, e o inventário ganha a coluna "Estoque mínimo" (V4). O CSV deve ser
**byte a byte igual**, salvo a coluna nova.

Teste automatizado: `npm test -- planilha` escreve e relê um XLSX e confere os invariantes
1 a 7 de [exportacao-planilhas.md](./contracts/exportacao-planilhas.md).

## V2. Rota pública de cadastro fechada (US3, C-01, SC-006)

```bash
curl -i -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"name":"Teste","email":"intruso@teste.local","password":"Senha@12345"}'
```

**Esperado**: `404`. Conferir no banco que `intruso@teste.local` não existe.

Depois, como `admin` em `/admin`, criar `novo@teste.local` com senha, sair e entrar com
ela. **Esperado**: login OK. `npm run test:integracao -- criar-usuario` continua verde.

## V3. Botões sociais condicionados (US3, C-02, SC-005)

| `.env.local`                                 | `/login` deve mostrar                                      |
| -------------------------------------------- | ---------------------------------------------------------- |
| Google e Facebook completos                  | dois botões + "ou" + "Usuário e senha"                     |
| Só Google completo (Facebook vazio)          | só Google + "ou" + "Usuário e senha"; aviso cita só Google |
| `GOOGLE_CLIENT_ID` preenchido, segredo vazio | Google **não** aparece                                     |
| Nenhum                                       | formulário de e-mail/senha direto, sem "Voltar" e sem "ou" |

Reiniciar o `next dev` a cada troca de `.env.local`. Teste unitário:
`npm test -- provedores-sociais`.

## V4. Estoque mínimo por item (US5, D4)

1. `npm run db:migrate` aplica a `0005_*`. Todos os itens ficam com mínimo vazio.
2. Como `coordenador1`, em `/estoque`: a coluna "Mínimo" mostra "Padrão (5 …)".
3. Definir **Arroz = 20**. Registrar saída até o saldo ficar em 19.
4. Abrir o sino (alertas rodam em `after()`; recarregar se preciso).
   **Esperado**: "Arroz (mín. 20 kg) atingiu o estoque mínimo de segurança."
5. Definir **Cobertor = 0** e zerar o saldo dele. **Esperado**: Cobertor não aparece em
   nenhum alerta.
6. Item sem mínimo com saldo 4 (global 5). **Esperado**: entra no alerta (fallback).
7. Como `defesa-civil1@teste.local` (`membro_defesa_civil`), em `/estoque`: a coluna e a
   ação "Definir estoque mínimo" aparecem. Definir **Feijão = 15** e conferir que grava.
   Depois, em `/estoque/entrada`, cadastrar um **item novo** "Sabonete" com mínimo `30`:
   o campo só aparece para item novo, e a tabela mostra "30 un". Ao escolher um item
   existente no autocomplete, o campo some.
   Como `voluntario1@teste.local`, chamar a action direto (DevTools): `nao_autorizado`.
8. Tentar `-1` no formulário. **Esperado**: erro de validação em pt-BR, nada gravado.
9. Conferir em `audit_logs` um `update` com `tabela: 'item'` e o antes/depois do mínimo.

Testes: `npm test -- estoque-minimo` (regra pura), `npm test -- entrada` (mínimo no item
novo) e `npm test -- definir-estoque-minimo` (caso de uso).

> Para repetir o alerta dentro da janela de 12h, apagar as notificações `estoque_critico`
> de teste ou testar com outro item. A idempotência é proposital.

## V5. Timeout de inatividade, ID-06 (US4, FR-015)

1. `.env.local`: `STAFF_INACTIVITY_TIMEOUT_MINUTES="1"`. Reiniciar o `next dev`.
2. Entrar como `coordenador1`, navegar uma vez e ficar **> 1 min** parado. Clicar em
   qualquer link.
   **Esperado**: `/login?motivo=expirado`, com o aviso de sessão expirada.
3. Entrar de novo e navegar a cada ~30s por 5 min. **Esperado**: sessão ativa o tempo todo.
4. Entrar como `voluntario1`, ficar > 1 min parado e navegar. **Esperado**: sessão ativa.
5. Restaurar o valor original. Marcar `[x] ID-06` em `spec/TASKS.md` com a data.

## V6. Matriz de acesso, DEPLOY-06 (US4, FR-016)

Para `coordenador1`, `voluntario1` e `usuario1`: abrir cada rota protegida do mapa em
`src/shared/auth/rotas.ts` e anotar o resultado (acessa / `sem-permissao` / login).
Comparar com o BRD §2.

**Esperado**: `coordenador` acessa tudo de staff, menos `/admin`. `voluntario`/`usuario`
acessam só `/voluntariado/*` e a candidatura. Registrar a tabela de resultado no próprio
`spec/TASKS.md` (nota sob DEPLOY-06) e marcar `[x]`.

## V7. Documentação (US1, US6, SC-001, SC-002, SC-008)

- `PENDENCIAS.md`: no máximo 7 itens. Cada "Estado atual" conferido contra o repo. Itens 5,
  9, 11 e 12 ausentes. Item novo de dependências presente **só se** algo ficou sem correção.
- `spec/DESIGN.md` §16 e §19: `exceljs`; decisões Q1–Q3 e itens 5/9 registrados; §17 com
  `ALERTA_*`.
- `.specify/memory/constitution.md`: Stack cita `exceljs` (emenda PATCH 1.0.1).
- `README.md`: seção "Desenvolvimento local" com a string não-SRV do Atlas.
- `spec/ROTEIRO_PRODUCAO.md`: entregar a uma pessoa sem contexto e cronometrar quanto ela
  leva para dizer o estado de cada passo (meta: < 10 min).
