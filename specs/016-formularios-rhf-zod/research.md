# Phase 0 — Research: Padrão único de validação de formulários

**Feature**: `specs/016-formularios-rhf-zod` | **Data**: 2026-08-17

Todo NEEDS CLARIFICATION do Technical Context foi resolvido aqui. Cada decisão nasceu da
leitura do código existente (três formulários, dez controles de campo, `src/shared/kernel`,
`src/shared/validacao`) e das restrições TC-001..TC-003 da spec.

---

## D1 — Server Action por chamada tipada, não por `<form action={...}>`

**Decision**: manter a submissão via `handleSubmit(...)` do react-hook-form chamando a Server
Action como função tipada (`await submeterCandidatura({...})`), com retorno
`ResultadoAction<T>`. Não migrar para `<form action={serverAction}>` + `useActionState`.

**Rationale**: a spec exige react-hook-form como autoridade de validação no cliente (TC-001) e
mensagem de erro por campo antes de qualquer ida ao servidor (FR-001/FR-006). O caminho
`<form action>` do Next entrega `FormData` e só produz erros depois do round-trip — os dois
modelos são alternativas, não camadas. Além disso, todas as actions do projeto já expõem
contrato tipado (`ResultadoAction<T>` em `src/shared/kernel/action.ts`) e os três formulários
existentes já operam assim; trocar o mecanismo seria uma refatoração de escopo maior que a
feature, sem ganho para o usuário.

**Consequência registrada**: isto diverge do guia `node_modules/next/dist/docs/01-app/
02-guides/forms.md`, que apresenta `<form action={serverAction}>` como o caminho padrão. A
divergência é deliberada e está amarrada às restrições mandatórias da spec; a validação de
servidor dentro da action permanece obrigatória e inalterada (Princípio IV).

**Alternatives considered**:

- `<form action>` + `useActionState`: descartado — erro por campo só após round-trip;
  incompatível com TC-001 sem duplicar validação.
- Híbrido (`action` no form + RHF para validação): descartado — duas fontes de submissão no
  mesmo elemento, comportamento de `noValidate`/foco imprevisível.

---

## D2 — Momento da validação: `onSubmit` + revalidação `onChange`

**Decision**: configuração única e centralizada — `mode: 'onSubmit'`,
`reValidateMode: 'onChange'`, `shouldFocusError: true`. São os padrões do react-hook-form,
mas passam a ser **explícitos** no wrapper compartilhado para virarem contrato, não default
herdado.

**Rationale**: atende FR-001 (bloqueio no envio), FR-007 (mensagem some ao corrigir, sem novo
envio) e FR-011 (foco no primeiro erro) sem punir quem ainda está preenchendo — validar
`onChange` desde o primeiro caractere marcaria "e-mail inválido" enquanto a pessoa digita a
primeira letra. Explicitar no wrapper impede que um formulário futuro escolha outro modo em
silêncio.

**Alternatives considered**: `mode: 'onBlur'` — descartado, em telas de campo com toque o blur
é acidental (rolagem, teclado virtual) e produziria erro em campo intocado; `mode: 'onChange'`
— descartado pelo motivo acima.

---

## D3 — Um componente `<Formulario>` que sempre aplica `noValidate`

**Decision**: criar `src/shared/ui/formulario/formulario.tsx` exportando `Formulario`, um
`<form>` que **sempre** define `noValidate` e recebe `onSubmit` já embrulhado. Toda tela passa
a usá-lo; `<form>` cru deixa de existir na aplicação.

**Rationale**: TC-003/FR-003 é um requisito de "nunca esquecer" — e é exatamente o tipo de
requisito que se perde em revisão manual. Hoje o repositório já prova isso: `login-form.tsx` e
`candidatura-form.tsx` têm `noValidate`, `usuario-form-dialog.tsx` não. Centralizar torna a
conformidade estrutural (impossível esquecer) em vez de disciplinar, e dá a US4/AC2 o critério
objetivo que ela pede: "existe `<form>` fora do componente compartilhado?" é uma busca, não um
julgamento.

**Reforço opcional**: regra ESLint `no-restricted-syntax` proibindo `JSXOpeningElement[name.name='form']`
fora de `src/shared/ui/formulario/`. Barato e transforma a convenção em erro de lint.

