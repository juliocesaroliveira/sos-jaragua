# Phase 0 — Research: Criptografia, Mascaramento e Exclusão de Dados Sensíveis

**Feature**: `024-criptografia-dados-sensiveis` | **Data**: 2026-10-31

Todas as decisões abaixo foram tomadas contra o código real do repositório e a documentação do Next
16.3.8 instalado (`node_modules/next/dist/docs/`), conforme exige `AGENTS.md`.

> **Nota de ambiente — resolvida**: `npm ci` falhava por dessincronia pré-existente entre
> `package.json` e `package-lock.json` (`Missing: esbuild@0.28.2 from lock file`), bloqueando CI e
> `npm test`. Corrigido em commit próprio com `npm install` (só o lockfile mudou; `package.json`
> intacto). Verificado: `npm ci` conclui com exit 0 e `npm test` passa 549 testes em 47 arquivos.

---

## D1 — Algoritmo de criptografia: AES-256-GCM via `node:crypto`

**Decisão**: AES-256-GCM, IV aleatório de 12 bytes por valor, tag de autenticação de 16 bytes.
Envelope textual versionado: `v1.<iv>.<ciphertext>.<tag>` em base64url.

**Rationale**: `node:crypto` é embutido — nenhuma dependência nova, o que satisfaz o Princípio VI e
evita o tipo de adição que a Constituição exige justificar. GCM é AEAD: detecta alteração do
ciphertext, o que sustenta FR-014 (falha de leitura explícita em vez de lixo silencioso). O prefixo de
versão permite trocar algoritmo ou chave no futuro sem ambiguidade sobre como ler o valor antigo.

**Alternativas rejeitadas**:
- **AES-256-CBC + HMAC separado**: mais peças para errar; GCM já autentica.
- **Biblioteca externa** (`libsodium`, `@noble/ciphers`): dependência nova sem ganho sobre o que o
  runtime já oferece — contraria o Princípio VI.
- **Criptografia nativa do provedor (Neon)**: é exatamente o que a Constituição tinha hoje e o que o
  pedido quer superar; não protege contra dump autorizado nem contra vazamento de backup legível.

---

## D2 — Unicidade e busca por CPF: blind index com HMAC

**Decisão**: duas colunas para o CPF. `cpf` guarda o ciphertext **aleatorizado** (não pesquisável) e
uma nova coluna `cpf_indice` guarda `HMAC-SHA256(subchave_indice, cpf_normalizado)` em base64url, com
o índice único migrado para ela.

**Rationale**: FR-005 exige preservar unicidade e `buscarPorCpf`. Com GCM aleatorizado, o mesmo CPF
gera ciphertexts diferentes — índice único e igualdade deixariam de funcionar. O blind index resolve
os dois com uma comparação de igualdade comum, sem decifrar nada.

O HMAC **com chave secreta** é essencial, não um detalhe: um CPF tem 11 dígitos, ou seja ~10¹¹
possibilidades. Um `SHA-256` simples do CPF seria quebrado por força bruta em segundos — o atacante
que tem o dump teria a tabela inteira de volta. Com HMAC, quem não tem a chave não consegue montar o
dicionário.

**Alternativas rejeitadas**:
- **Criptografia determinística** (AES-SIV, ou GCM com IV derivado do plaintext): funcionaria, mas
  entrega igualdade no próprio ciphertext e amarra rotação de chave e algoritmo. O blind index separa
  as responsabilidades: o valor é confidencial, o índice é pesquisável.
- **Hash sem chave** (SHA-256 puro): inseguro pelo espaço pequeno do CPF, como acima.
- **Unicidade só na aplicação**: a Constituição já rejeitou esse caminho para habilidade
  (017, INV-01) — a checagem na aplicação perde a corrida entre duas escritas simultâneas.

---

## D3 — Derivação de subchaves: HKDF-SHA256

