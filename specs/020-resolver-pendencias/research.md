# Research: Resolução das Pendências Abertas

**Feature**: `020-resolver-pendencias` | **Data**: 2026-10-01

Cada decisão abaixo foi verificada contra o código e as dependências instaladas em
2026-10-01 (better-auth 1.6.26, next 16.3.0, exceljs 4.4.0 numa instalação isolada).

---

## D1. Biblioteca de planilhas: `exceljs` (Q1)

**Decision**: Trocar `xlsx@0.18.5` por `exceljs@4.4.0`. A troca fica restrita a
`src/modules/contingencia/infrastructure/planilha.ts`. A geração de CSV continua artesanal
nesse arquivo, como hoje: separador `;`, BOM e escape RFC 4180, sem passar por nenhuma
biblioteca. `gerarXlsx` passa a ser `async` e devolve `Promise<Buffer>`, porque
`workbook.xlsx.writeBuffer()` é assíncrono. Os dois chamadores
(`app/api/relatorios/export/route.ts` e `app/api/contingencia/export/route.ts`) já são
handlers `async` e só ganham um `await`.

**Rationale**:

- Sondagem em instalação isolada: `addWorksheet(nome, { views: [{ state: 'frozen', ySplit: 1 }] })`
  congela o cabeçalho, `columns[].width` mapeia 1:1 o `wch` atual, `addRow` com `null`
  deixa a célula vazia, números continuam numéricos e acentos sobrevivem a um ciclo de
  escrita e leitura.
- Nomes de aba: o exceljs **lança erro** com `* ? : \ / [ ]` e **trunca** (com aviso no
  console) acima de 31 caracteres. O `limitarNomeAba` atual continua necessário e passa a
  ser obrigatório, não só defensivo.
- Ganho colateral: o SheetJS Community Edition **ignora** `!freeze` na escrita. O
  congelamento de cabeçalho que o comentário atual promete nunca funcionou, e passa a
  funcionar com o exceljs.
- `npm audit --omit=dev` numa instalação só com `exceljs@4.4.0`: 0 high/critical, 2
  moderate em `uuid<11.1.1`, nos caminhos v3/v5/v6 com `buf`. O exceljs só usa `v4()`,
  então esse vetor não se aplica. Fica registrado, sem `overrides`, para não forçar uma
  major de transitiva sem necessidade. SC-003 só cobre high/critical.

**Alternatives considered**:

- SheetJS pelo CDN (opção a do PENDENCIAS §1): rejeitada pelo responsável em Q1.
- `write-excel-file` / `xlsx-populate`: menos mantidas, sem vantagem sobre o exceljs para
  o caso (só escrita, poucas abas).

**Consequência de governança**: a constituição (Stack e Convenções Técnicas) e o
`DESIGN.md` §16/§19 citam `xlsx (SheetJS)`. A troca exige emenda PATCH da constituição
(troca de pacote dentro da mesma capacidade, sem mudança de princípio) via
`/speckit-constitution` e atualização das duas tabelas do DESIGN.md. Ver Constitution
Check no `plan.md`.

---

## D2. Fechar a rota pública de cadastro por senha (Q2)

**Decision**: Adicionar `disabledPaths: ['/sign-up/email']` às opções compartilhadas do
better-auth (`src/shared/auth/opcoes.ts`). **Não** usar `emailAndPassword.disableSignUp`.

**Rationale** (verificado no código-fonte do better-auth 1.6.26):

- `disabledPaths` é checado só em `router.onRequest` (`dist/api/index.mjs`): devolve
  `404 Not Found` para requisições HTTP ao caminho. Chamadas diretas
  `auth.api.signUpEmail(...)` no servidor não passam pelo router e **continuam
  funcionando**. É exatamente o que a gestão de usuários usa
  (`autenticacao-service.ts → criarConta`).
- `emailAndPassword.disableSignUp` é checado **dentro do handler** (`dist/api/routes/sign-up.mjs:144`)
  e bloquearia também a chamada do `/admin`. Isso quebraria FR-011.
- `emailAndPassword.enabled` continua `true`: o **login** por senha (`/sign-in/email`)
  segue necessário.
- Como `opcoesAuth` é compartilhado entre `auth.ts` e `auth-proxy.ts`, as duas instâncias
  ficam coerentes.

**Alternatives considered**:

- Criar a conta no `/admin` via `ctx.internalAdapter` (como `definirSenha` já faz) e
  ligar `disableSignUp`: funciona, mas duplica o fluxo de criação (hash, `account` com
  `providerId='credential'`, hooks de criação) que hoje o `signUpEmail` faz por nós.
  Mais código e mais risco, sem ganho.
- Bloquear no `proxy.ts`: o matcher do proxy exclui `api/auth` de propósito. Abrir uma
  exceção ali mistura responsabilidades.

