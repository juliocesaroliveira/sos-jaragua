# Phase 1 — Data Model: Padrão único de validação de formulários

**Feature**: `specs/016-formularios-rhf-zod` | **Data**: 2026-08-17

Feature de apresentação: **não há tabela, migração ou mudança de esquema de banco**. As
"entidades" abaixo são estruturas em memória, no cliente, durante a vida de um formulário.
Elas correspondem às Key Entities da spec.

---

## 1. Esquema de validação do formulário

Objeto Zod declarado uma vez por formulário, no topo do módulo da tela. Fonte única de verdade
da validação no cliente (FR-002).

| Aspecto           | Definição                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Tipo              | `z.ZodObject` — tipo do formulário derivado por `z.infer<typeof esquema>`                                          |
| Escopo            | Um por formulário; variantes por modo (ex.: criar vs. editar) são derivadas por `.extend()`, não reescritas        |
| Mensagens         | Todas em pt-BR, declaradas no esquema — nunca no JSX                                                               |
| Regras suportadas | Obrigatoriedade, formato, faixa, tamanho, condicional (`.superRefine`/`.check` com `path` no campo dependente)     |
| Fallback          | `z.config(pt())` de `src/shared/validacao/zod-ptbr.ts` cobre o que não tiver mensagem própria                      |

**Invariante**: campo declarado no esquema tem mensagem em pt-BR para toda regra que possa
falhar — inclusive o caso `undefined` (controle nunca tocado), que não passa pelo `.min()` e
cairia na mensagem do locale. O construtor `textoObrigatorio()` de `campos.ts` já encapsula
isso (`z.string({ error }).min(1, error)`).

**Construtores compartilhados** (`src/shared/formulario/campos.ts`), extraídos do que já está
duplicado entre telas:

| Construtor                    | Regra                    | Mensagem padrão                          |
| ----------------------------- | ------------------------ | ---------------------------------------- |
| `textoObrigatorio(mensagem)`  | string não vazia         | fornecida pelo chamador                  |
| `email()`                     | formato de e-mail        | `Informe um e-mail válido.`              |
| `senha()`                     | mínimo de 8 caracteres   | `A senha deve ter ao menos 8 caracteres.` |
| `selecaoObrigatoria(valores, mensagem)` | enum dentro da lista | fornecida pelo chamador          |
| `listaNaoVazia(mensagem)`     | array com ≥ 1 item       | fornecida pelo chamador                  |

Regras de **domínio** (dígito verificador de CPF, maioridade) não entram aqui — o cliente
valida forma, o `domain/` do servidor continua sendo a autoridade (research D10, Princípio I).

---

## 2. Estado do formulário (`useFormulario`)

Instância de `useForm` do react-hook-form com configuração fixada pelo wrapper compartilhado.

| Campo                 | Valor                          | Requisito             |
| --------------------- | ------------------------------ | --------------------- |
| `mode`                | `'onSubmit'`                   | FR-001                |
| `reValidateMode`      | `'onChange'`                   | FR-007                |
| `shouldFocusError`    | `true`                         | FR-011                |
| `resolver`            | `zodResolver(esquema)`         | TC-002                |
| `defaultValues`       | por formulário                 | FR-016                |

Estados derivados consumidos pela interface:

| Estado                    | Origem                    | Uso                                              |
| ------------------------- | ------------------------- | ------------------------------------------------ |
| `formState.errors`        | resolver + `setError`     | Mensagem abaixo de cada campo (FR-004)           |
| `formState.isSubmitting`  | react-hook-form           | `loading` no botão → `disabled` (FR-013)         |
| `formState.isSubmitted`   | react-hook-form           | Só após ele a revalidação `onChange` age (FR-007) |

**Ciclo de vida (FR-016)**: ao abrir/reabrir um formulário em diálogo, `reset(valoresIniciais)`
zera valores **e** erros. É o comportamento que `usuario-form-dialog.tsx` já implementa no
`useEffect` de abertura e que passa a ser regra do padrão.

