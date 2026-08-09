# Design System (DESIGN_SYSTEM.md)

## Projeto: SOS Jaraguá — Gestão e Mobilização em Situações de Emergência

Este documento define o tema Tailwind CSS v4 (tokens, cores, tipografia, espaçamento) e a
especificação de todos os componentes de UI a serem construídos sobre **Ark UI**. É a
referência que um agente de IA deve seguir ao implementar o design system — toda decisão
visual relevante está registrada aqui, sem pendências. Complementa `DESIGN.md` (arquitetura)
e `REQUISITOS_NAO_FUNCIONAIS.md` §2.2 (requisitos de design system, temas, ergonomia de
crise).

**Diretriz geral de UI**: a interface é usada por operadores sob estresse, muitas vezes em
campo via smartphone/tablet, potencialmente com conectividade instável. Toda decisão de
design abaixo prioriza clareza e velocidade de operação sobre densidade visual ou
ornamentação.

---

## 1. Fundamentos do Tema (`@theme` em `app/globals.css`)

### 1.1. Cores

**Decisão**: os tokens semânticos são **aliases das paletas nativas do Tailwind v4**
(já definidas em oklch, perceptualmente uniformes e testadas para contraste), em vez de
uma paleta hexadecimal customizada. Isso garante uma escala com 11 tons (`50`–`950`)
consistente e testada, sem trabalho de curadoria manual.

| Token semântico | Paleta base | Uso |
| --- | --- | --- |
| `--color-primary-{50..950}` | `orange` (Tailwind) | Cor de marca "Defesa Civil" — ações primárias, links, foco, destaques de marca |
| `--color-neutral-{50..950}` | `slate` (Tailwind) | Texto, bordas, fundos de superfície, ícones secundários |
| `--color-success-{50..950}` | `green` | Aprovações, saldo suficiente, confirmações |
| `--color-warning-{50..950}` | `amber` | Pendências, alertas de atenção (ex.: cadastros acumulados) |
| `--color-danger-{50..950}` | `red` | Erros, rejeições, déficit de estoque, cancelamentos, urgência |
| `--color-info-{50..950}` | `blue` | Estados informativos neutros (ex.: atividade "aberta") |

Adicionar em `app/globals.css`, dentro de `@theme inline`:

```css
@theme inline {
    /* ...tokens existentes (--color-background, --color-foreground, --font-sans)... */

    --color-primary-50: var(--color-orange-50);
    --color-primary-100: var(--color-orange-100);
    --color-primary-200: var(--color-orange-200);
    --color-primary-300: var(--color-orange-300);
    --color-primary-400: var(--color-orange-400);
    --color-primary-500: var(--color-orange-500);
    --color-primary-600: var(--color-orange-600);
    --color-primary-700: var(--color-orange-700);
    --color-primary-800: var(--color-orange-800);
    --color-primary-900: var(--color-orange-900);
    --color-primary-950: var(--color-orange-950);

    --color-neutral-50: var(--color-slate-50);
    --color-neutral-100: var(--color-slate-100);
    --color-neutral-200: var(--color-slate-200);
    --color-neutral-300: var(--color-slate-300);
    --color-neutral-400: var(--color-slate-400);
    --color-neutral-500: var(--color-slate-500);
    --color-neutral-600: var(--color-slate-600);
    --color-neutral-700: var(--color-slate-700);
    --color-neutral-800: var(--color-slate-800);
    --color-neutral-900: var(--color-slate-900);
    --color-neutral-950: var(--color-slate-950);

    /* success/warning/danger/info seguem o mesmo padrão de alias, para green/amber/red/blue */

    --color-surface: var(--surface);
    --color-surface-muted: var(--surface-muted);
    --color-border: var(--border);
    --color-border-strong: var(--border-strong);
    --color-primary-foreground: var(--primary-foreground);
}
```

