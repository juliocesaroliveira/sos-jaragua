# Contrato — adoção nas telas

Inventário fechado do que muda. Cada linha foi verificada no arquivo real; os números de linha são
do estado anterior à implementação e servem para localizar, não como âncora exata.

## A-01 — Design system (habilita todo o resto)

| Arquivo | Mudança |
| --- | --- |
| `src/shared/ui/tooltip/tooltip.tsx` | `descricao`, largura máxima com quebra (C-02.9, C-02.10) |
| `src/shared/ui/icon-button/icon-button.tsx` | estado `inativo` (C-03) |
| `spec/DESIGN_SYSTEM.md` §4.10 | registrar os dois papéis da dica e a regra `inativo` |

## A-02 — Correção dos usos existentes

| Arquivo | Controle | Situação hoje | Mudança |
| --- | --- | --- | --- |
| `src/shared/ui/shell/sidebar-nav.tsx:116` | Recolher/expandir navegação | `Tooltip` + `aria-label` com o **mesmo texto** → anúncio duplicado | derivar ambos da mesma expressão; papel de repetição |
| `src/shared/ui/shell/sidebar-nav.tsx:189` | Item de navegação recolhido | mesmo defeito, com `item.rotulo` | idem |

Estes dois já usam `Tooltip` — é o único lugar do sistema que usa. A feature os **corrige** antes
de replicar o padrão.

## A-03 — Presentes em toda tela interna

| Arquivo | Controle | Texto | Papel |
| --- | --- | --- | --- |
| `src/shared/ui/shell/topbar.tsx:54` | Abrir navegação | `Abrir navegação` | repetição |
| `src/shared/ui/shell/topbar.tsx:94` | Sair | `Sair` | repetição |
| `src/shared/ui/theme/theme-toggle.tsx:12` | Alternar tema | `Mudar para tema claro/escuro` | repetição |
| `app/(interno)/sino-notificacoes.tsx:61` | Sino | `Notificações` / `Notificações (N não lidas)` | repetição |

**Nota**: `theme-toggle` e o botão de recolher da `sidebar-nav` são `<button>` próprios, não
`IconButton`. Permanecem assim — o `Tooltip` envolve qualquer elemento (D8).

## A-04 — Ação sobre registro identificável (FR-015)

| Arquivo | Controle | Texto | Observação |
| --- | --- | --- | --- |
| `app/(interno)/(staff)/admin/tabela-usuarios.tsx:56` | Editar usuário | `Editar {nome}` | dentro de célula de tabela; verificar reposicionamento na última linha |
| `app/(interno)/(staff)/atividades/[id]/painel-escala.tsx:147` | Alocar no turno | `Alocar voluntário neste turno` | dentro de cartão de kanban |
| `app/(interno)/(staff)/atividades/[id]/painel-escala.tsx:168` | Remover do turno | `Remover {nome} do turno` | tem `loading={emAndamento}` → durante a remoção a dica não aparece, e está correto (D4) |

## A-05 — Ação indisponível com explicação (US3, C-03)

| Arquivo | Controle | Hoje | Depois |
| --- | --- | --- | --- |
| `app/(interno)/(staff)/estoque/saida/saida-form.tsx:161` | Remover linha | `disabled={linhas.length === 1}` | `inativo` na mesma condição + dica `descricao`: `A saída precisa de ao menos uma linha`; disponível: `Remover linha` |
| `app/(interno)/(staff)/estoque/kits/gestao-kits.tsx:275` | Remover componente | `disabled={receita.length === 1}` | `inativo` na mesma condição + dica `descricao`: `O kit precisa de ao menos um componente`; disponível: `Remover componente` |

**Regra**: a condição de indisponibilidade **não muda**. Só muda como ela é comunicada.

## A-06 — Vitrine (US5)

| Arquivo | Mudança |
| --- | --- |
| `app/(interno)/design-system/galeria.tsx:200` | expandir o exemplo único para demonstrar: quatro posições, papel de repetição vs. descrição, `inativo` com explicação, e uso dentro de linha de tabela |

## A-07 — Fora do escopo (registrado para não ser reaberto na revisão)

`dialog.tsx`, `drawer.tsx`, `popover.tsx`, `toast.tsx` (fechar) · `pagination.tsx` (anterior/próxima)
· `number-input.tsx` (aumentar/diminuir) · `date-picker.tsx` (abrir calendário, mês anterior/próximo).

São convenções universais dentro de um contexto já rotulado. Ver assumption do `spec.md`.

## A-08 — Verificação de completude

Ao final, uma varredura por `IconButton` e por `<button>` com `aria-label` e sem texto visível não
pode encontrar nenhum controle de ação fora desta tabela ou de A-07.