---

## 3. Estado de erro do campo

Associação `nome do campo → mensagem` mantida em `formState.errors`. Tem duas origens, e o
componente de campo **não distingue** entre elas — a apresentação é idêntica (FR-012).

| Origem              | Como entra                                    | Quando sai                                          |
| ------------------- | --------------------------------------------- | --------------------------------------------------- |
| Validação local     | resolver Zod no submit                        | Revalidação `onChange` quando o valor fica válido   |
| Recusa do servidor  | `setError(campo, { message })`                | Primeira alteração do campo (`reValidateMode`)      |
| Condicional desligada | —                                           | `clearErrors(campoDependente)` ao mudar a condição (research D8) |

**Contrato de renderização** (já implementado por `Campo`/`idsCampo`, ver
`contracts/componentes-formulario.md`): a mensagem ocupa a mesma faixa do texto de apoio, com
`role="alert"`, `aria-invalid` no controle e `aria-describedby` apontando o parágrafo do erro —
com o id do apoio removido enquanto o erro existe.

---

## 4. Erro geral do formulário

Mensagem não atribuível a nenhum campo. Produzida por `aplicarErrosDoServidor` a partir do
`DomainErrorPlano` devolvido pela Server Action.

| Situação                                        | Destino                                                    |
| ----------------------------------------------- | ---------------------------------------------------------- |
| Servidor devolveu `detalhes.campos` conhecidos  | Cada mensagem vai ao seu campo; nenhum erro geral obrigatório |
| Servidor devolveu campo **desconhecido** pelo formulário | Mensagem entra no erro geral — nunca é descartada (research D5) |
| Erro sem `detalhes.campos` (rede, indisponibilidade, credencial inválida) | Erro geral                        |

Exibição: `Alert tom="danger"` no topo do formulário e/ou toast `avisar.erro`, conforme já
praticado nas telas. O helper devolve a mensagem; a tela decide onde mostrar.

**Caso deliberado de erro geral**: login com credenciais incorretas permanece mensagem genérica
("E-mail ou senha incorretos.") e **não** é fixada no campo de e-mail — apontar o campo revelaria
se a conta existe (FR-012, segundo ramo).

---

## 5. Contrato de campo (props comuns a todo controle)

| Prop          | Tipo       | Papel                                                         |
| ------------- | ---------- | ------------------------------------------------------------- |
| `id`          | `string`   | Liga rótulo, controle, apoio e erro                            |
| `label`       | `string`   | Rótulo visível (ou `sr-only` via `rotuloOculto`)               |
| `obrigatorio` | `boolean`  | Asterisco + " (obrigatório)" para leitor de tela (FR-002/US2-AC3) |
| `apoio`       | `string?`  | Dica na faixa de mensagem, suprimida enquanto há erro           |
| `erro`        | `string?`  | Mensagem exibida abaixo do controle (FR-004)                   |
| `ref`         | `Ref?`     | Alvo do foco no primeiro erro (FR-011, research D4)            |

Estado atual por componente (`src/shared/ui/`) e a lacuna a fechar:

| Componente      | `erro` | Faixa via `Campo` | `apoio` | `ref` p/ foco | Ação                          |
| --------------- | ------ | ----------------- | ------- | ------------- | ----------------------------- |
| `Input`         | ✅     | ✅                | ✅      | ✅ (register) | —                             |
| `Textarea`      | ✅     | ✅                | ✅      | ✅ (register) | —                             |
| `Password`      | ✅     | ✅                | ✅      | ✅ (register) | —                             |
| `NumberInput`   | ✅     | ✅                | ✅      | ❌            | adicionar `ref`               |
| `Select`        | ✅     | ✅                | ✅      | ❌            | adicionar `ref`               |
| `Combobox`      | ✅     | ✅                | ✅      | ❌            | adicionar `ref`               |
| `DatePicker`    | ✅     | ✅                | ✅      | ❌            | adicionar `ref`               |
| `RadioGroup`    | ✅     | ❌ (markup próprio) | ❌    | ❌            | migrar faixa + `apoio` + `ref` |
| `CheckboxGroup` | ✅     | ❌ (markup próprio) | ❌    | ❌            | migrar faixa + `apoio` + `ref` |
| `Switch`        | ❌     | ❌                | ✅      | ❌            | adicionar `erro` + `ref`      |

