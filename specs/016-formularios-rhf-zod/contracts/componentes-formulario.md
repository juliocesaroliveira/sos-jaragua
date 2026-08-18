# Contrato: API do padrão de formulários

**Feature**: `specs/016-formularios-rhf-zod`

Interfaces que esta feature expõe para quem constrói telas. São o contrato que a US4 ("um
formulário novo já nasce no padrão") cobra: enquanto uma tela usar estas três peças, FR-001 a
FR-016 são atendidos sem decisão adicional.

---

## 1. `useFormulario` — `src/shared/formulario/use-formulario.ts`

```ts
export function useFormulario<T extends FieldValues>(
    esquema: ZodType<T>,
    opcoes?: { defaultValues?: DefaultValues<T> }
): UseFormReturn<T>
```

Envelope fino sobre `useForm`. Fixa a configuração do padrão e devolve o retorno do
react-hook-form **sem alterá-lo** — `register`, `control`, `handleSubmit`, `formState`,
`setError`, `clearErrors` e `reset` continuam disponíveis com o comportamento original.

| Configuração fixada | Valor        | Requisito |
| ------------------- | ------------ | --------- |
| `resolver`          | `zodResolver(esquema)` | TC-002 |
| `mode`              | `'onSubmit'` | FR-001    |
| `reValidateMode`    | `'onChange'` | FR-007    |
| `shouldFocusError`  | `true`       | FR-011    |

**Não** é permitido a uma tela sobrescrever `mode`, `reValidateMode` ou `resolver` — é o que
torna o comportamento uniforme entre formulários. Precisando divergir, a divergência vira
decisão documentada (Princípio VI), não um parâmetro a mais.

---

## 2. `Formulario` — `src/shared/ui/formulario/formulario.tsx`

```tsx
export interface FormularioProps
    extends Omit<FormHTMLAttributes<HTMLFormElement>, 'noValidate' | 'action'> {
    onSubmit: FormEventHandler<HTMLFormElement>
    children: ReactNode
}

export function Formulario(props: FormularioProps): ReactElement
```

Renderiza `<form noValidate>`. `noValidate` é omitido da interface de propósito: não é
configurável, é o requisito FR-003/TC-003 tornado estrutural. `action` também sai — a
submissão do padrão é a chamada tipada da Server Action dentro do `onSubmit` (research D1).

**Regra de uso**: nenhum `<form>` cru na aplicação. Verificação: buscar por `<form` fora de
`src/shared/ui/formulario/` deve não retornar nada. A regra ESLint opcional
(`no-restricted-syntax`) transforma essa busca em erro de lint.

**Uso típico**:

```tsx
<Formulario id="usuario-form" onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4">
```

---

## 3. `aplicarErrosDoServidor` — `src/shared/formulario/erros-servidor.ts`

```ts
export function aplicarErrosDoServidor(params: {
    erro: DomainErrorPlano
    camposConhecidos: readonly string[]
    definirErro: (campo: string, mensagem: string) => void
}): { mensagemGeral: string | null }
```

Função **pura** (o efeito entra por `definirErro`, normalmente `setError` do react-hook-form),
o que a torna testável em ambiente `node` sem DOM.

**Comportamento** (FR-012):

| Entrada                                                    | Efeito                                     | Retorno                        |
| ---------------------------------------------------------- | ------------------------------------------ | ------------------------------ |
| `detalhes.campos` com chaves ∈ `camposConhecidos`          | `definirErro` por campo                    | `{ mensagemGeral: null }`      |
| `detalhes.campos` com chave ∉ `camposConhecidos`           | Campos conhecidos aplicados; desconhecidos agregados | `{ mensagemGeral: '<mensagem do erro> <mensagens órfãs>' }` |
| Sem `detalhes.campos`                                       | Nenhum `definirErro`                       | `{ mensagemGeral: erro.mensagem }` |

**Invariante**: nenhuma mensagem vinda do servidor é descartada. Um campo que o formulário não
conhece produziria, se ignorado, um envio recusado sem explicação alguma na tela.

**Fonte dos campos**: `camposComErro` de `src/shared/kernel/action.ts`, que já lê
`erro.detalhes.campos` do `ResultadoAction`. Este contrato não altera o formato das Server
Actions.

---

## 4. Contrato de campo (todo controle de `src/shared/ui/`)

Props comuns — a tabela completa e o estado atual por componente estão em
[`../data-model.md`](../data-model.md) §5.

Garantias que todo controle **deve** cumprir depois desta feature:

1. `erro` presente ⇒ parágrafo com `role="alert"` imediatamente abaixo do controle, em
   `text-sm text-danger-600 dark:text-danger-400` (FR-004, FR-005).
2. `erro` presente ⇒ `aria-invalid` no controle e `aria-describedby` apontando o parágrafo do
   erro; o id do apoio sai do `aria-describedby` (FR-009) — regra centralizada em `idsCampo`.
3. `erro` presente ⇒ apoio deixa de ser renderizado; a faixa não empilha, o campo não muda de
   altura (FR-010).
4. `erro` presente ⇒ borda em `border-danger-500` (FR-009).
5. `ref` encaminhado ao elemento focável, para o foco no primeiro erro (FR-011).
6. `obrigatorio` ⇒ asterisco `aria-hidden` + " (obrigatório)" `sr-only` (US2/AC3) — a marcação
   de obrigatório não depende do atributo nativo `required`.

Itens 1–4 já são entregues pela moldura `Campo` para os controles que a usam; `RadioGroup`,
`CheckboxGroup` e `Switch` são as exceções a alinhar (research D6/D7).
