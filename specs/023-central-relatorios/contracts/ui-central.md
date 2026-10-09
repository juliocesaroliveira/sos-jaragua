# Contract: interface da central de relatórios

Textos 100% pt-BR; componentes do design system (`src/shared/ui`); dark/light.

## Catálogo (`/relatorios`)

- Título "Relatórios" e subtítulo "Consulte e exporte dados da operação para prestação de contas."
- Uma seção por grupo visível, na ordem Estoque → Voluntariado → Crise → Comunicação →
  Auditoria. Grupo sem relatório acessível ao perfil **não** é renderizado (Auditoria some para
  `membro_defesa_civil`).
- Cada relatório é um card-link: nome, pergunta (FR-003), ícone do grupo. Grade de 1 coluna no
  celular, 2–3 em telas largas.
- Pacote de contingência ao final, com o bloco atual (mesma cor de alerta, mesmo texto, mesmo
  link) — só quando `podeAcessar('/api/contingencia/export', role)`.

## Página do relatório (`/relatorios/[relatorio]`)

Ordem vertical:

1. Breadcrumb "Relatórios / <nome>" + título + pergunta.
2. **Filtros** (formulário GET-like que reescreve a URL e volta para `page=1`):
   - Período: dois date-pickers "De"/"Até" + atalhos "Hoje", "7 dias", "30 dias".
   - Filtros específicos como `Select`/`Lookup`/`Input` conforme data-model.md §2.
   - Botões "Aplicar" e "Limpar filtros". Erro de período exibido no campo.
3. **Avisos** da definição (`Alert tom="info"`), ex.: "A validade é da doação recebida…",
   "Horas escaladas não confirmam presença", "Descartes não entram neste relatório".
4. **Resumo** (quando houver): `StatCard`s em grade.
5. **Exportação**: contagem "N linhas", botões "Exportar XLSX" e "Exportar CSV" (`<a download>`
   com os filtros atuais). Se `contemDadosSensiveis`: `Alert tom="warning"` "Este arquivo contém
   dados pessoais sensíveis (CPF, restrições de saúde). Não compartilhe fora da operação da
   Defesa Civil — LGPD." Se `excedeLimiteExportacao`: botões desabilitados + `Alert` pedindo
   para reduzir o período.
6. **Prévia**: `Table` com paginação server-side; estado vazio "Nenhum registro no período
   selecionado."; erro com "Tentar novamente". Na trilha, cada linha tem ação "Ver alterações"
   que abre `Dialog`/`Drawer` com a tabela Campo | Antes | Depois.

## Mobile (FR-013)

Filtros empilhados; tabela com rolagem horizontal **dentro** do contêiner da tabela, nunca da
página; botões de exportação com altura ≥ 44 px.

## Navegação

Nenhum item novo no menu. O card de atalho da home mantém o destino `/relatorios`; a descrição
passa a "Exporte dados de estoque, voluntariado, crise e notificações."