**Teste**: integração. `POST /api/auth/sign-up/email` responde 404 e não cria linha em
`user`. `CriarUsuarioUseCase` continua criando conta com senha utilizável (o teste
`criar-usuario.integracao.test.ts` já existe e deve continuar verde).

---

## D3. Botões de login social só com credencial completa (item 7)

**Decision**: Criar `src/shared/auth/provedores-sociais.ts` com uma função pura
`provedoresSociaisConfigurados(env)`. Ela devolve `('google' | 'facebook')[]`, só com os
provedores que têm **ID e segredo** não vazios. A função é usada em dois lugares:

1. `opcoes.ts`: registra em `socialProviders` só os provedores configurados, para não
   expor um endpoint OAuth que falharia de qualquer jeito.
2. `app/(publico)/login/page.tsx` (Server Component): passa `provedores` como prop para
   `<LoginForm provedores={...} />`.

No `LoginForm`, cada botão só aparece se o provedor estiver na lista. O divisor "ou" e o
aviso "Ao entrar com Google ou Facebook…" só aparecem com ao menos um provedor, e o aviso
cita só os provedores presentes. Sem nenhum provedor, a tela abre direto no modo
`'credenciais'`.

**Rationale**: as variáveis de ambiente não chegam ao cliente (não são `NEXT_PUBLIC_`), e
não devem chegar. O Server Component lê o ambiente e passa só a lista de nomes. Testável
como função pura.

**Alternatives considered**: variáveis `NEXT_PUBLIC_*_HABILITADO` foram rejeitadas: seriam
uma segunda fonte de verdade, que pode divergir das credenciais reais.

**Fora de escopo**: o texto da página de candidatura que menciona "Google ou Facebook" é
informativo e só aparece para quem já está autenticado. Fica como está.

---

## D4. Mínimo de segurança por item (Q3)

**Decision**:

- Coluna nova `item.estoque_minimo numeric(14,3) NULL`, com o mesmo tipo `quantidade()`
  das demais quantidades. Migration gerada por `drizzle-kit generate` (`0005_*`).
- Regra pura em `src/modules/estoque/domain/estoque-minimo.ts`:
  `limiarDoItem(minimoItem: number | null, limiarGlobal: number): number | null`. Devolve
  `null` (alerta desligado) quando `minimoItem === 0`, `minimoItem` quando definido, e
  `limiarGlobal` quando `null`. Também `itensCriticos(itens, limiarGlobal)`, que filtra com
  `saldo <= limiar`. É o mesmo operador de hoje: "atingiu o mínimo" inclui a igualdade.
  O mesmo arquivo tem `validarEstoqueMinimo(valor): string | null` (mensagem de erro em
  pt-BR ou `null`), usado pela Entrada **e** pela edição, para as duas regras nunca
  divergirem.
- Limiar global: `src/shared/config/limiares-alerta.ts`, que lê os três `ALERTA_*` do
  ambiente (`limiarCadastrosPendentes`, `limiarEstoqueMinimoGlobal`,
  `limiarDeficitPercentual`). Fica em `shared` porque é configuração transversal, lida por
  `notificacoes/application` (alerta) e por `app/(staff)/estoque` (exibir "Padrão (N)").
  Colocá-la em `estoque/infrastructure` faria `notificacoes/application` depender de
  infraestrutura de outro módulo, o que viola o Princípio I (análise C1).
- `inventarioParaExportacao()` passa a selecionar `estoqueMinimo`, e
  `avaliarEstoqueCritico` usa `itensCriticos`. A mensagem passa a citar o mínimo de cada
  item, em vez de um número global: "Arroz (mín. 20 kg) atingiu o estoque mínimo de segurança".
- Cadastro: na Entrada, quando o item é **novo** (`novoItem`), aparece o campo opcional
  "Estoque mínimo". Ele vai em `novoItem.estoqueMinimo`, é validado em `validarEntrada` com
  `validarEstoqueMinimo` e é gravado no mesmo `INSERT` do item, dentro da transação da
  entrada já auditada. Para item existente, o campo não aparece: a mudança é feita pela
  tabela.
- Edição: ação "Definir estoque mínimo" por linha na tabela de `/estoque`, abrindo um
  dialog/drawer com campo numérico opcional. Server Action `definirEstoqueMinimo` →
  caso de uso `DefinirEstoqueMinimoUseCase` → `EstoqueRepository.definirEstoqueMinimo`,
  envolvida em `withAudit` (escrita em Estoque, Princípio V). Depois da escrita,
  `agendarAlertasDeEstoque({ estoqueCritico: true })`, porque baixar ou subir um mínimo
  pode criar ou encerrar a condição.