`primary`/`neutral`/`success`/`warning`/`danger`/`info` **não variam entre claro/escuro** —
são as mesmas 11 tonalidades oklch em ambos os modos (é assim que os presets do Tailwind
já funcionam; o que muda é *qual tom da escala* é usado para uma função, ver §1.6). Já os
tokens de **superfície** (`background`, `foreground`, `surface`, `border`, etc.) mudam de
valor por modo — ver tabela completa na §2.

### 1.2. Tipografia

- **Fonte**: Inter (já configurada via `next/font/google` em `app/layout.tsx`, exposta como
  `--font-inter` → `--font-sans`). Nenhuma mudança necessária.
- **Base**: 16px (`text-base` padrão do Tailwind — não sobrescrever `font-size` no `html`).
- **Escala semântica** — usar diretamente as classes utilitárias do Tailwind, sem criar
  tokens novos de tamanho:

| Papel | Classes Tailwind | Uso |
| --- | --- | --- |
| `h1` (título de página) | `text-3xl font-bold tracking-tight` (`md:text-4xl`) | Título principal de cada tela |
| `h2` (seção) | `text-2xl font-semibold tracking-tight` | Cabeçalho de seção/card grande |
| `h3` (subseção) | `text-xl font-semibold` | Cabeçalho de card/painel |
| `h4` | `text-lg font-semibold` | Subtítulo dentro de card |
| `body` (padrão) | `text-base font-normal` | Texto corrido, valor de campos |
| `body-sm` | `text-sm font-normal` | Texto secundário, descrições |
| `label` | `text-sm font-medium` | Rótulo de campo de formulário |
| `caption` | `text-xs font-normal text-neutral-500` | Metadados, timestamps, contadores |

**Regra de clareza sob estresse**: nunca usar tamanho abaixo de `text-sm` (14px) para
informação acionável (valores, erros, botões). `text-xs` é reservado a metadados
não-críticos.

### 1.3. Espaçamento e área de toque (touch target)

- **Mínimo de 44×44px** para todo controle interativo (botão, input, item de lista
  clicável, ícone clicável) — alinhado a WCAG 2.5.5 (AAA) e Apple HIG, adequado a uso em
  campo sob estresse, inclusive com luvas.
- Na prática: componentes de tamanho `md` (padrão) usam `h-11` (44px = `2.75rem`, já exato
  na escala padrão do Tailwind — nenhum token novo necessário). Tamanho `sm` (`h-9`, 36px)
  é permitido apenas em contextos densos de desktop (ex.: célula de ação em tabela), nunca
  como único meio de executar uma ação crítica em mobile.

### 1.4. Radius (raio de borda)

Estilo definido: **suave/amigável**. Usar diretamente a escala padrão do Tailwind:

| Elemento | Classe |
| --- | --- |
| Botões, inputs, selects, badges retangulares | `rounded-lg` (0.5rem / 8px) |
| Cards, dialogs, drawers, painéis | `rounded-xl` (0.75rem / 12px) |
| Badges/tags de status, avatar, pills, switch | `rounded-full` |

### 1.5. Sombras / elevação

Usar a escala padrão do Tailwind (`shadow-sm`, `shadow-md`, `shadow-lg`), sem redefinição
de tokens:

- **Modo claro**: `shadow-sm` em cards e `shadow-md` em elementos flutuantes (dialog,
  popover, menu) é suficiente — sombra discreta, não decorativa.
- **Modo escuro**: sombra é pouco perceptível sobre fundo escuro — priorizar `border
  border-neutral-800` em vez de depender de `shadow-*` para separar superfícies.

### 1.6. Uso de tons por função (light vs. dark)

