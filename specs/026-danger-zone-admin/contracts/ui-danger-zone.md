# Contrato de UI: `/admin/danger-zone`

Rota: `app/(interno)/(staff)/admin/danger-zone/page.tsx`, gate `exigirAcessoA('/admin/danger-zone')`
(regra `/admin` → `administrador`). Textos 100% pt-BR (FR-020). Responsiva até 360 px.

## U-01 Faixa de ambiente

Topo da página, cor de alerta, texto "Ambiente: PRODUÇÃO" / "PRÉ-VISUALIZAÇÃO" /
"DESENVOLVIMENTO" (FR-002a).

## U-02 Abas

`Tabelas` (padrão) · `Histórico`. Aba lembrada por `?aba=`.

## U-03 Inventário (aba Tabelas)

Tabela agrupada por área: rótulo, nome técnico, registros, "depende de", "dependentes",
botões **Resetar** e **Ver registros**. Indisponível → botões desabilitados com tooltip do motivo
("sem registros" / "vínculo não classificado: …").

## U-04 Registros de uma tabela (drawer)

Listagem paginada server-side com busca, seleção múltipla (máx. 500), sensíveis mascarados,
registros padrão marcados "registro do sistema" e não selecionáveis. Botão **Excluir
selecionados**.

## U-05 Fluxo de confirmação (dialog em passos)

1. **Resumo** — ação, tabela, área, registros, consequências, alerta de acesso,
   "Esta ação não pode ser desfeita pela aplicação".
2. **Modo** (só se `temDependentes`) — dois cartões: *Apagar em cascata* e *Preservar
   dependentes*, cada um com o total que apaga/altera; nenhum pré-selecionado.
3. **Impacto** — árvore por tabela com nível, vínculo, contagens, classificação; seção
   "Apagados em qualquer modo" (inseparáveis); seção "Vínculos que passarão a apontar para…";
   seção "Registros preservados"; saldos antes→depois com negativos em destaque; amostras.
4. **Confirmação** — campo "Digite `RESETAR item` para confirmar"; botão **Executar** desabilitado
   até conferir exatamente (FR-014); repete o ambiente. Se a sessão não for recente, o passo
   mostra **Entrar novamente** no lugar do botão.
5. **Resultado** — contagens reais por tabela e saldos recalculados; ou a mensagem de recusa. Em
   `dados_mudaram`, volta ao passo 3 com a prévia nova e um aviso.

"Cancelar" em qualquer passo chama `cancelarAcaoAction` a partir do passo 3.

## U-06 Histórico

Lista paginada: data/hora, administrador, ação, tabela, modo, situação (badge), total apagado /
alterado; expandir mostra contagens por tabela.

## U-07 Navegação

Item "Danger Zone", grupo `administracao`, ícone `TriangleAlert`, `perigo: true` (cor de alerta),
só `administrador`. Sem card na home.
