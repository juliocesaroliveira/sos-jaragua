# Fase 0 — Pesquisa e decisões: Tooltip em ações de ícone

Toda afirmação sobre o comportamento do primitivo abaixo foi verificada no pacote **instalado**
(`node_modules/@zag-js/tooltip/dist/tooltip.connect.js` e `tooltip.types.d.ts`, sob
`@ark-ui/react` 5.38.1), não na documentação pública — a versão instalada é o que vai rodar.

---

## D1 — O componente já existe; a feature é adoção, não criação

**Decisão**: evoluir `src/shared/ui/tooltip/tooltip.tsx`, mantendo nome, arquivo e assinatura
atual (`conteudo`, `children`, `posicao`, `atrasoMs`). Nenhum componente novo.

**Rationale**: o `Tooltip` já existe sobre o Ark, já é exportado pelo barril e já é usado em
produção na navegação lateral recolhida. Recriá-lo quebraria os dois pontos de uso existentes sem
entregar nada. O que falta é endurecimento pontual (D3, D4, D5) e adoção ampla (D8).

**Alternativas**: reimplementar do zero — rejeitada, custo sem ganho; adotar outra biblioteca —
rejeitada, contraria a stack fixada na constituição e o Princípio VI.

---

## D2 — Metade dos requisitos já é comportamento padrão do primitivo

**Decisão**: **não escrever código** para os requisitos abaixo. Eles já são atendidos pelo Ark/zag
ou por infraestrutura que o projeto já tem. O papel desta feature quanto a eles é **verificar**, no
roteiro de validação, não implementar.

| Requisito | Já atendido por | Evidência no pacote instalado |
| --- | --- | --- |
| FR-002 (Esc dispensa) | `closeOnEscape` | `TooltipProps.closeOnEscape` — `@default true` |
| FR-002 (foco de teclado) | `onFocus` do trigger | `if (!isFocusVisible()) return` — abre no foco de teclado e **não** no clique de mouse, que é exatamente o desejado |
| FR-003 (atraso) | `openDelay` | já passado como `atrasoMs = 300` |
| FR-004 (reposicionar) | popper do Ark | `positioning` com flip padrão |
| FR-005 (acima de diálogo) | `CLASSE_FLUTUANTE` + `Portal` | `cn.ts`: camada flutuante = 60, diálogo = 50; já aplicado no `Positioner` |
| US4 / FR-011 (toque) | trigger do zag | `onPointerMove` e `onPointerOver` fazem `if (event.pointerType === "touch") return` — em toque o tooltip **nunca** abre, sem precisar detectar dispositivo |
| Edge case: rolagem | `closeOnScroll` | `@default true` — o rótulo é dispensado ao rolar, nunca fica flutuando sobre lugar vazio |
| Edge case: trava visível após clique | `closeOnPointerDown` / `closeOnClick` | ambos `@default true` |

**Rationale**: registrar isto explicitamente evita que a implementação reescreva à mão
comportamento que já vem pronto — e evita que a validação assuma que veio pronto sem conferir.

**Consequência de escopo**: sobram três lacunas reais (D3, D4, D5) mais a adoção. A feature é
consideravelmente menor do que a lista de FR sugere.

---

## D3 — Anúncio duplicado no leitor de tela (FR-010)

**Problema, com a causa exata**: o trigger recebe `"aria-describedby": open ? contentId : undefined`
e o content recebe `role="tooltip"`. Como o `IconButton` exige `aria-label`, e o texto do tooltip é
o mesmo rótulo, um leitor de tela ao focar o botão anuncia **nome + descrição com o mesmo texto** —
"Editar Maria Silva, Editar Maria Silva". Os dois pontos de uso atuais já têm esse defeito:
`sidebar-nav.tsx:116-120` passa a mesma string para `conteudo` e para `aria-label`.

**Decisão**: distinguir os dois papéis que um tooltip pode ter, com uma prop nova:

- **Repetição visual do nome acessível** (padrão, o caso da esmagadora maioria): a dica é
  puramente visual. Usa-se o prop `aria-label` do `Ark.Root`, que faz o zag **omitir `role="tooltip"`
  e o `id` do content** (`role: hasAriaLabel ? void 0 : "tooltip"`, `id: hasAriaLabel ? void 0 : contentId`).
  Sem id, o `aria-describedby` do trigger fica pendurado e é ignorado — nada é anunciado duas vezes.