**Alternatives considered**: documentar a regra e confiar na revisão — descartado, é o estado
atual e já falhou uma vez em três formulários.

---

## D4 — Foco no primeiro erro: `ref` nos controles Ark

**Decision**: manter `shouldFocusError: true` (cobre os campos via `register()`, que já
recebem `ref`) e **adicionar suporte a `ref`** nos wrappers usados via `Controller`
(`Select`, `Combobox`, `DatePicker`, `NumberInput`, `RadioGroup`, `CheckboxGroup`, `Switch`,
`Password`), encaminhando ao elemento focável do controle. Nos formulários, passar
`ref={field.ref}` no `render` do `Controller`.

**Rationale**: sem `ref`, o react-hook-form não tem o que focar e FR-011 falha silenciosamente
justamente nos campos mais difíceis de achar na tela (seleção, data, grupos). Verificado no
código instalado: os primitivos `@ark-ui/react` v5 usam `forwardRef` em todas as partes
(`node_modules/@ark-ui/react/dist/components/select/select-trigger.js` e correlatos), então o
encaminhamento chega a um nó DOM real. Em React 19 o `ref` é uma prop comum — não exige
`forwardRef` nos nossos wrappers.

**Alternatives considered**:

- `document.getElementById(primeiroCampo)?.focus()` no `onError` do `handleSubmit`: descartado
  — depende de `id` do controle ser sempre igual ao nome do campo, o que hoje é verdade por
  coincidência e quebraria em silêncio no primeiro formulário que divergir.
- Deixar sem foco em campos `Controller`: descartado — viola FR-011 e SC-005.

---

## D5 — Erros do servidor: helper único em cima do contrato que já existe

**Decision**: criar `aplicarErrosDoServidor` em `src/shared/formulario/`, uma função **pura**
que recebe o `DomainErrorPlano`, a lista de campos conhecidos do formulário e um `setError`
injetado, e devolve `{ mensagemGeral }`. Ela reaproveita `camposComErro`
(`src/shared/kernel/action.ts`), que já lê `erro.detalhes.campos`.

**Rationale**: o laço `for (const [campo, mensagem] of Object.entries(campos)) setError(...)`
está hoje copiado em `candidatura-form.tsx` e `usuario-form-dialog.tsx`, com tratamentos
divergentes do erro geral (um deles tem um ternário que retorna o mesmo valor nos dois ramos).
Um helper único cumpre FR-012 de forma uniforme e — por ser pura e receber `setError` por
parâmetro — é testável com Vitest em ambiente `node`, sem DOM e sem nova dependência
(Princípio III/VI).

**Regra de campo desconhecido**: mensagem cujo campo não existe no formulário **não** é
descartada em silêncio — vira parte da mensagem geral. Descartar produziria a falha pior
possível: envio recusado sem nenhuma explicação na tela.

**Alternatives considered**: `setError('root', ...)` do RHF para o erro geral — descartado por
ora, os formulários já exibem o erro geral por `Alert`/toast e trocar isso ampliaria o escopo
sem ganho visível; o helper devolve a mensagem e cada tela decide onde exibi-la.

---

## D6 — `Switch` ganha estado de erro

**Decision**: adicionar `erro?: string` ao `Switch`, exibido abaixo da linha do controle com
`role="alert"` e o mesmo `text-sm text-danger-*` dos demais, mais `aria-invalid` no input
oculto. Atualizar a "Exceção" do `DESIGN_SYSTEM.md` §4.2.1, que hoje afirma que o `Switch` não
tem estado de erro.

**Rationale**: FR-008 exige que **todo** controle suporte mensagem na mesma posição e formato.
A exceção documentada foi escrita quando nenhum booleano era obrigatório; um "aceite os
termos" ou um booleano condicional obrigatório recriaria o problema, e o formulário ficaria
sem como dizer o que está errado.

**Alternatives considered**: manter a exceção e proibir booleano obrigatório — descartado,
seria uma regra de negócio inventada para acomodar uma limitação de componente.

---

## D7 — `RadioGroup`/`CheckboxGroup` passam a usar a moldura `Campo`

**Decision**: reescrever a faixa de mensagem dos dois grupos para reutilizar `idsCampo` e o
mesmo bloco de erro/apoio dos demais controles, com `apoio` suportado e `aria-invalid` no
grupo. Rótulo permanece `Ark.Label`/`<legend>` (semântica de grupo), mas a faixa de mensagem
abaixo passa a ser idêntica.

