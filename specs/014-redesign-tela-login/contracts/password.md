# Contrato: componente `Password`

**Feature**: `014-redesign-tela-login` | **Arquivo**: `src/shared/ui/password/password.tsx`
**Cobre**: FR-029 a FR-037 | **Base**: `@ark-ui/react` → `PasswordInput`

Componente de design system, não da tela de login. A tela é apenas seu primeiro consumidor.

---

## API pública

```ts
export interface PasswordProps {
    /** Id do controle. Vira o `htmlFor` do rótulo e a âncora do `aria-describedby`. */
    id: string
    label: string
    /** Texto de apoio abaixo do controle. Suprimido quando há erro (§4.2.1). */
    apoio?: string
    erro?: string
    obrigatorio?: boolean
    size?: TamanhoControle
    /**
     * `current-password` para autenticar, `new-password` para criar ou redefinir.
     * Sem padrão implícito — quem usa declara, porque errar aqui faz o gerenciador
     * de senha sugerir a coisa errada.
     */
    autoComplete: 'current-password' | 'new-password'
    name?: string
    onChange?: ChangeEventHandler<HTMLInputElement>
    onBlur?: FocusEventHandler<HTMLInputElement>
    placeholder?: string
    disabled?: boolean
    /** React 19: `ref` é prop comum — necessário para o `register` do RHF. */
    ref?: Ref<HTMLInputElement>
}
```

A forma espelha `InputProps` de propósito: trocar `<Input type="password" …>` por
`<Password …>` deve ser uma edição mecânica, sem repensar o call site.

**Deliberadamente ausente**: `type` (é sempre senha), `vemDaConta` (campo de senha nunca vem
preenchido pela conta), `value`/`defaultValue` (a máquina do Ark é não controlada — ver D7).

## Uso esperado

```tsx
// Autenticar — app/(publico)/login/login-form.tsx
<Password
    id="senha"
    label="Senha"
    autoComplete="current-password"
    obrigatorio
    erro={errors.senha?.message}
    {...register('senha')}
/>
```

`register()` devolve `ref`, `name`, `onChange` e `onBlur` — todos previstos na API acima e
repassados à parte `Input` do Ark.

## Anatomia

```text
Campo                          moldura compartilhada: <label htmlFor={id}>, faixa apoio/erro
└── PasswordInput.Root         máquina do Ark; ids={{ input: id }}, required, invalid
    └── PasswordInput.Control  a caixa visual: borda, altura, fundo, anel de foco
        ├── PasswordInput.Input              o <input>; transparente, sem borda própria
        └── PasswordInput.VisibilityTrigger  botão 44×44 à direita, ícone Eye/EyeOff
```

`PasswordInput.Label` **não** é usada: quem renderiza o rótulo é o `Campo`, como em todos os
outros campos do design system (D7).

## Comportamento herdado do Ark

Verificado em `@zag-js/password-input`. Não reimplementar:

| Comportamento | Requisito |
| --- | --- |
| `type` alterna entre `password` e `text` sem tocar no valor | FR-034 |
| `type="button"` no gatilho — não submete o formulário | FR-033 (metade) |
| `aria-controls` e `aria-expanded` no gatilho | FR-032 |
| `translations.visibilityTrigger: (visible) => string` para o `aria-label` | FR-032 |
| Sem `defaultVisible` ⇒ inicia oculto | FR-031 |
| Não aplica atributos de _opt-out_ de gerenciador de senha | FR-035 |
| `data-state="visible" \| "hidden"` nas partes, para estilo | — |

## Sobrescritas obrigatórias

### 1. Acessibilidade por teclado do gatilho — **corrige a biblioteca**

O Ark emite `tabIndex: -1` no gatilho e **nenhum manipulador de teclado**. Como vem, o botão é
inalcançável e inoperável por teclado, o que viola a FR-033 e a DESIGN_SYSTEM.md §6.

O componente **MUST**:

- passar `tabIndex={0}` à parte `VisibilityTrigger`;
- adicionar `onKeyDown` que aciona a alternância em `Enter` e `Espaço`, com `preventDefault()`
  no `Espaço` para não rolar a página;