- **Descrição que acrescenta informação** (prop `descricao`): o texto explica algo que o nome não
  diz — tipicamente o motivo de a ação estar indisponível (D4). Aí a exposição como descrição é
  desejada e o comportamento padrão do Ark é mantido.

**Rationale**: a regra fica no componente, não na cabeça de quem escreve cada tela. O padrão é o
caso seguro; quem quer o comportamento verboso precisa pedir.

**Alternativas**: (a) tirar o `aria-label` do botão e deixar o tooltip nomear — rejeitada, o
`IconButton` exige o rótulo por tipo e o botão ficaria anônimo justamente em toque, onde o tooltip
nunca abre; (b) aceitar a duplicação — rejeitada, falha SC-003.

**Risco residual aceito**: no modo padrão o `aria-describedby` aponta para um id inexistente.
Referência pendurada é ignorada por leitores de tela e não gera erro de validação — é o preço de
usar o modo que o próprio primitivo oferece, e é menor que o de reimplementar a fiação ARIA à mão.

---

## D4 — Tooltip em controle desabilitado (FR-006, US3)

**Problema, com a causa exata**: `<button disabled>` não dispara eventos de ponteiro nem recebe
foco — é regra do navegador, anterior a qualquer biblioteca. Nenhum `openDelay` resolve. Dois
pontos de uso já dependem disso: `saida-form.tsx:161` (`disabled={linhas.length === 1}`) e
`gestao-kits.tsx:275` (`disabled={receita.length === 1}`) — exatamente os botões cuja indisponibilidade
mais precisa de explicação.

**Decisão**: acrescentar ao `IconButton` um estado **`inativo`**, distinto do `disabled` nativo:
aparência esmaecida idêntica, `aria-disabled="true"`, o elemento **permanece focável e sensível ao
ponteiro**, e o `onClick` é curto-circuitado dentro do componente. Usa-se `inativo` apenas onde há
um tooltip explicando o motivo; `disabled` nativo continua o padrão em todo o resto.

**Rationale**: é o padrão recomendado para controle indisponível que precisa ser descoberto — um
botão que some da ordem de foco não pode explicar nada a quem navega por teclado. Manter as duas
formas evita uma migração ampla e arriscada de todos os `disabled` da base.

**Alternativas**: (a) envolver o botão desabilitado num `<span tabIndex={0}>` — rejeitada, cria uma
parada de foco sem papel semântico, que o leitor de tela anuncia como nada; (b) trocar `disabled`
por `aria-disabled` em toda a base — rejeitada, mudança ampla sem necessidade comprovada
(Princípio VI).

**Cuidado obrigatório na implementação**: o clique precisa ser bloqueado no componente, porque
`aria-disabled` não bloqueia nada — é só informação para tecnologia assistiva.

**Fora deste tratamento**: `loading`. O botão em carregamento continua com `disabled` nativo — é
estado transitório de segundos, não uma condição que o usuário precise entender.

---

## D5 — Largura e quebra do rótulo (FR-007)

**Decisão**: limitar a largura do content e permitir quebra em várias linhas, com o limite também
preso à largura da janela para não estourar em celular.

**Rationale**: sem limite, "Remover João Pedro de Souza Albuquerque do turno" vira uma faixa que
atravessa a tela. O limite pela janela evita o caso em que a largura fixa já é maior que o
dispositivo.

---

## D6 — Movimento reduzido (FR-008): decisão de não escrever

**Decisão**: **não adicionar animação** de entrada/saída ao tooltip.

**Rationale**: o componente hoje aparece e some sem transição. Sem animação, FR-008 é atendido por
construção e não há nada a condicionar em `prefers-reduced-motion`. Acrescentar uma animação para
depois desligá-la sob preferência do usuário seria trabalho criado por conta própria. O projeto já
tem o bloco global de movimento reduzido em `app/globals.css:300` caso isso mude no futuro.

---

## D7 — Estilo e temporização permanecem como estão

