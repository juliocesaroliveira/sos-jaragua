# Contrato — componente `Tooltip` e estado `inativo` do `IconButton`

Contrato de interface do design system. Telas consomem daqui; nenhuma tela importa o primitivo do
Ark diretamente (barril de `src/shared/ui`).

## C-01 — Assinatura do `Tooltip`

```ts
interface TooltipProps {
    /** Texto exibido. pt-BR, imperativo curto, sem pontuação final. */
    conteudo: string
    /** Controle que dispara a dica. Recebe os handlers por composição. */
    children: ReactNode
    /** Lado preferido. Reposiciona sozinho se não couber. Padrão: 'top'. */
    posicao?: 'top' | 'bottom' | 'left' | 'right'
    /** Atraso antes de abrir por ponteiro, em ms. Padrão: 300. */
    atrasoMs?: number
    /**
     * `false` (padrão): a dica repete o nome acessível do controle e é
     * puramente visual — nada é anunciado por ela.
     * `true`: a dica acrescenta informação (tipicamente o motivo de a ação
     * estar indisponível) e é exposta como descrição do controle.
     */
    descricao?: boolean
}
```

**C-01.1** — As props existentes (`conteudo`, `children`, `posicao`, `atrasoMs`) mantêm nome e
significado. `descricao` é aditiva e opcional: os dois pontos de uso atuais continuam compilando.

**C-01.2** — O componente **não** aceita classes arbitrárias no ponto de uso, como o restante do
design system.

## C-02 — Comportamento observável

| # | Comportamento | Origem |
| --- | --- | --- |
| C-02.1 | Abre ao apontar, após `atrasoMs` | primitivo |
| C-02.2 | Abre ao receber foco **de teclado**; não abre no foco vindo de clique | primitivo (`isFocusVisible`) |
| C-02.3 | Fecha ao afastar o ponteiro, ao perder o foco, com Esc, ao clicar e ao rolar | primitivo |
| C-02.4 | Esc dispensa a dica **sem** mover o foco | primitivo |
| C-02.5 | **Nunca** abre por toque | primitivo (ignora `pointerType === 'touch'`) |
| C-02.6 | Renderiza em portal, acima de diálogos e gavetas | `CLASSE_FLUTUANTE` (camada 60 > diálogo 50) |
| C-02.7 | Reposiciona quando o lado preferido não cabe | primitivo |
| C-02.8 | Sem animação de entrada/saída | decisão D6 |
| C-02.9 | Texto quebra em várias linhas dentro de uma largura máxima, limitada também pela janela | **a implementar** |
| C-02.10 | Com `descricao: false`, nada é anunciado pela dica | **a implementar** (modo `aria-label` do Root) |

Os itens marcados "primitivo" **não são implementados** nesta feature — são verificados no roteiro
de validação. Ver `research.md` D2.

## C-03 — Estado `inativo` do `IconButton`

```ts
interface IconButtonProps {
    // … props existentes inalteradas
    /**
     * Indisponível **e explicável**: mesma aparência esmaecida do `disabled`,
     * mas permanece focável e sensível ao ponteiro para que a dica possa ser
     * exibida. O clique é ignorado pelo componente.
     *
     * Use somente acompanhado de um `Tooltip descricao` que explique o motivo.
     */
    inativo?: boolean
}
```

**C-03.1** — Com `inativo`, o elemento **não** recebe o atributo `disabled` nativo; recebe
`aria-disabled`. Continua na ordem de tabulação.

**C-03.2** — O componente bloqueia o `onClick` internamente. `aria-disabled` é informação para
tecnologia assistiva e não impede nada por si.

**C-03.3** — A aparência de `inativo` é indistinguível da de `disabled`. Dois estados que parecem
diferentes confundiriam sem motivo.

**C-03.4** — `disabled` e `loading` permanecem inalterados e continuam sendo o padrão. `inativo` é
exceção, não substituto.

**C-03.5** — Se `disabled` e `inativo` forem informados juntos, `disabled` prevalece.

## C-04 — Regras de uso (valem para toda tela)

**C-04.1** — Todo controle de ação representado **apenas por ícone** recebe dica.

**C-04.2** — Controle com texto visível **não** recebe dica (FR-016).

**C-04.3** — Com `descricao: false`, `conteudo` e o nome acessível do controle vêm da **mesma
expressão** no código — nunca de duas strings literais escritas em separado.

**C-04.4** — Quando a ação se refere a um registro, o texto nomeia o registro.

**C-04.5** — Nenhuma informação necessária para concluir uma tarefa existe apenas na dica. Em
celular ela nunca aparece.

**C-04.6** — A dica não altera comportamento, alvo de toque, alinhamento ou espaçamento do controle
— ela envolve, não substitui.

## C-05 — Não-objetivos

- Dica com conteúdo interativo (link, botão dentro do balão). O conteúdo é texto e não recebe
  ponteiro.
- Dica em controles internos dos primitivos: fechar diálogo/gaveta/aviso, setas de paginação,
  incremento/decremento numérico, navegação de meses do calendário.
- Dica como substituto de mensagem de erro de formulário — esse papel é do campo.
- Abertura por toque ou por clique longo.