| Função | Claro | Escuro | Motivo |
| --- | --- | --- | --- |
| Ação primária (fundo de botão) | `primary-600` | `primary-500` | `600` garante contraste AA sobre branco; `500` é suficientemente vívido sobre fundo escuro e evita saturação excessiva |
| Texto sobre ação primária | `white` (`primary-foreground`) | `white` | Contraste consistente nos dois modos |
| Texto padrão | `neutral-900` | `neutral-100` | — |
| Texto secundário | `neutral-500` | `neutral-400` | — |
| Borda padrão | `neutral-200` | `neutral-800` | — |
| Anel de foco | `primary-500` | `primary-400` | Visibilidade em ambos os fundos |

### 1.7. Breakpoints

Escala padrão do Tailwind (`sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`,
`2xl: 1536px`) — sem customização. Abordagem **mobile-first**:

- **Base (sem prefixo)**: layout de coluna única, otimizado para celular em campo.
- **`md`**: tablet — grids de 2 colunas, Kanban com scroll horizontal vira colunas fixas.
- **`lg`+**: desktop da central de operações — tabelas completas, dashboards multi-coluna,
  navegação lateral fixa.

### 1.8. Ícones

- **Biblioteca**: `lucide-react` (adicionar a `package.json`).
- **Tamanho padrão**: `20px` quando inline com texto (botões, labels), `24px` quando
  standalone (ícone de card, header de seção).
- **`stroke-width`**: `2` (padrão da biblioteca) em todo o app, para consistência visual.

---

## 2. Tabela de Tokens de Superfície — Claro/Escuro

Extensão direta do padrão já existente em `app/globals.css` (`:root` vs. `:root.dark`).

| Token CSS | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `--background` | `#ffffff` | `#0a0a0a` | Já existente — fundo da página |
| `--foreground` | `#171717` | `#ededed` | Já existente — texto padrão |
| `--surface` | `oklch(1 0 0)` (branco) | `var(--color-neutral-900)` | Fundo de cards/painéis |
| `--surface-muted` | `var(--color-neutral-50)` | `var(--color-neutral-800)` | Fundo de seções secundárias, hover de linha de tabela |
| `--border` | `var(--color-neutral-200)` | `var(--color-neutral-800)` | Borda padrão de inputs/cards |
| `--border-strong` | `var(--color-neutral-300)` | `var(--color-neutral-700)` | Divisores com mais ênfase |
| `--primary-foreground` | `#ffffff` | `#ffffff` | Texto sobre fundo `primary-*` |

Implementação: adicionar essas variáveis nos mesmos blocos já existentes em
`app/globals.css` (`:root`, `@media (prefers-color-scheme: dark) :root:not(.light):not(.dark)`,
e `:root.dark`), seguindo exatamente o padrão já usado por `--background`/`--foreground`.

---

## 3. Mapeamento Semântico de Status → Cor

Todo `Badge`/`Tag` de status no sistema **deve** usar esta tabela — não inventar cores
ad-hoc por tela.

| Entidade.campo | Valor | Cor semântica |
| --- | --- | --- |
| `voluntario_perfil.status` | `pendente` | `warning` |
| `voluntario_perfil.status` | `aprovado` | `success` |
| `voluntario_perfil.status` | `rejeitado` | `danger` |
| `atividade.status` | `aberta` | `info` |
| `atividade.status` | `encerrada` | `neutral` |
| `atividade.status` | `cancelada` | `danger` |
| `alocacao.status` | `confirmado` | `success` |
| `alocacao.status` | `cancelado` | `danger` |
| `saida.tipo` | `avulso` | `neutral` |
| `saida.tipo` | `kit` | `primary` |
| `notificacao_envio.status` | `pendente` | `warning` |
| `notificacao_envio.status` | `enviado` | `success` |
| `notificacao_envio.status` | `falhou` | `danger` |
| Turno com déficit (Kanban, `preenchidas < vagas`) | — | fundo `danger-50`/borda `danger-400` (claro), `danger-950`/`danger-700` (escuro) |
| Alerta "Estoque Crítico" | — | banner `warning` |
| Alerta "Déficit de Atendimento" | — | banner `danger` |
| Alerta "Cadastros Acumulados" | — | banner `info` |

