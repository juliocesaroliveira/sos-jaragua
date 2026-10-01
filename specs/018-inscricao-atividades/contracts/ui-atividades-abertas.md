# Contrato de UI: Atividades abertas e Painel de escala

**Feature**: 018-inscricao-atividades

## U-01 — Rota `/voluntariado/atividades-abertas`

**Arquivos**:

- `app/(interno)/voluntariado/atividades-abertas/page.tsx` (Server Component)
- `lista-atividades-abertas.tsx` (Client Component)

### Acesso

| ID | Regra |
| --- | --- |
| U-01.1 | `REGRAS_DE_ROTA` recebe `{ prefixo: '/voluntariado/atividades-abertas', roles: ['voluntario', 'membro_defesa_civil', 'coordenador', 'administrador'] }`. |
| U-01.2 | A página chama `exigirRoles(...)` com os mesmos roles, como defesa em profundidade (Princípio IV). |
| U-01.3 | O item de menu `{ href: '/voluntariado/atividades-abertas', rotulo: 'Atividades abertas', icone: 'CalendarPlus', grupo: 'voluntariado', roles: ['voluntario', ...STAFF], atalho: { descricao: 'Encontre turnos com vagas e inscreva-se.' } }` fica antes de "Minhas atividades". |
| U-01.4 | `export const instant = false`, porque a página depende da sessão. |

### Conteúdo

| ID | Regra |
| --- | --- |
| U-01.5 | **Cabeçalho:** título "Atividades abertas" e subtítulo "Escolha um turno com vaga e inscreva-se. Você pode desistir até 30 minutos antes do início." |
| U-01.6 | **Faixa de elegibilidade:** se o usuário não for elegível (FR-011), aparece no topo um `Alert` informativo explicando o motivo, com link para `/voluntariado/candidatura`. Os botões de inscrição não são renderizados. |
| U-01.7 | **Cartão por atividade:** título, `Badge` da categoria e local com ícone `MapPin`. Os turnos aparecem agrupados por dia ("Seg, 06/10") e em ordem cronológica. |
| U-01.8 | **Linha de turno:** horário "08:00 – 12:00", barra `Progress` de preenchimento, texto "3 de 5 vagas preenchidas" e um selo de estado com **texto e cor** (FR-008): `com_vagas` "Vagas abertas", `ultimas_vagas` "Últimas vagas", `lotado` "Lotado", `em_andamento` "Em andamento", `inscrito` "Você está inscrito". |
| U-01.9 | **Ação do turno**, conforme o estado: `com_vagas`/`ultimas_vagas` → botão "Quero participar"; `inscrito` com mais de 30 minutos até o início → botão secundário "Desistir"; `inscrito` dentro do prazo de 30 minutos → texto "Para desistir, fale com a coordenação"; `lotado` e `em_andamento` → nenhuma ação. |
| U-01.10 | **Privacidade (FR-010a):** nenhum nome ou ícone de participante aparece nesta tela. |
| U-01.11 | **Ordenação (FR-007):** atividades ordenadas pelo turno mais próximo. |
| U-01.12 | **Estado vazio (FR-009):** sem dados, aparece "Não há atividades abertas no momento."; com filtros ativos, aparece "Nenhuma atividade corresponde aos filtros." e um botão "Limpar filtros". |
| U-01.13 | **Carregamento:** `Suspense` com `SkeletonLista`. |

### Confirmações

| ID | Regra |
| --- | --- |
| U-01.14 | "Quero participar" abre um `Dialog` com atividade, local, data e horário e os botões "Confirmar inscrição" e "Cancelar". Cancelar não faz nada (FR-012). |
| U-01.15 | "Desistir" abre um `Dialog` com a mesma informação e o aviso "A vaga será liberada para outra pessoa." |
| U-01.16 | Durante a ação, os botões ficam desabilitados com estado de carregamento (`useTransition`), o que impede duplo envio. |
| U-01.17 | **Sucesso:** toast de sucesso, o diálogo fecha e a tela é atualizada com `router.refresh()`. |
| U-01.18 | **Erro de negócio** (`lotado`, `conflito_horario`, `atividade_fechada`, `prazo_desistencia`...): toast de erro com a mensagem do servidor, o diálogo fecha e a tela é atualizada. **Erro de rede:** toast "Não foi possível concluir. Verifique sua conexão e tente novamente." e o diálogo continua aberto. |

### Filtros (US5)

| ID | Regra |
| --- | --- |
| U-01.19 | Filtros: `Select` de categoria (só categorias presentes na lista), seletor de dia (só dias presentes) e `Switch` "Somente com vagas". |
| U-01.20 | Os filtros são aplicados no cliente sobre os dados carregados e não fazem nova requisição. |
| U-01.21 | Com "Somente com vagas" ativo, ficam ocultos os turnos `lotado` e `em_andamento`, e também as atividades que ficarem sem nenhum turno visível. Turnos com estado `inscrito` continuam visíveis. |

### Responsividade e acessibilidade

| ID | Regra |
| --- | --- |
| U-01.22 | Layout em uma coluna no celular, sem rolagem horizontal, e grade de 2 colunas a partir de `lg`. Os alvos de toque têm no mínimo 44px. |
| U-01.23 | O estado do turno nunca é comunicado só por cor. A barra de progresso tem `aria-valuetext` igual ao texto de vagas. |

## U-02 — Painel de escala, alterado

**Arquivos**: `app/(interno)/(staff)/atividades/[id]/painel-escala.tsx`; `app/(interno)/(staff)/atividades/page.tsx` + `gestao-atividades.tsx` (flag `podeGerirAtividade`).

| ID | Regra |
| --- | --- |
| U-02.1 | Cada alocado mostra o nome (`coalesce(perfil.nome_completo, user.name)`) seguido de `<IconePapel role={...} />` (FR-024). |
| U-02.2 | Alocações com `origem = 'inscricao_propria'` mostram um selo textual "Inscrição própria" (FR-020). |
| U-02.3 | A lista de voluntários disponíveis para alocação manual exclui quem já está no turno, comparando pelos `voluntarioPerfilId` não nulos dos alocados (a seleção manual só lista voluntários com perfil). |
| U-02.4 | Para `membro_defesa_civil`, os botões Alocar e Remover do painel ficam visíveis (FR-019a). Na tela `/atividades` (`gestao-atividades.tsx`), criar atividade e alterar status ficam ocultos quando `podeGerirAtividade = false`. A autorização real continua nas actions. |

## U-03 — Componente `IconePapel`

**Arquivo**: `src/shared/ui/icone-papel/icone-papel.tsx`

| ID | Regra |
| --- | --- |
| U-03.1 | Assinatura: `IconePapel({ role }: { role: Role })`. Retorna `null` para `usuario` e `voluntario`. |
| U-03.2 | Mapeamento de ícones: `membro_defesa_civil` → `Shield`, `coordenador` → `ClipboardCheck`, `administrador` → `ShieldCheck`. Tamanho 16px, cor `text-primary`. |
| U-03.3 | Usa `Tooltip` com `ROTULO_ROLE[role]` e `aria-label` com o mesmo texto e `role="img"` (FR-025). |