---

## 6. Inventário dos formulários existentes (alvo de FR-017)

> **Correção de 2026-08-17** — a primeira versão desta seção listava **três** formulários e
> estava errada. O levantamento buscou por `onSubmit` e `<form>`, o que encontra o *formato*
> de um formulário e não o seu *comportamento*: toda tela que coleta campos e submete por
> `onClick` de um botão — que é como o módulo de Estoque inteiro foi construído — ficou
> invisível para a busca. O critério correto é "coleta campos e submete", não "tem `<form>`".

### Já em conformidade

| Formulário                                                    | Observação                                              |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| `app/(publico)/login/login-form.tsx`                           | migrado; erro de credencial segue geral, por segurança  |
| `app/(interno)/voluntariado/candidatura/candidatura-form.tsx`  | migrado; condicional de `tipoVeiculo` agora no esquema  |
| `app/(interno)/(staff)/admin/usuario-form-dialog.tsx`          | migrado; era o que estava sem `noValidate`              |
| `app/(interno)/(staff)/estoque/entrada/entrada-form.tsx`       | migrado                                                 |

### Migrados na correção de escopo

Todos seguiam o mesmo desenho: `useState` por campo + `useTransition`, sem `<form>`, sem
esquema Zod, **sem validação alguma no cliente** — o primeiro retorno ao operador vinha do
servidor, depois do round-trip.

| Tela                                                          | Regra de cliente que passou a existir                          |
| ------------------------------------------------------------- | -------------------------------------------------------------- |
| `estoque/entrada/entrada-form.tsx`                             | quantidade > 0; validade obrigatória e não retroativa           |
| `estoque/saida/saida-form.tsx`                                 | item e quantidade **por linha**; destino e responsável          |
| `estoque/descarte/descarte-form.tsx`                           | item; quantidade > 0 e **não maior que o saldo**                |
| `estoque/kits/gestao-kits.tsx`                                 | nome; ≥1 componente; item sem repetição na receita              |
| `atividades/gestao-atividades.tsx`                             | título, categoria, local, início; turnos 1–12; vagas ≥ 1        |
| `convocacao/convocacao-form.tsx`                               | título e mensagem (antes: botão apenas `disabled`)              |
| `crise/gestao-crise.tsx`                                       | contagens obrigatórias e inteiras; proporção quando há base     |
| `cadastros-pendentes/fila-triagem.tsx`                         | motivo da rejeição, mínimo de 5 caracteres                      |

`app/(interno)/design-system/galeria.tsx` é vitrine de componentes, não formulário de
operação — fora de escopo.

### Defeitos encontrados durante a migração

Não eram "falta de validação" apenas — em três telas o comportamento antigo produzia dado
errado em silêncio:

- **`crise/gestao-crise.tsx`**: campo vazio virava `Number('') === 0` e era gravado. O painel
  passaria a dizer "0 famílias afetadas" porque alguém não preencheu, sem nada na tela
  indicando isso.
- **`estoque/kits/gestao-kits.tsx`**: linhas de receita incompletas eram **descartadas
  silenciosamente** no `filter` antes do envio; um kit podia ser salvo sem receita nenhuma
  sem uma única mensagem.
- **`estoque/saida/saida-form.tsx`**: mesmo `filter` silencioso nas linhas, e o único aviso
  possível era um alerta genérico acima da lista, não a linha com problema.

Fora de escopo (Assumption da spec): controles de filtro/busca/paginação de listagens, que não
submetem dados.