---

## 4. Especificação de Componentes (Ark UI)

Convenção geral: cada componente recebe `variant`/`size` como props, nunca classes
Tailwind arbitrárias no ponto de uso — mantém consistência e evita drift visual entre
telas. Todo componente interativo deve expor `focus-visible:ring-2
focus-visible:ring-primary-500 dark:focus-visible:ring-primary-400
focus-visible:ring-offset-2`.

### 4.1. Button / IconButton

- **Base**: elemento nativo `<button>` (Ark UI não expõe um primitivo de botão — é
  wrapper próprio).
- **Variantes**: `primary` (fundo `primary-600`/`primary-500`), `secondary` (fundo
  `surface`, borda `border`), `ghost` (sem fundo/borda, hover `surface-muted`), `danger`
  (fundo `danger-600`).
- **Tamanhos**: `sm` (`h-9`, uso restrito a desktop denso), `md` (`h-11`, padrão),
  `lg` (`h-13`, ações primárias de tela cheia em mobile).
- **Estados**: `disabled` (opacidade 50%, `cursor-not-allowed`), `loading` (spinner
  `lucide-react` `Loader2` com `animate-spin`, texto mantido para não colapsar largura).
- **IconButton**: mesma API, `w-11 h-11` (quadrado), exige `aria-label` obrigatório.

### 4.2. Input / Textarea / NumberInput

- **Input/Textarea**: elemento nativo estilizado (Ark UI não tem primitivo de texto
  simples). `h-11`, `rounded-lg`, borda `border`, foco com anel `primary`.
- **NumberInput**: Ark UI `NumberInput` (partes `Root`, `Input`, `IncrementTrigger`,
  `DecrementTrigger`) — usado em quantidade de estoque (decimal, `min=0`).
- **Estado de erro**: borda `danger-500` + `text-danger-600` abaixo do campo (mensagem
  de validação Zod), com `aria-invalid`/`aria-describedby`.

### 4.3. Select

- Ark UI `Select` (`Root`, `Trigger`, `Content`, `Item`, `ItemGroup`).
- Uso: categoria de item, condição, unidade de medida, tipo de veículo, disponibilidade.
- Trigger com mesma altura/estilo do `Input` (`h-11`, `rounded-lg`) para consistência
  visual entre campos de formulário.

### 4.4. Combobox

- Ark UI `Combobox` (`Root`, `Input`, `Content`, `Item`).
- **Uso único e crítico**: autocomplete de "Nome do Item" na tela de Entrada (BR-EST-01),
  consultando `item.nome` via índice trigram. Debounce de 200–300ms na digitação.

### 4.5. CheckboxGroup / RadioGroup / Switch

- Ark UI `CheckboxGroup`, `RadioGroup`, `Switch`.
- **CheckboxGroup**: habilidades específicas no formulário de candidatura (múltipla
  escolha).
- **RadioGroup**: tipo de veículo, condição do item (quando exibido como opções curtas).
- **Switch**: booleanos (veículo próprio, perecível). O `ThemeToggle` atual
  (`src/shared/ui/theme/theme-toggle.tsx`) usa um `<button role="switch">` custom com
  emoji — ao construir o `Switch` do design system, avaliar migrar o toggle de tema para
  reutilizá-lo (não obrigatório nesta etapa, apenas nota para consistência futura).

### 4.6. DatePicker

- Ark UI `DatePicker`.
- Uso: data de nascimento (validação de maioridade no domínio), data de validade (bloqueio
  de data passada quando `perecivel = true`).
- Locale `pt-BR`, formato de exibição `dd/mm/aaaa`.

### 4.7. Dialog / Drawer

- Ark UI `Dialog` — confirmações destrutivas (rejeitar candidatura, cancelar alocação),
  detalhe de candidatura na fila de triagem.