**Decisão**: a variável de ambiente guarda **uma** chave mestra (32 bytes, base64). Dela derivam-se
por HKDF-SHA256 duas subchaves de propósito distinto: `info='sos:cripto:campo:v1'` para cifrar e
`info='sos:indice:cpf:v1'` para o blind index.

**Rationale**: reaproveitar a mesma chave para cifrar e para o HMAC é um erro clássico de uso de
primitivas. Separar por HKDF custa uma linha e atende ao pedido do responsável de "a chave definida
via variável de ambiente" — continua sendo uma variável, uma chave para operar.

---

## D4 — Onde mascarar: valor mascarado dentro do cache, revelação fora dele

**Esta é a decisão arquitetural central da feature.**

**Decisão**: as funções de leitura hoje marcadas com `'use cache'` passam a devolver **apenas a forma
mascarada**, independente de quem pergunta. A revelação do valor completo é um caminho separado, sem
cache, em Server Action que lê a sessão, confere a Matriz de Visibilidade, decifra e audita.

**Rationale**: a doc do Next 16 instalado (`01-app/03-api-reference/01-directives/use-cache.md` e
`use-cache-private.md`) é explícita — dentro de `'use cache'`, `cookies()` e `headers()` **não** são
permitidos. E `DESIGN.md` §7 já fixa a regra do projeto: "Dados derivados de sessão
(`cookies()`/`headers()`): **Nunca**" cacheados. Logo, mascarar por role *dentro* de
`listarCandidaturasPendentes` (que é `'use cache'` com tag `voluntariado:pendentes`) é impossível — e
se fosse possível por outro caminho, a entrada de cache de um `coordenador` serviria a um
`membro_defesa_civil`.

A consequência é uma propriedade de segurança que vale declarar: **nenhum dado sensível em texto plano
entra em cache algum** — nem no cache de servidor, nem na memória do navegador.

**Alternativas rejeitadas**:
- **Converter as queries para `'use cache: private'`**: a doc diz que esse modo *não* guarda no cache
  de servidor entre requisições e que o resultado alimenta o Client Cache do navegador. Perderíamos o
  cache compartilhado que `DESIGN.md` §7 escolheu de propósito para a fila de triagem, e colocaríamos
  dado pessoal completo na memória do browser. Pior nos dois eixos.
- **Mascarar no componente de UI**: cada tela nova teria de lembrar de aplicar a máscara — exatamente
  o que FR-012 proíbe. E o valor completo chegaria ao cliente, contornável pelo payload (a spec exige
  mascaramento no servidor).

---

## D5 — Mascarar exige decifrar: sem coluna de "prévia" em texto plano

**Decisão**: o caminho mascarado decifra o valor e aplica a máscara em memória, no servidor. Não há
coluna auxiliar guardando os dígitos visíveis.

**Rationale**: guardar `12` e `01` do CPF em texto plano ao lado do ciphertext pouparia a decifragem,
mas colocaria 4 dos 11 dígitos de volta no banco em claro — enfraquecendo justamente o que a feature
busca. O custo evitado é irrelevante: AES-GCM decifra na casa de microssegundos, e três campos em uma
página de 50 linhas somam muito menos de 1 ms contra uma meta de 300 ms dominada pelo ida-e-volta ao
Postgres (SC-006).

**Verificação feita**: nenhuma query do repositório ordena ou filtra por `cpf`, `cep` ou
`dataNascimento` — conferido em `queries/*.ts` de voluntariado e identidade. Portanto cifrar essas
colunas **não** custa nenhuma capacidade de consulta além da igualdade por CPF, já coberta por D2.

---

## D6 — Data de nascimento: cifrar inteira, ano visível só na máscara

**Decisão**: a data inteira é cifrada. O ano aparece porque a máscara o expõe (`••/••/1990`) depois de
decifrar, não porque fique guardado em claro.

