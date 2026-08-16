# Quickstart — Validação da feature 011

**Feature**: `011-auto-cadastro-provedor`

Roteiro para provar que a feature funciona ponta a ponta. Não contém código de implementação —
os contratos estão em [contracts/](./contracts/) e as regras em [data-model.md](./data-model.md).

## Pré-requisitos

- `.env.local` com `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` e, se for testar Facebook, as credenciais
  correspondentes. O passo a passo de obtenção das credenciais do Google está em
  `GOOGLE_AUTH_SETUP.md` na raiz do repositório.
- URI de redirecionamento `http://localhost:3000/api/auth/callback/google` registrada no
  console do provedor.
- Conexão com o MongoDB de auditoria (`MONGODB_URI`) — sem ela o login **ainda deve funcionar**,
  e isso é justamente um dos cenários de validação (V6).
- Uma conta Google **nunca usada** neste ambiente. Sem ela, o cenário de primeiro acesso não é
  observável.

## Setup

```bash
npm install
npm run db:generate     # gera db/migrations/0002_*.sql a partir do schema alterado
npm run db:migrate      # aplica no Neon
npm run dev
```

Confirme a migração antes de seguir:

```bash
npm run db:studio       # a tabela `user` deve exibir a coluna data_nascimento, nullable
```

## Testes automatizados

```bash
npm test                # domain + application, sem rede — deve rodar em segundos
npm run test:integracao # fluxos transacionais contra o Neon real
npm run lint
```

O conjunto unitário deve cobrir, no mínimo:

- `resolverDataNascimento` — conta preenchida vence o formulário; conta vazia usa o formulário;
  ambos vazios devolvem indefinido (→ erro de campo obrigatório).
- `SubmeterCandidaturaUseCase` — data da conta ignora valor forjado no envio; menor de idade
  vindo da conta é recusado; candidatura aprovada segue recusando reenvio.

O conjunto de integração deve cobrir:

- Perfil salvo **e** `user.data_nascimento` gravada na mesma transação.
- Idempotência: segunda chamada com data diferente não altera o valor já gravado.

## Validações manuais

### V1 — Primeiro acesso por provedor (FR-001 a FR-003, FR-006)

1. Navegador anônimo → `http://localhost:3000/login`
2. Antes de clicar, confira que a tela informa quais dados serão obtidos (FR-010).
3. Entre com a conta Google nunca usada.

**Esperado**: entra direto, sem formulário de cadastro. Em `db:studio`, a linha em `user` tem
nome e e-mail do Google, `role = usuario`, `ativo = true`, `data_nascimento = NULL`.

**Falha comum**: `role` diferente de `usuario` indica que `input: false` foi removido do
`additionalField`.

### V2 — Candidatura com conta sem data (FR-011 a FR-014)

1. Com a sessão de V1, vá a `/voluntariado/candidatura`.

**Esperado**:
- E-mail exibido, não editável, correspondendo à conta.
- Nome preenchido com o nome do Google e **editável**.
- Data de nascimento **vazia, editável e obrigatória**.

2. Corrija o nome para o nome civil completo, preencha a data (maior de 18) e os demais campos.
   Envie.

**Esperado**: candidatura registrada. Em `db:studio`: `voluntario_perfil.nome_completo` com o
nome **corrigido**, e `user.data_nascimento` agora preenchida. `user.name` **inalterado** — segue
sendo o nome do Google (FR-018).

### V3 — Segunda visita com data já registrada (FR-014)

1. Rejeite a candidatura pela fila de triagem (`/cadastros-pendentes`, com conta de staff).
2. Volte ao formulário com a conta de V1.

**Esperado**: data de nascimento preenchida e **somente leitura**; nome ainda editável, exibindo
o valor **corrigido** em V2, não o nome do Google; e-mail somente leitura.

### V4 — Campo bloqueado não é enforcement (FR-017)

Com a conta de V3 (que já tem data na conta), remova o atributo de somente leitura pelo
DevTools, altere a data para outra e envie.

**Esperado**: envio aceito e a data gravada **continua sendo a da conta**. Nenhum erro de
validação — o valor forjado é simplesmente descartado.

Variante: conta com data de nascimento de menor de idade → envio recusado com a mensagem de
idade mínima, mesmo que o campo forjado indicasse maioridade.

### V5 — Acessibilidade e contraste (FR-015, FR-022)

1. Alterne tema claro/escuro na aplicação.
2. Meça o contraste do texto dos campos somente leitura (DevTools → inspetor de cor).
3. Navegue o formulário só com Tab e com leitor de tela.

**Esperado**: contraste ≥ 4.5:1 nos dois temas; campos somente leitura **anunciados com seu
valor** e alcançáveis por foco; texto de apoio indicando que o dado vem da conta.

**Falha esperada se o trabalho não for feito**: reaproveitar `disabled:opacity-50` reprova a
medição de contraste — é o motivo de D10 existir.

### V6 — Auditoria não bloqueante (FR-009, Princípio V)

1. Confirme em `audit_logs` (Mongo) o registro `entidade: 'Usuario'`, `acao: 'create'`,
   `tabela: 'user'` correspondente a V1, **sem** tokens do provedor no `dadosNovos`.
2. Aponte `MONGODB_URI` para um host inválido, reinicie o dev server e repita V1 com outra conta
   Google nova.

**Esperado**: o login **conclui normalmente**. O erro aparece apenas como log estruturado no
console (`[auditoria] ...`). Um login que falha aqui viola o Princípio V.

### V7 — E-mail já usado por conta com senha (FR-005a, D4)

1. Crie uma conta por `/cadastro` com um e-mail Google que você controle.
2. Saia e tente entrar por Google com esse mesmo e-mail.

**Esperado**: acesso recusado com mensagem em pt-BR explicando que o e-mail já tem conta com
senha — **não** um erro genérico de autenticação, e **não** uma segunda linha em `user`.

Este é o comportamento correto e deliberado: afrouxar `requireLocalEmailVerified` reabriria um
vetor de tomada de conta. Ver [research.md](./research.md) D4.

## Checklist de conclusão

- [ ] Migração aplicada; coluna nullable visível em `user`
- [ ] `npm test` e `npm run test:integracao` verdes; `npm run lint` limpo
- [ ] V1–V7 conferidos manualmente
- [ ] Nenhum escopo OAuth novo solicitado (conferir tela de consentimento do Google — SC-008)
- [ ] `auth.ts` sem `updateUserInfoOnLink`, `overrideUserInfo` ou `requireLocalEmailVerified`
- [ ] Interface 100% pt-BR, incluindo as mensagens de recusa de vinculação
