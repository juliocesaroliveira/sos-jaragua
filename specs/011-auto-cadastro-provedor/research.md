# Research — Auto-cadastro por provedor externo e pré-preenchimento da candidatura

**Feature**: `011-auto-cadastro-provedor` | **Data**: 2026-08-16

Todas as investigações abaixo foram feitas contra o código instalado neste repositório
(`better-auth@1.6.26`, `drizzle-orm@0.45.2`, `next@16.3.0`), não contra documentação genérica.
Cada decisão cita o arquivo verificado.

---

## D1 — Onde mora a data de nascimento

**Decision**: nova coluna `dataNascimento` em `user`, tipo `date` do Postgres, **nullable**,
declarada em `db/schema/identidade.ts` e espelhada como `additionalFields.dataNascimento` em
`src/shared/auth/auth.ts` com `input: false`.

**Rationale**:

- A constituição (§Stack) determina roles como `additionalFields` em `user`, não em tabela
  separada. Data de nascimento segue o mesmo princípio: é atributo da conta, não entidade.
- `date` e não `timestamp`: o domínio já trabalha com `YYYY-MM-DD` em
  `DadosCandidatura.dataNascimento`, o `DatePicker` de `src/shared/ui/date-picker` expõe
  `YYYY-MM-DD` na API externa justamente para casar com a coluna `date`, e `ehMaiorDeIdade`
  compara datas civis. Um `timestamp` introduziria fuso onde não há hora.
- `input: false` pelo mesmo motivo de `role` e `ativo`: o campo **nunca** é aceito do cliente
  pelos endpoints do better-auth. A única via de escrita é o caso de uso da candidatura
  (FR-016), passando pelo port de Identidade.
- Nullable é obrigatório: FR-003 cria a conta com o campo em branco, e as contas existentes
  não têm o dado.

**Alternatives considered**:

- *Coluna em `voluntario_perfil` apenas (status quo)*: mantém a redigitação a cada reenvio e
  impede o pré-preenchimento fora do fluxo de candidatura. Rejeitado — é exatamente o problema.
- *Tabela `usuario_perfil` 1:1*: um JOIN e uma migração a mais para guardar um campo escalar.
  Viola o Princípio VI (Simplicidade Operacional).
- *`timestamp` com hora zerada*: convida bugs de fuso em `ehMaiorDeIdade` na virada do dia.

---

## D2 — Não solicitar a data de nascimento aos provedores

**Decision**: `socialProviders` em `src/shared/auth/auth.ts` permanece **sem `scope`
customizado**. Google e Facebook continuam entregando apenas nome, e-mail e imagem.

**Rationale**: decisão já registrada na spec (Q1 → opção A). Obter a data exigiria
`user.birthday.read` + People API no Google e `user_birthday` com App Review no Facebook, com
o usuário podendo recusar e o Google frequentemente omitindo o ano. Dependência externa e tela
de consentimento mais invasiva para um dado que o candidato informa uma única vez. FR-004 e
SC-008 tornam essa ausência um requisito verificável, não um acidente.

**Consequência de implementação**: `mapProfileToUser` **não** é usado. Não há código de parsing
de data vinda de provedor para escrever ou testar.

---

## D3 — Não sobrescrever o nome em logins subsequentes

**Decision**: manter os defaults do better-auth. **Não** definir
`account.accountLinking.updateUserInfoOnLink` nem `overrideUserInfo`.

**Rationale**: verificado em `node_modules/better-auth/dist/oauth2/link-account.d.mts:1012-1021`
— `updateUserInfoOnLink` tem `@default false`, e o mesmo arquivo documenta que `email` e
`emailVerified` locais **nunca** são alterados por um link. Ou seja, FR-008 já é o comportamento
padrão. A decisão aqui é explicitar isso em comentário no `auth.ts` para que ninguém ative a
flag "para manter o perfil sincronizado" sem perceber que estaria mudando o nome de um
voluntário aprovado sem rastro de auditoria.

**Alternatives considered**: ativar `updateUserInfoOnLink` para manter o nome sempre igual ao
provedor. Rejeitado — colide com FR-008 e com a Q2 (nome civil da candidatura é distinto do
rótulo social).

---

## D4 — Vinculação por e-mail: o cenário de conta com senha **não funciona** hoje

**Decision**: manter o default seguro do better-auth e **tratar a recusa como caminho de erro
com mensagem em pt-BR**, em vez de afrouxar a verificação. A spec foi corrigida para refletir
isso (US1 cenário 3 e FR-005).

**Achado** — `node_modules/better-auth/dist/oauth2/link-account.mjs:22-28`:

```js
const requireLocalEmailVerified = accountLinking?.requireLocalEmailVerified ?? true;
if (!isTrustedProvider && !userInfo.emailVerified
    || requireLocalEmailVerified && !dbUser.user.emailVerified
    || accountLinking?.enabled === false
    || accountLinking?.disableImplicitLinking === true) {
    return { error: "account not linked", data: null };
}
```