**Rationale**: Q1 classificou como sensíveis o dia e o mês, não o ano. Cifrar o campo inteiro e expor
o ano na máscara é mais simples que fatiar a coluna em duas, e não deixa nada em claro.

**Achado que corrige a spec**: a spec previu em SC-009 que "os relatórios que usam faixa etária
continuam produzindo os mesmos resultados". **Não existe hoje nenhum relatório por faixa etária ou
idade** no repositório — conferido nas definições de contingência e nas queries de relatórios. SC-009
é, portanto, vacuamente verdadeiro, e nenhuma coluna `ano_nascimento` em texto plano é necessária. Se
um relatório assim surgir e precisar agregar por ano no SQL, aí será o momento de adicioná-la.

**Consequência de tipo**: `voluntario_perfil.dataNascimento` e `user.dataNascimento` deixam de ser
`date` e passam a `text` (ciphertext). O domínio já trabalha com string `'YYYY-MM-DD'`
(`ehMaiorDeIdade`), e o `DatePicker` compartilhado já fala esse formato — então a mudança não
atravessa o domínio. Atenção a `user.dataNascimento` ser um `additionalField` do better-auth: o tipo
exposto pela sessão muda de data para string.

---

## D7 — Exclusão: anonimizar no lugar, nunca `DELETE`

**Decisão**: a exclusão do titular é um `UPDATE` que sobrescreve os campos pessoais e marca
`anonimizado_em`. A linha de `user` e a de `voluntario_perfil` **permanecem**. São removidas apenas as
linhas de `session` e `account` (sessões e vínculos de login).

**Rationale** — a análise das chaves estrangeiras não deixa alternativa:

| Referência a `user.id` | `onDelete` | Efeito de um `DELETE` |
| ---------------------- | ---------- | --------------------- |
| `alocacao.participanteUserId` | `cascade` | **Destruiria o histórico de participação em turnos** — viola FR-024 em silêncio |
| `alocacao.alocadoPor` | não declarado | O `DELETE` **falha** para quem já alocou alguém |
| `atividade.criadoPor` | não declarado | O `DELETE` **falha** para quem já criou atividade |
| `entrada`/`saida`/`descarte` (registrado por) | não declarado | O `DELETE` **falha** para quem já movimentou estoque |
| `voluntarioPerfil.userId` | `cascade` | Levaria o perfil, e com ele `alocacao.voluntarioPerfilId` (`cascade`) |

Ou seja: apagar fisicamente **falharia** para qualquer pessoa com histórico operacional e, quando
passasse, **apagaria o histórico de turnos**. A anonimização no lugar é a única rota que atende FR-022
e FR-024 ao mesmo tempo — o que confirma, por evidência de código, a escolha do responsável em Q4.

**Implicações de schema**:
- As colunas sensíveis e pessoais precisam aceitar nulo para poderem ser esvaziadas (hoje
  `cpf`, `telefone`, `cep` etc. são `notNull`).
- `cpf_indice` vai a nulo: o índice único do Postgres admite múltiplos nulos, então vários titulares
  anonimizados coexistem sem colisão.
- `user.email` é `notNull unique`: recebe um valor neutro e irrepetível, não nulo, para que a conta
  não seja reativável e não bloqueie um futuro cadastro independente da mesma pessoa.
- `user.ativo` passa a `false`.

---

## D8 — Redação da auditoria: um único ponto de passagem

**Decisão**: a redação dos campos sensíveis acontece dentro de `withAudit`, imediatamente antes de
`registrarAuditoria`, por uma lista declarada de campos por tabela. Mais um script de remediação única
para os documentos já gravados no Mongo (FR-027).

**Rationale**: `withAudit` (`src/modules/auditoria/index.ts`) é o único caminho de escrita da trilha —
a própria Constituição (Princípio V) proíbe logs ad-hoc. Redigir ali cobre todos os casos de uso
presentes e futuros sem que cada um precise lembrar, que é o mesmo raciocínio de FR-012 para a
apresentação.