**Decisão**: manter fundo escuro sólido, texto branco, `atrasoMs = 300` e fechamento em 100 ms.

**Rationale**: FR-009 (contraste) já é atendido — branco sobre `neutral-900`/`neutral-700` supera
com folga o mínimo do padrão nos dois temas. Esta feature não redefine linguagem visual (assumption
do spec).

---

## D8 — Escopo da adoção e ordem

**Decisão**: os oito grupos de FR-014, nesta ordem — primeiro o design system, depois as telas:

1. `tooltip.tsx` (D3, D5) e `icon-button.tsx` (D4) — habilitam todo o resto.
2. `sidebar-nav.tsx` — **corrige** os dois usos existentes, que hoje duplicam o anúncio (D3).
3. `topbar.tsx` (abrir navegação, sair), `theme-toggle.tsx`, `sino-notificacoes.tsx` — presentes em
   toda tela interna; entregam a US1 de uma vez em todo o sistema.
4. `tabela-usuarios.tsx` (editar por linha) e `painel-escala.tsx` (alocar, remover do turno) — o
   caso do FR-015, em que o texto nomeia o registro.
5. `saida-form.tsx` e `gestao-kits.tsx` — os dois casos de `inativo` com explicação (US3).
6. `galeria.tsx` — vitrine (US5).

**Fora do escopo**, conforme assumption do spec: controles internos dos primitivos (fechar
diálogo/gaveta/aviso, setas de paginação, incremento/decremento numérico, meses do calendário).

**Também fora**: `ThemeToggle` e o botão de recolher da navegação não usam `IconButton` — são
`<button>` próprios. Não serão convertidos; o `Tooltip` funciona sobre qualquer elemento por
`asChild`, e converter seria mexer em componente que não precisa mudar.

---

## D9 — Redação dos textos

**Decisão**:

- Ação disponível: imperativo curto, igual ao `aria-label` já existente — sem inventar texto novo.
- Ação sobre registro: nomeia o registro, como o `aria-label` já faz ("Remover João Souza do turno").
- Ação indisponível: o texto **explica o motivo**, não repete o nome — é o único caso em que
  `descricao` se justifica. Ex.: "A saída precisa de ao menos uma linha".

**Rationale**: reaproveitar o `aria-label` existente mantém os dois canais coerentes de graça, e
deixa claro por que o caso indisponível é diferente: ali o tooltip realmente acrescenta informação.

---

## D10 — Estratégia de teste

**Decisão**: **nenhum teste automatizado novo**; validação pelo roteiro de `quickstart.md`.

**Rationale**: o Princípio III exige TDD em `domain/` e `application/` e dispensa cobertura
exaustiva em apresentação — e esta feature não tem nenhuma regra de negócio, entidade ou caso de
uso. O que haveria a testar (hover abre, foco de teclado abre, Esc dispensa, toque não abre, clique
em `inativo` não age) exige DOM renderizado, e o projeto **não tem** biblioteca de teste de
componente instalada (só Vitest, sem `@testing-library` nem `jsdom`). Adicioná-la para esta feature
seria dependência nova sem necessidade comprovada, contra o Princípio VI.

**Alternativa considerada**: introduzir `@testing-library/react` + `jsdom`. Rejeitada **para esta
feature** — a decisão merece ser tomada por mérito próprio, não como efeito colateral de um
tooltip. Fica registrada como candidata a decisão futura.

---

## Riscos residuais

| Risco | Probabilidade | Mitigação |
| --- | --- | --- |
| `aria-describedby` pendurado incomodar alguma auditoria automatizada de acessibilidade | Baixa | Documentado em D3; é o modo oficial do primitivo. Se aparecer, alternativa é fixar o id do content por prop. |
| `inativo` ser aplicado onde `disabled` bastaria, espalhando um estado focável sem motivo | Média | Regra explícita no contrato: `inativo` **só** com tooltip que explique o motivo. |
| Tooltip dentro de linha de tabela reposicionar de forma estranha ao rolar horizontalmente | Baixa | `closeOnScroll` dispensa a dica na rolagem; verificado no roteiro. |
| Texto do tooltip divergir do `aria-label` com o tempo | Média | Contrato exige que os dois saiam da **mesma expressão** no código, não de duas strings literais. |