O projeto habilita `emailAndPassword` com `autoSignIn: true` e **não** tem verificação de
e-mail configurada; `db/schema/identidade.ts:31` define `emailVerified` com `.default(false)`.
Portanto, quem criou conta por e-mail e senha tem `emailVerified = false`, e a cláusula
`requireLocalEmailVerified && !dbUser.user.emailVerified` **bloqueia** a vinculação implícita
quando essa mesma pessoa tenta entrar pelo Google com o mesmo e-mail. O usuário recebe hoje um
erro genérico de OAuth.

**Rationale da decisão**: a flag `requireLocalEmailVerified` existe para impedir o ataque em que
alguém pré-registra uma conta local no e-mail da vítima e captura a identidade OAuth dela no
primeiro login. O próprio tipo marca a opção como `@deprecated` — "the gate will become
unconditional" no próximo minor. Desativá-la é dívida técnica com prazo de validade e risco de
tomada de conta, o que colide frontalmente com o Princípio IV. O caminho correto é **explicar**
a recusa, não removê-la.

**Alternatives considered**:

- *`requireLocalEmailVerified: false`*: resolveria o cenário e reabriria o vetor de tomada de
  conta, num sistema que coordena dados sensíveis de voluntários. Rejeitado pelo Princípio IV.
- *Implementar verificação de e-mail no cadastro por senha*: resolveria de forma correta e
  definitiva, mas é uma feature própria (envio via Resend, template, rota de confirmação,
  estados de conta não verificada). Fora do escopo desta spec — registrado como trabalho
  futuro, não como pré-requisito.
- *`trustedProviders: ['google', 'facebook']`*: não resolve. A leitura do código mostra que ser
  provedor confiável só neutraliza a primeira cláusula (`!userInfo.emailVerified`); a cláusula
  de `emailVerified` local é independente e continua bloqueando.

---

## D5 — Auditoria do auto-cadastro

**Decision**: `databaseHooks.user.create.after` em `src/shared/auth/auth.ts`, chamando um caso
de uso fino do módulo Identidade que registra a criação via `withAudit` com **ator explícito**.

**Rationale**:

- O tipo do hook está confirmado em
  `node_modules/@better-auth/core/dist/types/init-options.d.mts:1138-1152`: recebe
  `(user, context)`, e o `context` permite identificar o provedor de origem.
- `withAudit` (`src/modules/auditoria/index.ts:35`) exige um ator; no auto-cadastro **não há
  sessão ainda** — o `AsyncLocalStorage` está vazio e `atorAtual()` devolveria `undefined`,
  fazendo o log cair no fallback `sistema`. O parâmetro `opcoes.ator` existe exatamente para
  isso (linha 21-22: "Ator explícito — usado onde não há escopo `comAtor`"). O ator é o próprio
  usuário recém-criado, com role `usuario`.
- `EntidadeAuditada` já inclui `'Usuario'` → `user`
  (`src/shared/db/mongo/audit-logs.ts:22`). Nenhuma alteração no contrato de auditoria.
- A degradação não-bloqueante do `withAudit` (Princípio V) é o que garante que uma falha do
  Mongo não impeça alguém de entrar no sistema durante uma crise.

**Alternatives considered**: usar o hook `before` para gravar. Rejeitado — o `before` roda antes
de existir `user.id`, e auditar uma criação que ainda pode falhar produziria log de evento que
não aconteceu.

---

## D6 — Login sem e-mail

**Decision**: nenhum código novo. O fluxo do better-auth já recusa o login quando o provedor não
devolve e-mail (o `userInfo` sem e-mail não produz usuário). O trabalho de FR-007 é somente
**tradução da falha** para pt-BR na tela de login, junto com o tratamento de D4.

**Rationale**: `email` é `notNull().unique()` em `db/schema/identidade.ts:30`; não há caminho de
criação sem e-mail. O requisito é de mensagem, não de regra.

---

## D7 — Escrita da data de nascimento na candidatura (FR-016)

**Decision**: usar a `UnidadeDeTrabalho` que **já existe** em
`src/modules/voluntariado/application/ports/voluntario-repository.ts:44-48`, que entrega
`{ voluntarios, usuarios }` numa única transação Postgres. `SubmeterCandidaturaUseCase` passa a
gravar o perfil e a data de nascimento na conta dentro do mesmo `executar`.

**Rationale**:

- O port `UsuarioRepository` de Identidade é a única via pela qual Voluntariado toca `user` —
  a regra do Princípio I ("um módulo não acessa tabelas de outro diretamente") já está
  estabelecida e documentada nesse mesmo arquivo, para `atualizarRole`. Seguimos o precedente
  adicionando um método ao port, sem criar acesso direto.
- Transação única evita o estado inconsistente "candidatura gravada, conta sem data" — que na
  prática deixaria o campo editável de novo no próximo acesso, contradizendo FR-014.
- `unidadeDeTrabalho` já é usada por `AprovarCandidaturaUseCase` para o par
  `voluntario_perfil.status` + `user.role`; o padrão é conhecido e testado.