- Ark UI `Dialog` variante tela-cheia em mobile (`Drawer` = mesmo primitivo `Dialog` com
  posicionamento lateral/inferior via CSS) — filtros de listagem em mobile, formulários
  longos que não cabem em modal centralizado.
- `rounded-xl`, `shadow-lg`, overlay `bg-black/50`.

### 4.8. Toast

- Ark UI `Toast` (via `createToaster`).
- Feedback de mutações client-side (ex.: "Saída registrada com sucesso", erros de
  validação de saída de kit). Variantes `success`/`danger`/`info` seguem §3. Auto-dismiss
  5s, pausável em hover/foco.

### 4.9. Tabs / Accordion

- Ark UI `Tabs` — navegação dentro de telas com múltiplas visões (ex.: Relatórios:
  Inventário vs. Histórico de Saídas).
- Ark UI `Accordion` — detalhes expansíveis em mobile (ex.: detalhe de turno dentro de um
  card de atividade, quando o Kanban colapsa para lista em telas pequenas).

### 4.10. Tooltip / Popover / Menu

- Ark UI `Tooltip` — texto de apoio em ícones sem label visível.
- Ark UI `Popover` — painéis contextuais leves (ex.: detalhes rápidos de saldo de um
  item).
- Ark UI `Menu` — ações contextuais em linha de tabela/card (Aprovar, Rejeitar, Editar,
  Cancelar).

### 4.11. Avatar / Badge

- Ark UI `Avatar` — foto/iniciais do usuário (header, listagem de voluntários).
- **Badge/Tag**: componente próprio (Ark UI não tem primitivo de badge — é só estilo),
  `rounded-full`, `text-xs font-medium`, cores conforme §3 (`bg-{cor}-100 text-{cor}-800`
  no claro, `bg-{cor}-950 text-{cor}-300` no escuro).

### 4.12. Progress / StatCard

- Ark UI `Progress`/`ProgressCircle` — indicador visual de "Kits Possíveis" vs. "Kits
  Necessários" (percentual de capacidade atendida).
- **StatCard** (componente próprio, sem primitivo Ark): card com label + valor grande +
  variação/ícone, usado nos indicadores do dashboard (BR-INT-02). Fundo `surface`, borda
  `border`, `rounded-xl`, `shadow-sm`.

### 4.13. Pagination / Table

- Ark UI `Pagination` — paginação **sempre server-side** (NFR §2.1), nunca client-side.
- **Table**: wrapper de apresentação sobre TanStack Table headless (não um primitivo Ark).
  Densidade **confortável**: linha com altura mínima efetiva de `h-12` (48px,
  `py-3`), cabeçalho `text-xs font-semibold uppercase text-neutral-500`, linha com hover
  `bg-surface-muted`, linha clicável quando aplicável mantém o touch target de 44px em
  cada célula de ação.

### 4.14. Alert / Banner

- Componente próprio (sem primitivo Ark equivalente): faixa full-width ou card de
  destaque, ícone + título + descrição, cores conforme §3. Usado para os três alertas de
  coordenador (`cadastros_acumulados`, `estoque_critico`, `deficit_atendimento`) e para o
  broadcast de urgência.

### 4.15. Skeleton

- Componente próprio: bloco `bg-neutral-200 dark:bg-neutral-800 animate-pulse
  rounded-lg`. Usado em listagens/dashboard durante carregamento (Suspense boundaries dos
  Server Components).

### 4.16. KanbanCard / KanbanColumn

- **Sem primitivo Ark equivalente** — construído do zero sobre HTML semântico
  (`<section>`/`<ul>`), sem drag-and-drop (não requerido pelo BRD).
- `KanbanColumn`: uma por `atividade`, cabeçalho com título + contagem de turnos.
- `KanbanCard`: um por `turno`, mostra horário, vagas preenchidas/total; aplica o
  destaque de déficit definido em §3 quando `preenchidas < vagas`.