**Achado**: `withAudit` grava `dadosAnteriores`/`dadosNovos` como o snapshot inteiro do registro. É a
origem do problema que FR-026 e FR-027 tratam — sem isso, cifrar o Postgres deixaria a trilha no Mongo
como cópia legível dos mesmos dados.

**Achado — o vocabulário da auditoria não cobre os eventos novos**: `AcaoAuditada` é
`'create' | 'update' | 'delete'`, e `ACOES_AUDITADAS`/`ROTULO_ACAO_AUDITADA`
(`modules/auditoria/presentation/queries/trilha.ts`) alimentam o filtro da tela de trilha. Uma
**revelação** é uma leitura, e uma **anonimização** não é nenhum dos três. FR-017 e FR-024 exigem
portanto estender o tipo com `'read'` e `'anonimizar'`, incluindo rótulo pt-BR e opção de filtro.

---

## D9 — Validação da chave no boot: `instrumentation.ts` + defesa em profundidade

**Decisão**: `instrumentation.ts` na raiz exporta `register()`, que valida presença e formato da chave
e lança se estiver ausente ou malformada. O módulo de cripto revalida na primeira utilização.

**Rationale**: a doc do Next instalado
(`01-app/03-api-reference/03-file-conventions/instrumentation.md`) diz que `register` é chamado **uma
vez** por instância do servidor e **precisa concluir antes de o servidor atender requisições** — é
exatamente a semântica que FR-003 pede. A segunda checagem no módulo é a mesma lógica de defesa em
profundidade que o Princípio IV já aplica em `proxy.ts` + `layout.tsx`: não confiar em uma única
camada. Hoje o projeto não tem `instrumentation.ts` — é arquivo novo.

**Nome da variável**: `DADOS_SENSIVEIS_CHAVE`, seguindo o estilo pt-BR já usado em `ALERTA_*`.
Gerada com `openssl rand -base64 32`, como `BETTER_AUTH_SECRET` já documenta em `.env.example`.

---

## D10 — Onde o código mora, dentro do Princípio I

**Decisão**:
- `src/shared/cripto/` — cifrar, decifrar, blind index, validação da chave. Infraestrutura
  transversal, no mesmo nível de `src/shared/db/` e `src/shared/auth/`, que são o precedente do
  repositório.
- `src/shared/mascara/` — funções **puras** de máscara. Sem import de Next, Drizzle ou Mongo; testável
  em milissegundos, como o Princípio III exige do que concentra regra.
- A classificação dos campos sensíveis e a Matriz de Visibilidade viram **dados declarados** em um
  único módulo, consumido pela apresentação e pela redação de auditoria — uma fonte de verdade para
  FR-012, FR-015 e FR-026.

**Rationale**: o `domain/` não pode importar infraestrutura (Princípio I), então a cripto não mora
nele. A máscara é regra pura e vai para um módulo próprio para poder ser testada sem banco.

---

## D11 — Performance

AES-GCM decifra na casa de microssegundos por valor. Três campos × 50 linhas ≈ bem abaixo de 1 ms,
contra uma meta de 300 ms (SC-006) dominada pela latência do Neon. O blind index é uma igualdade sobre
coluna indexada: mesma classe de custo do índice único de hoje. Nenhuma query perde índice, por D5.

---

## D12 — Área de conta do titular

**Decisão**: nova rota `app/(interno)/conta/`, fora de `(staff)`.

**Rationale**: o Princípio IV registra que "rotas ausentes do mapa só exigem sessão válida (qualquer
role)" — é precisamente o que a área de conta precisa, já que qualquer pessoa autenticada acessa a
sua. Ficar fora de `(staff)` também evita adicionar entrada na matriz de roles para uma tela que não é
de operação. A página lê a sessão, logo **nunca** é cacheada (`DESIGN.md` §7), o que combina com
exibir o valor completo ao titular sem passar por cache.