- aplicar `ANEL_FOCO` ao gatilho.

**Usar `onKeyDown`, nunca `onClick`.** O Zag chama `preventDefault()` no `pointerdown`, o que
impede o foco mas **não** impede o `click` subsequente: um `onClick` adicional alternaria a
visibilidade duas vezes no clique de mouse, devolvendo-a ao estado inicial. Ponteiro é
responsabilidade do Zag; teclado é nossa.

### 2. Rótulo acessível em pt-BR

```ts
translations={{ visibilityTrigger: (visivel) => (visivel ? 'Ocultar senha' : 'Mostrar senha') }}
```

O rótulo descreve a **ação disponível**, não o estado atual (FR-032). Sem isto o `aria-label`
sai `undefined` e o botão é anunciado como "botão", sem propósito.

### 3. `aria-describedby`

O Ark não o emite. Calcular com `idsCampo(id, Boolean(erro), Boolean(apoio))` e passar na parte
`Input`, exatamente como o `Input` atual faz. As props do consumidor são mescladas sobre as da
máquina.

### 4. `ids={{ input: id }}` no `Root`

Sem isto o Ark gera um id próprio, e o `htmlFor` do `Campo` aponta para um elemento
inexistente — o rótulo deixa de funcionar para clique e para leitor de tela.

## Estilo

Reaproveita as constantes existentes; nenhum valor visual novo (FR-005, SC-009).

| Parte | Classes |
| --- | --- |
| `Control` | `CLASSES_CONTROLE_TEXTO` + `bordaControle(temErro)` + `ALTURA_POR_TAMANHO[size]`, como `flex items-center`, com `pr-0` e `focus-within:` para o anel |
| `Input` | ocupa o espaço restante; fundo transparente, sem borda, sem anel próprio |
| `VisibilityTrigger` | `size-11` (44×44, §1.3), ícone de 20px (§1.8), `ANEL_FOCO`, hover `surface-muted` |

**Deslocamento do anel de foco**: hoje o anel é desenhado no `<input>`. Aqui a caixa visual é o
`Control`, então o anel vai para ele via `focus-within`. O gatilho mantém anel próprio, porque
é um alvo de foco distinto.

**Sem sobreposição** (FR-036): o gatilho é irmão do input dentro de um flex, não posicionado por
cima. O texto digitado nunca passa por baixo dele — não por padding calculado, mas porque não
compartilham espaço.

## Ícones

`Eye` (oculto → oferece mostrar) e `EyeOff` (visível → oferece ocultar), de `lucide-react`,
20px, `aria-hidden`. O significado é carregado pelo `aria-label`; o ícone é decorativo.

## Invariantes verificáveis

1. Monta sempre oculto, inclusive ao remontar (voltar de `'credenciais'` para `'opcoes'` e
   retornar).
2. Alternar não altera valor nem posição do cursor.
3. Acionar o gatilho por teclado não submete o formulário.
4. Rótulo, marcação de obrigatório, faixa de erro e substituição apoio→erro idênticos aos do
   `Input` (§4.2.1).
5. Gerenciadores de senha reconhecem o campo e o preenchem.
6. Contraste AA nos dois temas, incluindo o estado de erro.
7. Nenhum texto em inglês fixo no componente.

## Fora do escopo

Medidor de força de senha, requisitos de composição, botão de gerar senha, revelação temporária
com auto-ocultamento. São features próprias.

## Consumidores

| Arquivo | Campos | Nesta feature? |
| --- | --- | --- |
| `app/(publico)/login/login-form.tsx` | 1 (`current-password`) | **Sim** — FR-037 |
| `app/(publico)/cadastro/cadastro-form.tsx` | 2 (`new-password`) | Não — ver D12 |
| `app/(interno)/(staff)/admin/usuario-form-dialog.tsx` | 2 (`new-password`) | Não — ver D12 |

O componente entra também em `app/(interno)/design-system/galeria.tsx`, a galeria de validação
em claro/escuro exigida pela DESIGN_SYSTEM.md §7.
