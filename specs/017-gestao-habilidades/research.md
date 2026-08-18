# Research: Gestão de Habilidades

**Feature**: 017-gestao-habilidades | **Data**: 2026-08-18

Decisões tomadas antes da implementação (Princípio VI — ambiguidade resolvida na spec/plano, não
implicitamente no código). Cada entrada segue: decisão, motivo, alternativas descartadas.

---

## D1 — Módulo dono da entidade Habilidade

**Decisão**: `src/modules/voluntariado/`.

**Motivo**: `habilidade` já está declarada em `db/schema/voluntariado.ts` e a única leitura existente
(`listarHabilidades`) mora em `src/modules/voluntariado/presentation/queries/lookups.ts`. A entidade é
referenciada por `voluntario_habilidade`, que é do mesmo módulo. Criar um módulo novo ("cadastros",
"lookups") daria dois donos para a mesma tabela e violaria o Princípio I (um módulo não acessa tabela
de outro).

**Alternativas descartadas**: módulo `identidade` (o vínculo é com `voluntario_perfil`, não com
`user`); módulo novo de cadastros básicos (complexidade sem valor, Princípio VI).

---

## D2 — Rota, gate de acesso e item de navegação

**Decisão**: rota `/habilidades` sob `app/(interno)/(staff)/habilidades/`, com entrada nova em
`REGRAS_DE_ROTA` (`{ prefixo: '/habilidades', roles: ['membro_defesa_civil', 'coordenador', 'administrador'] }`)
e item novo em `NAVEGACAO` no grupo `operacao`, usando a constante `STAFF` já existente.

**Motivo**: os três papéis pedidos pela spec são exatamente `STAFF` — o mesmo conjunto de
`/voluntarios`, `/atividades` e `/cadastros-pendentes`. Reusar a constante evita a divergência por
digitação que `navegacao.test.ts` (INV-01) trava. O gate segue em três camadas já estabelecidas:
`proxy.ts` → `(staff)/layout.tsx` → `exigirAcessoA('/habilidades')` na página, mais a revalidação
dentro de cada Server Action (Princípio IV — Server Actions não herdam o gate da página).

**Alternativas descartadas**: pendurar a tela sob `/admin` (restringiria a `administrador`, contrariando
FR-002); grupo de navegação novo só para ela (um grupo com um item só polui o menu).

---

## D3 — Unicidade de nome insensível a maiúsculas/minúsculas (FR-009, SC-004)

**Decisão**: migração que troca o `UNIQUE(nome)` atual por um **índice único funcional sobre
`lower(nome)`**, mais a checagem prévia na aplicação apenas para produzir a mensagem amigável.

**Motivo**: o `unique()` de hoje é sensível a caixa — "Motosserra" e "motosserra" coexistem, e FR-009
proíbe. Checar só na aplicação (`SELECT` antes do `INSERT`) perde a corrida de SC-004: duas requisições
simultâneas passam as duas pelo `SELECT` e as duas inserem. O índice único é a única garantia real;
a checagem prévia continua existindo para que o caso comum devolva "Já existe uma habilidade com esse
nome." em vez de um erro de banco. A violação do índice (código Postgres `23505`) é traduzida no
repositório para o mesmo erro de domínio, fechando a janela de corrida.

**Alternativas descartadas**: coluna `nome_normalizado` materializada (duplica dado que o índice
funcional já resolve); `citext` (extensão a mais no Neon, Princípio VI); confiar só na checagem prévia
(falha demonstrável em SC-004).

---

## D4 — Bloquear exclusão de habilidade vinculada (FR-012, SC-008)

**Decisão**: migração que troca `voluntario_habilidade.habilidade_id` de `ON DELETE CASCADE` para
`ON DELETE RESTRICT`, mais a contagem de vínculos no caso de uso para a mensagem amigável.

**Motivo**: hoje o banco apaga os vínculos em silêncio — a regra "não excluir vinculada" implementada
só em código seria contrariada pela própria cascata em qualquer caminho que não passe pelo caso de uso
(seed, script, migração futura). Com `RESTRICT`, o banco recusa; o caso de uso conta antes só para
dizer **quantos** voluntários bloqueiam a exclusão. Cobre também a corrida descrita na spec (vínculo
criado entre a leitura da tela e a confirmação): a checagem prévia pode passar, mas o `DELETE` falha e
o erro de FK (`23503`) é traduzido para o mesmo erro de domínio.

**Alternativas descartadas**: manter `CASCADE` e confiar na checagem da aplicação (contradiz SC-008 —
qualquer caminho alternativo apaga vínculos); soft delete com coluna `ativo` (rejeitado na spec, amplia
escopo e exige mexer em toda leitura de lookup).

---

## D5 — Contagem de voluntários vinculados na listagem (FR-013)

**Decisão**: a query paginada faz `LEFT JOIN voluntario_habilidade` com `count(...)` agrupado por
habilidade, em uma única consulta.

**Motivo**: uma consulta por linha (N+1) num rodapé de até 50 linhas é justamente o tipo de regressão
que o Fluxo de Desenvolvimento trata como defeito (<300ms em leitura). O `LEFT JOIN` mantém as
habilidades com zero vínculos na lista — que são exatamente as excluíveis, as mais relevantes na tela.
O índice `voluntario_habilidade_habilidade_idx` já existe e serve à agregação.