- Em `md-`: colunas empilhadas verticalmente (lista); em `md+`: colunas lado a lado com
  scroll horizontal ou grid fixo, conforme espaço.

---

## 5. Convenção de Organização de Arquivos

```
src/shared/ui/
  button/button.tsx
  icon-button/icon-button.tsx
  input/input.tsx
  textarea/textarea.tsx
  number-input/number-input.tsx
  select/select.tsx
  combobox/combobox.tsx
  checkbox-group/checkbox-group.tsx
  radio-group/radio-group.tsx
  switch/switch.tsx
  date-picker/date-picker.tsx
  dialog/dialog.tsx
  drawer/drawer.tsx
  toast/toast.tsx
  tabs/tabs.tsx
  accordion/accordion.tsx
  tooltip/tooltip.tsx
  popover/popover.tsx
  menu/menu.tsx
  avatar/avatar.tsx
  badge/badge.tsx
  progress/progress.tsx
  stat-card/stat-card.tsx
  pagination/pagination.tsx
  table/table.tsx
  alert/alert.tsx
  skeleton/skeleton.tsx
  kanban/kanban-card.tsx
  kanban/kanban-column.tsx
  theme/                      # já existe (theme-provider.tsx, theme-toggle.tsx)
```

Um componente por pasta (padrão já usado em `src/shared/ui/theme/`); cada pasta pode ter
um `index.ts` de barrel se o componente crescer em múltiplos arquivos (ex.: partes
compostas de `select/`).

---

## 6. Diretrizes de Acessibilidade e Responsividade

- **Foco visível obrigatório** em todo elemento interativo (`focus-visible:ring-2
  ring-primary-500`/`ring-primary-400` no escuro) — nunca `outline-none` sem substituto.
- **Contraste mínimo AA** (4.5:1 para texto normal, 3:1 para texto grande/ícones) —
  garantido pela escolha de tons por função na §1.6; não usar `primary-400`/`primary-300`
  como fundo de texto no claro (contraste insuficiente sobre branco).
- **Touch target 44px** (§1.3) em todo controle, sem exceção em telas mobile.
- **Mobile-first**: toda tela é desenhada primeiro para a largura base, depois
  progressivamente aprimorada com `md:`/`lg:` — nunca o inverso.
- **pt-BR**: todo texto de interface, mensagem de erro e rótulo de componente em
  português brasileiro (herdado do NFR §2.2) — nenhum componente deve conter texto em
  inglês hardcoded (usar props de conteúdo, nunca texto fixo no componente base).
- **Teste manual obrigatório** de cada componente em claro e escuro antes de ser
  considerado pronto — a alternância de tema já está implementada
  (`src/shared/ui/theme/theme-provider.tsx`) e deve ser usada durante o desenvolvimento.

---

## 7. Checklist de Implementação

1. Adicionar `lucide-react` a `package.json`.
2. Aplicar os tokens da §1.1 e §2 em `app/globals.css` (extensão do `@theme inline` e dos
   blocos `:root`/`:root.dark` já existentes).
3. Implementar componentes primitivos de formulário primeiro (Button, Input, Select,
   Checkbox/Radio/Switch, NumberInput), depois os de overlay (Dialog, Drawer, Toast,
   Popover, Menu, Tooltip), depois os de exibição de dados (Badge, Avatar, Table,
   Pagination, Progress, StatCard, Alert, Skeleton), e por último os compostos
   específicos de domínio (Combobox de item, KanbanCard/KanbanColumn).
4. Validar cada componente novo em claro/escuro e em pelo menos duas larguras
   (mobile ~375px, desktop ~1280px) antes de integrá-lo a uma tela de negócio.
5. Ao construir uma tela, mapear cada status de domínio ao `Badge` correspondente usando
   exclusivamente a tabela da §3 — nunca cores ad-hoc.