**Método novo no port**: `definirDataNascimentoSeAusente(userId, data): Promise<void>` — a
condição "se ausente" fica no `WHERE` do UPDATE (`is null`), não numa leitura seguida de
escrita. Isso torna a operação idempotente e imune a corrida entre dois envios simultâneos, e
implementa diretamente a regra de borda "a data é gravada uma única vez".

**Alternatives considered**: gravar em duas transações separadas (candidatura, depois conta).
Rejeitado pelo estado inconsistente acima.

---

## D8 — De onde o formulário sabe o que desabilitar

**Decision**: o estado de habilitação é decidido **no servidor**, em
`app/(interno)/voluntariado/candidatura/page.tsx`, e passado ao componente cliente como props
(`email`, `nomeDaConta`, `dataNascimentoDaConta`). O formulário não consulta sessão.

**Rationale**: `page.tsx` já é um Server Component que chama `obterSessao()` e monta o
`CandidaturaForm` com props (linhas 43-79). `obterSessao` é memoizada por request
(`src/shared/auth/sessao.ts:39`), então ler a conta ali não custa uma ida extra ao banco. Manter
a decisão no servidor evita um estado de carregamento no cliente e um flash de campo editável
antes do preenchimento.

**Implicação**: `SessaoAtor` ganha `dataNascimento: string | null`, populado a partir do
`additionalField` que o `getSession` já devolve — sem consulta adicional.

---

## D9 — Não confiar nos campos desabilitados (FR-017)

**Decision**: `submeterCandidatura` (Server Action) deixa de aceitar `dataNascimento` do cliente
quando a conta já possui o dado, e **nunca** aceita e-mail. A resolução do valor final vira uma
função pura no `domain`, com teste.

**Rationale**: Princípio IV, e o comentário que já existe na própria action
(`candidatura.ts:37-38`): "Server Actions são POSTs para a própria rota e podem ser chamadas
fora da navegação normal". `disabled` no navegador não impede nada; a autoridade é o servidor.

**Forma**: `resolverDataNascimento(daConta: string | null, doFormulario: string | undefined)` em
`src/modules/voluntariado/domain/candidatura.ts` — devolve a da conta quando existe, senão a do
formulário. Pura, sem infraestrutura, testável em milissegundos (Princípio III).

---

## D10 — Tratamento visual de "campo vindo da conta"

**Decision**: **não** reutilizar apenas o `disabled:opacity-50` existente. Introduzir no design
system um estado de campo "somente leitura, preenchido pela conta", com contraste preservado e
texto de apoio explicando a origem.

**Rationale**: `src/shared/ui/campo/campo.tsx:74` aplica
`disabled:cursor-not-allowed disabled:opacity-50` ao controle de texto. Opacidade de 50% sobre
`text-foreground` derruba a razão de contraste abaixo do mínimo de 4.5:1 do WCAG AA — o que
falha FR-022 diretamente, e é pior no tema escuro. Além disso, FR-015 exige que o campo pareça
"preenchido pela sua conta" e não "quebrado/indisponível", e opacidade comunica exatamente a
segunda coisa.

**Forma**: variante de campo com fundo sutilmente distinto (`bg-neutral-*`), texto em contraste
pleno, `readOnly` + `aria-readonly` em vez de `disabled`.

**Nota de acessibilidade**: `readOnly` é preferível a `disabled` para leitores de tela — um
campo `disabled` é removido da ordem de foco e frequentemente não é anunciado, enquanto
`readOnly` é lido com seu valor. FR-022 pede exatamente isso ("acessíveis a leitores de tela
como campos de somente leitura"). O `DatePicker` (`src/shared/ui/date-picker/date-picker.tsx`)
só expõe `disabled?: boolean`; para o campo de data bloqueado, a alternativa é renderizar um
texto formatado em vez do calendário, evitando montar um widget interativo que não aceita
interação.

---

## D11 — Migração de banco

**Decision**: `npm run db:generate` para produzir `db/migrations/0002_*.sql`, aplicada com
`npm run db:migrate`. Coluna nullable, sem backfill.

**Rationale**: adicionar coluna nullable é operação não bloqueante no Postgres e não exige
janela. Não há backfill possível — o dado não existe em lugar nenhum hoje (a data em
`voluntario_perfil` pertence a quem já se candidatou; copiá-la seria um backfill legítimo, mas
a spec (Assumptions) decidiu explicitamente por **não** preencher retroativamente, para que o
valor na conta tenha sempre origem numa confirmação do próprio titular).

---

## Riscos residuais

| Risco | Mitigação |
| --- | --- |
| Conta com senha não consegue entrar pelo Google (D4) | Mensagem clara em pt-BR orientando a entrar com e-mail e senha. Solução definitiva (verificação de e-mail) fica registrada como trabalho futuro. |
| `requireLocalEmailVerified` vira incondicional num minor futuro do better-auth | Já estamos no comportamento estrito; a atualização não muda nada para nós. |
| Contas antigas sem data continuam com o campo editável indefinidamente se nunca se candidatarem | Aceito — a data só é necessária para candidatura. |
| Correção de data errada gravada na conta exige intervenção manual | Aceito e declarado nas Assumptions da spec. Tela de perfil é trabalho futuro. |