- Permissão (decidida na análise, I1): `ROLES_OPERACAO`, ou seja `membro_defesa_civil`,
  `coordenador` e `administrador`. São os mesmos papéis que registram Entrada e Saída e que
  já acessam `/estoque`. Valem tanto na Entrada quanto na edição. A checagem fica na Server
  Action. A rota `/estoque` não muda de roles.

**Rationale**: o item não tem tela própria de edição. Os itens nascem na Entrada, pelo
autocomplete com dedup. Por isso o mínimo pode ser informado ali, no nascimento, e
ajustado depois na tabela de estoque, onde a operação já olha o saldo. O fallback global preserva o comportamento atual para todo
item existente: a migration não faz backfill, todos ficam `NULL` e usam o global.

**Alternatives considered**:

- Só na tabela, ou só coordenação: a primeira versão do plano previa isso. Foi revista na
  análise (I1): quem cadastra o item na ponta é o `membro_defesa_civil`, e ele conhece o
  item melhor no momento do cadastro.
- Tabela separada `item_estoque_minimo`: normalização sem ganho, porque o atributo é 1:1
  com o item.
- `NOT NULL DEFAULT 5`: perderia a distinção entre "herda o global" e "definido como 5", e
  mudar o global por variável deixaria de afetar os itens.

---

## D5. Vulnerabilidades novas de dependência (achado)

`npm audit --omit=dev` (lockfile atual):

| Pacote        | Severidade | Faixa afetada                       | Correção                                |
| ------------- | ---------- | ----------------------------------- | --------------------------------------- |
| `next`        | critical   | 16.0.0 – 16.3.5 (RCE só em Windows) | `16.3.8`, patch, mesma minor            |
| `sharp`       | high       | < 0.35.4                            | `0.35.5`, dentro de `^0.35.3`           |
| `xlsx`        | high       | \*                                  | sai com D1                              |
| `better-auth` | moderate   | 1.4.7-beta.2 – 1.7.0-rc.6           | `npm audit fix` dentro da faixa         |
| `vitest`      | moderate   | 2.1.0 – 4.1.10                      | `npm audit fix` dentro da faixa         |
| `drizzle-kit` | moderate   | (via `@esbuild-kit/*`)              | só com downgrade major: **não** aplicar |

**Decision**: fixar `next` e `eslint-config-next` em `16.3.8` (os dois andam juntos) e
atualizar `sharp` para `^0.35.5`. Rodar `npm audit fix` **sem** `--force` para as
moderadas dentro da faixa. Aceitar e registrar as moderadas do `drizzle-kit` (ferramenta
de dev, sem caminho em runtime). O critério de aceite é lint + `tsc --noEmit` +
`npm test` + `next build` verdes. Se o build quebrar com o patch do Next, a atualização
volta e o item fica registrado (FR-017).

**Achado colateral (bloqueia CI)**: `package-lock.json` está **fora de sincronia** com o
`package.json`. `npm ci` falha com `Missing: esbuild@0.28.2 from lock file`. A primeira
task de dependências regenera o lockfile com `npm install` e confirma que `npm ci` passa.

---

## D6. Itens sem código: destino de cada um

| Item | Destino                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 3    | Roteiro operacional, passo "Administrador de produção" + conferir que nenhuma conta `@teste.local` existe em produção.                |
| 4    | Verificação manual (quickstart V5). Marca ID-06 no `spec/TASKS.md`.                                                                   |
| 5    | Registro em `DESIGN.md` §19 ("Campo data/hora: formato do navegador; reavaliar com relato de campo"). Sai do PENDENCIAS.              |
| 6    | Roteiro operacional, passo "E-mail transacional (Resend)".                                                                            |
| 7    | Código (D3) + roteiro, passo "Aplicações OAuth".                                                                                      |
| 8    | Código (D4). Os três defaults continuam provisórios no PENDENCIAS, agora só aguardando os valores da Defesa Civil (passo do roteiro). |
| 9    | Registro em §19 ("Gestão de usuários: `/admin`, feature 006"). Sai do PENDENCIAS.                                                     |
| 10   | Roteiro operacional, passo "Usuário restrito do Atlas".                                                                               |
| 11   | Nova seção "Desenvolvimento local" no `README.md` (que hoje é o boilerplate do template). Sai do PENDENCIAS.                          |
| 12   | Sai do PENDENCIAS (já coberto por teste).                                                                                             |
| 13   | Roteiro operacional, passos "Variáveis na Vercel" e "Cron em produção".                                                               |
| 14   | Verificação manual (quickstart V6). Marca DEPLOY-06.                                                                                  |

**Roteiro operacional**: novo `spec/ROTEIRO_PRODUCAO.md`, ao lado das demais specs de
projeto, em ordem de dependência: variáveis → admin → OAuth → e-mail → Atlas → cron →
limiares. Cada passo tem **Pré-requisito / Ação / Onde / Como verificar** (FR-018).
