# Contrato — Módulo de Avisos

**Feature**: Migração do Toast para react-toastify

**Módulo**: `src/shared/ui/toast/toast.tsx`, reexportado por `src/shared/ui/index.ts`

**Natureza deste contrato**: é o contrato **interno** entre o design system e as 12 telas que o consomem. Não há interface externa (API HTTP, CLI) nesta feature. O valor de fixá-lo aqui é que ele é a garantia de FR-012 — se este contrato não mudar, nenhuma tela precisa mudar.

---

## Superfície pública

### Antes e depois

| Export    | Antes (Ark)                      | Depois (react-toastify)                | Impacto no chamador                                   |
| --------- | -------------------------------- | -------------------------------------- | ----------------------------------------------------- |
| `Toaster` | componente, sem props            | componente, sem props                  | nenhum                                                |
| `avisar`  | objeto com 4 métodos             | objeto com 4 métodos, mesma assinatura | nenhum                                                |
| `toaster` | instância `createToaster` do Ark | **removido**                           | nenhum — verificado: zero usos fora do próprio módulo |

**Regra central do contrato**: `Toaster` e `avisar` mantêm nome, caminho de import e assinatura. Qualquer alteração aqui quebra FR-012 e invalida SC-001.

---

### `avisar`

```ts
type Avisar = {
    sucesso: (titulo: string, descricao?: string) => void
    erro: (titulo: string, descricao?: string) => void
    atencao: (titulo: string, descricao?: string) => void
    info: (titulo: string, descricao?: string) => void
}
```

**Garantias**:

1. **Assinatura estável** — `titulo` obrigatório, `descricao` opcional. Nenhum parâmetro novo, nenhum objeto de opções. Se um chamador quiser controlar duração ou posição, a resposta é não: isso é decisão do design system, não da tela (§4 — variantes seguem o mapeamento, nunca ad-hoc).
2. **Retorno ignorável** — o valor de retorno não faz parte do contrato. Chamadores não devem depender dele. (A biblioteca retorna um `Id`; o módulo não o expõe.)
3. **Seguro em qualquer momento do ciclo de vida do React** — pode ser chamado de dentro de handlers, `useTransition`, callbacks de Server Action. Não é hook e não tem regra de ordem.
4. **Somente cliente** — os módulos que chamam `avisar` são `'use client'`. Chamar a partir de código de servidor não é suportado e não é um caso de uso existente.

**Uso canônico** (exatamente como as 12 telas já fazem hoje — nada muda):

```tsx
avisar.sucesso('Conta cadastrada', `${nome} já pode acessar o sistema.`)
avisar.erro('Não foi possível salvar', resultado.erro.mensagem)
avisar.info('Candidatura rejeitada', `${nome} foi notificado do motivo.`)
avisar.sucesso('Saída registrada com sucesso') // sem descrição
```

**Distribuição atual dos chamadores** (levantada por busca, base para a verificação de regressão):

| Método           | Ocorrências                                                      |
| ---------------- | ---------------------------------------------------------------- |
| `avisar.sucesso` | 14                                                               |
| `avisar.erro`    | 10                                                               |
| `avisar.info`    | 2                                                                |
| `avisar.atencao` | 0 — mantido por simetria dos quatro tons; demonstrado na galeria |
| **Total**        | **26**, em 12 arquivos                                           |

---

### `Toaster`

```ts
function Toaster(): JSX.Element
```

**Garantias**:

1. **Montagem única** — exatamente uma instância, em `app/layout.tsx`, dentro do `ThemeProvider`. Montar uma segunda produziria avisos duplicados.
2. **Sem props** — toda a configuração (posição, limite, durações, pausa) é interna ao módulo. O ponto de montagem não configura nada, e por isso `app/layout.tsx` não precisa ser alterado.
3. **Serve todas as rotas** — públicas e autenticadas, por estar no layout raiz (FR-014).

---

## Comportamento observável garantido

Estas são as afirmações verificáveis pelo roteiro de `quickstart.md`. Cada uma amarra a um requisito da spec.

| #    | Garantia                                                                                        | Requisito         |
| ---- | ----------------------------------------------------------------------------------------------- | ----------------- |
| C-01 | Cada um dos 4 métodos exibe um aviso com a cor, o ícone e a borda do seu tipo                   | FR-001, FR-008    |
| C-02 | Título sempre visível; descrição renderizada apenas quando fornecida                            | FR-002            |
| C-03 | Desaparecimento automático com duração por tipo: erro (8s) > atenção (6s) > sucesso = info (5s) | FR-003            |
| C-04 | Contagem pausa em hover e em perda de foco da janela; retoma de onde parou                      | FR-004            |
| C-05 | Botão de fechar alcançável por teclado, com `aria-label="Fechar aviso"` e alvo de 44px          | FR-005            |
| C-06 | No máximo 4 avisos simultâneos; excedentes aguardam e são exibidos, nunca descartados           | FR-006            |
| C-07 | Posicionado à direita inferior, sem cobrir a ação primária, inclusive a 360px                   | FR-007, SC-004    |
| C-08 | Aparência idêntica em tema claro e escuro, e um aviso já aberto acompanha a troca de tema       | FR-009            |
| C-09 | Todo texto de interface em pt-BR                                                                | FR-010            |
| C-10 | `role="alert"` presente, para anúncio por leitor de tela sem exigir navegação                   | FR-015            |
| C-11 | Renderizado acima de diálogos e gavetas                                                         | edge case da spec |

> C-10 vem de graça: o `ToastContainer` aplica `role="alert"` por padrão (confirmado em `dist/unstyled.mjs`). Não precisa ser adicionado, mas **precisa ser verificado** — se uma configuração futura sobrescrever `role`, o requisito quebra silenciosamente.

---

## Contrato negativo — o que este módulo não oferece

Fixado para evitar que a superfície cresça por acidente:

- **Sem opções por chamada** (duração, posição, ícone, transição customizados). Se um caso exigir isso, a discussão é sobre o design system, não sobre a tela.
- **Sem `avisar.promise`** ou variantes de carregamento, embora a biblioteca ofereça. Não há caso de uso hoje; adicionar sem demanda amplia superfície pública de graça.
- **Sem controle imperativo** (`dismiss`, `update`, `isActive`). O `toaster` era a porta para isso e está sendo fechado justamente porque ninguém o usava.
- **Sem exposição de tipos da biblioteca** na API pública. `ToastOptions`, `Id`, `TypeOptions` e afins ficam contidos no módulo — assim, uma troca futura de motor volta a ser uma reescrita de um arquivo, e não uma migração espalhada. É a mesma propriedade que torna **esta** migração barata.
