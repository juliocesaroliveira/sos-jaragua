# Contrato de UI: Painel de escala em cards

**Feature**: 019-cards-escala-atividade

## U-01 — Rota `/atividades/[id]` (inalterada fora da área de escalas)

**Arquivos**:

- `app/(interno)/(staff)/atividades/[id]/page.tsx` (Server Component, sem mudança)
- `app/(interno)/(staff)/atividades/[id]/painel-escala.tsx` (Client Component, alterado)

### Inalterado

| ID | Regra |
| --- | --- |
| U-01.1 | O acesso, os roles e o `Suspense` com `SkeletonLista` continuam como estão. |
| U-01.2 | O cabeçalho da atividade (título `h1`, `Badge` de status, categoria · local) continua como está. |
| U-01.3 | O `Alert` "Atividade não está aberta" aparece quando `status !== 'aberta'`. |
| U-01.4 | O `Select` "Filtrar voluntários por habilidade" atualiza `?habilidade=` e só afeta os voluntários disponíveis no diálogo de alocar. |
| U-01.5 | Sem turnos, aparece o `Alert` informativo "Esta atividade ainda não tem turnos", e a área de escalas não é renderizada. |
| U-01.6 | O `Dialog` "Alocar voluntário", a Server Action `alocarVoluntario`/`cancelarAlocacao` e os toasts continuam idênticos. |

### Área de escalas

| ID | Regra |
| --- | --- |
| U-01.7 | **Container:** `<section aria-labelledby="titulo-escalas">` com um cabeçalho que contém o `h2#titulo-escalas` "Escalas" e, ao lado, a contagem `1 escala` / `N escalas` (`text-sm text-neutral-500`). A `KanbanColumn` deixa de ser usada aqui. |
| U-01.8 | **Grade:** um `<ul>` com `grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] items-start gap-3` (research D1). Não há `overflow-x-auto` nem `flex-row`. |
| U-01.9 | **Card:** um `KanbanCard` por `TurnoDetalhado`, na ordem recebida (cronológica). `horario` = `HH:mm – HH:mm · dd/MM`. `preenchidas`/`vagas` vêm do turno. |
| U-01.10 | **Ação de alocar (`acoes`):** só quando `status === 'aberta'`. `IconButton` `UserPlus` dentro de `Tooltip`. O rótulo é `Alocar voluntário no turno de {dd/MM}, {HH:mm} – {HH:mm}`, usado como `aria-label` e conteúdo da dica (C-04.3, research D3). |
| U-01.11 | **Lista de voluntários (`detalhe`):** `<ul className="flex flex-col gap-1">`, um `<li>` por alocado, com nome `truncate`, `IconePapel`, selo "Inscrição própria" e um `IconButton` `UserMinus` "Remover {nome} do turno" (`min-h-11`, ≥ 44px). Esta marcação é a mesma de hoje. |
| U-01.12 | **Estado vazio do card:** sem alocados, `detalhe` = `<p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum voluntário escalado ainda.</p>`. |

### Comportamento responsivo (verificável)

| Largura de viewport | Esperado |
| --- | --- |
| 320px – ~640px | 1 card por linha, com a largura total do conteúdo e sem rolagem horizontal |
| ~640px – ~960px | 2 cards por linha (depende da navegação lateral) |
| 1280px | ≥ 3 cards por linha (SC-002) |
| 1920px | 4–5 cards por linha. Com 1 escala, o card fica com a largura de uma coluna, sem esticar |

## U-02 — Documentação

| ID | Regra |
| --- | --- |
| U-02.1 | `spec/DESIGN_SYSTEM.md` §4.16 descreve o uso no painel de escala: um `KanbanCard` por turno em grade `auto-fill` que quebra a linha, sem `KanbanColumn`. A `KanbanColumn` continua documentada para agrupar turnos por atividade. |
| U-02.2 | O comentário do topo de `painel-escala.tsx` descreve a grade em vez da rolagem horizontal. |