**Rationale**: hoje esses dois renderizam o erro por conta própria — sem `apoio`, sem
`aria-invalid`, sem a regra de exclusão apoio↔erro. Isso viola FR-008 (mesmo formato), FR-009
(estado inválido para leitor de tela) e FR-010 (faixa reservada, sem deslocamento). Como já
duplicam o markup, a correção reduz código em vez de acrescentar.

**Alternatives considered**: envolver o grupo inteiro no `Campo` — descartado, o `Campo`
emite `<label htmlFor>`, que é errado para um grupo de opções (o alvo do rótulo não é um
controle único); só a faixa de mensagem é compartilhada.

---

## D8 — Obrigatoriedade condicional expressa no esquema, não só na renderização

**Decision**: regras condicionais vão para o esquema Zod via `.superRefine()`/`.check()`, com
`path` apontando o campo dependente. Caso concreto: `tipoVeiculo` obrigatório quando
`veiculoProprio === true` em `candidatura-form.tsx`.

**Rationale**: hoje o campo só é **exibido** condicionalmente; o esquema o mantém `optional()`,
então a mensagem "Selecione o tipo de veículo." nunca é produzida no cliente — ela só chega
depois de o servidor recusar. FR-014 pede a regra no cliente, e o esquema é o lugar onde
FR-002 mandou que as regras morem.

**Cuidado de implementação**: ao desligar o booleano, o erro do campo dependente precisa ser
limpo — o campo sai da tela e uma mensagem órfã bloquearia o envio sem nada visível. Resolvido
com `clearErrors('tipoVeiculo')` no `onCheckedChange`, coberto por cenário do quickstart.

**Alternatives considered**: validar a condicional apenas no domínio do servidor — descartado,
é o comportamento atual e viola FR-014.

---

## D9 — Testes: unidades puras + roteiro manual de UI

**Decision**: testes automatizados (Vitest, ambiente `node`) cobrem apenas o que é puro —
`aplicarErrosDoServidor` e os esquemas Zod compartilhados. O comportamento de interface (foco,
ausência de balão nativo, posição da mensagem) é verificado pelo roteiro de `quickstart.md`.

**Rationale**: `vitest.config.ts` está fixado em `environment: 'node'` e
`include: ['src/**/*.test.ts']` — não há jsdom nem testing-library no projeto. Introduzi-los
para esta feature acrescentaria três dependências e um segundo ambiente de teste, o que o
Princípio VI trata como complexidade sem valor comprovado no porte atual. Os esquemas e o
mapeamento de erro — onde mora a lógica de verdade — continuam cobertos por teste rápido.

**Consequência**: SC-001 e SC-003 são verificados manualmente em dois navegadores, com
roteiro escrito. Isso está explícito no quickstart, não implícito.

**Alternatives considered**: adicionar jsdom + @testing-library/react — não descartado para
sempre; registrado como decisão a reavaliar quando houver mais formulários (estoque,
atividades) e o custo do roteiro manual superar o da dependência.

---

## D10 — Reaproveitamento de esquema cliente/servidor: caso a caso, sem camada nova

**Decision**: extrair para `src/shared/formulario/campos.ts` apenas os construtores de campo
repetidos entre formulários (`textoObrigatorio(mensagem)`, e-mail, senha mínima). Regras de
domínio (dígito verificador de CPF, maioridade) **não** migram para o cliente: permanecem no
`domain/`, e o cliente valida forma.

**Rationale**: o helper `obrigatorio()` já existe duplicado dentro de `candidatura-form.tsx` e
as mensagens de senha ("A senha deve ter ao menos 8 caracteres." vs. "A senha precisa ter ao
menos 8 caracteres.") já divergiram entre dois formulários — exatamente o que a Assumption de
reaproveitamento da spec quer evitar. Já mover a validação de domínio para o cliente violaria
o Princípio I (`domain` puro, cliente não é autoridade) sem ganho real, já que o servidor
revalida de qualquer forma.

**Alternatives considered**: um esquema único por entidade compartilhado entre cliente e
domínio — descartado, arrastaria `domain/` para dentro do bundle do cliente e inverteria a
direção de dependência do Princípio I.