**Alternativas descartadas**: contador materializado na tabela `habilidade` (invalidação em toda
candidatura, complexidade desproporcional); buscar a contagem sob demanda ao abrir a confirmação
(esconde a informação justamente de quem está decidindo).

---

## D6 — Invalidação de cache

**Decisão**: tag nova `CACHE_TAGS.habilidadesListagem = 'habilidades:listagem'` para a listagem
paginada; **toda** escrita invalida essa tag **e** `CACHE_TAGS.lookups`.

**Motivo**: são dois consumidores com ciclos diferentes. A listagem desta tela é paginada e muda a cada
operação; `lookups` alimenta o formulário de candidatura e o filtro de alocação (FR-016) e hoje é
cacheado com vida média — sem invalidá-lo, uma habilidade recém-criada não apareceria na candidatura.
A raiz de `queryKey` (`RAIZ_HABILIDADES`) é derivada da tag pela convenção já existente em
`chaves.ts`, para que servidor e cliente não divirjam.

**Alternativas descartadas**: reusar só `lookups` (invalidaria também categorias de atividade a cada
escrita de habilidade, e não daria chave paginada distinta); não cachear a listagem (perde a hidratação
da primeira página, padrão de 007).

---

## D7 — Confirmação de exclusão (FR-011)

**Decisão**: um componente de confirmação **local à feature**
(`app/(interno)/(staff)/habilidades/excluir-habilidade-dialog.tsx`), montado sobre o `Dialog`
compartilhado já existente.

**Motivo**: não existe hoje um componente de confirmação compartilhado, e este é o primeiro caso
concreto. Generalizar a partir de um único uso costuma fixar a abstração errada; quando aparecer o
segundo, a extração para `src/shared/ui/` fica trivial e informada. O `Dialog` compartilhado já é
responsivo (folha em mobile, modal em desktop — decisão D3 de 006), então FR-018 sai de graça.

**Alternativas descartadas**: `window.confirm` (não é pt-BR controlável, não segue o tema, não passa
nos critérios de interface); criar `ConfirmDialog` compartilhado agora (abstração sobre uma amostra só).

---

## D8 — Onde mora a validação do nome

**Decisão**: três camadas com papéis distintos, sem duplicar a regra de negócio.

| Camada | Responsabilidade | Arquivo |
| --- | --- | --- |
| Formulário (cliente) | forma: obrigatório, 2–80 caracteres, mensagens pt-BR | `habilidade-form-dialog.tsx` via `textoObrigatorio` |
| Server Action | contrato de entrada (Zod), sessão/role | `presentation/actions/habilidades.ts` |
| Domínio | normalização (`normalizarNomeHabilidade`) e regra de tamanho, pura e testável | `domain/habilidade.ts` |

**Motivo**: espelha o que 016-formularios-rhf-zod fixou — o cliente dá retorno imediato, o servidor
decide, e a regra de negócio (normalização que define o que conta como duplicata) vive no `domain/`,
que é a autoridade (Princípio I). A normalização precisa ser pura porque é exatamente o que os testes
unitários vão exercer: `"  Motosserra   Elétrica "` → `"Motosserra Elétrica"`.

**Alternativas descartadas**: normalizar só no repositório (regra de negócio em `infrastructure/`,
contra o Princípio I); normalizar só no cliente (payload forjado escaparia).

---

## D9 — Estratégia de testes

**Decisão**:

- **Unitário** (`npm test`, obrigatório por TDD — Princípio III): `domain/habilidade.ts` (normalização,
  limites de tamanho) e os três casos de uso com repositório falso (criar duplicada, editar para nome
  de outra, excluir vinculada, excluir inexistente).
- **Integração** (`npm run test:integracao`): as duas garantias que só o banco real prova — o índice
  único sobre `lower(nome)` recusando a segunda inserção concorrente (SC-004) e o `RESTRICT` recusando
  a exclusão de habilidade vinculada (SC-008).
- **Interface**: roteiro manual em [quickstart.md](quickstart.md) — o projeto não tem jsdom/testing-library
  (decisão D9 de 016, mantida).

**Motivo**: a regra de negócio está nos casos de uso e no domínio; as duas invariantes de concorrência
não são demonstráveis com repositório falso, e são exatamente os critérios que a spec marcou como
verificáveis por teste.

---

## D10 — Reuso de infraestrutura existente (nada novo)

**Decisão**: a feature não adiciona nenhuma dependência e não cria nenhum padrão novo. Reusa:

| Necessidade | O que já existe |
| --- | --- |
| Tabela paginada + rodapé | `Table` + `useListagemPaginada` + `paginarComClamp` |
| Hidratação da 1ª página | `estadoHidratado` + `HydrationBoundary` (padrão de 007) |
| Formulário em diálogo | `Dialog` + `Formulario` + `useFormulario` + `textoObrigatorio` |
| Erro do servidor no campo | `aplicarErrosDoServidor` + `camposComErro` |
| Notificações de resultado | `avisar.sucesso` / `avisar.erro` |
| Contrato Server Action | `ResultadoAction<T>`, `serializar`, `erroAction` |
| Auditoria (FR-017) | `withAudit` + `comAtorDaSessao` |
| Gate de rota | `exigirAcessoA`, `REGRAS_DE_ROTA`, `NAVEGACAO` |

**Motivo**: a tela é estruturalmente a mesma de `/admin` (006 + 007 + 008), com um campo em vez de
quatro e uma ação a mais. Qualquer desvio desse conjunto seria um padrão novo sem justificativa
(Princípio VI).
