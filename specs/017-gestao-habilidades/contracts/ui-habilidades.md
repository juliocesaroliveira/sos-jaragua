# Contrato de Tela: `/habilidades`

**Feature**: 017-gestao-habilidades | **Arquivos**: `app/(interno)/(staff)/habilidades/`

## R-01 — Rota e acesso

| ID | Regra |
| --- | --- |
| R-01.1 | Rota `/habilidades`, sob `app/(interno)/(staff)/habilidades/page.tsx`. |
| R-01.2 | Entrada nova em `REGRAS_DE_ROTA`: `{ prefixo: '/habilidades', roles: ['membro_defesa_civil', 'coordenador', 'administrador'] }`, usando a constante `STAFF` já existente. Rota sob `(staff)` sem entrada no mapa é proibida (Princípio IV). |
| R-01.3 | A página chama `await exigirAcessoA('/habilidades')` — terceira camada, depois de `proxy.ts` e do gate de `(staff)/layout.tsx`. |
| R-01.4 | `export const instant = false` — o segmento lê sessão, então não é prerenderizável (mesmo racional de `/admin`). |
| R-01.5 | Item novo em `NAVEGACAO`: grupo `operacao`, rótulo "Habilidades", ícone lucide `Wrench`, `roles: STAFF`, **sem** `atalho` (é tela de manutenção, não de acesso rápido — o critério já aplicado a `/voluntarios` e `/atividades`). `navegacao.test.ts` (INV-01) trava a consistência com `rotas.ts`. |
| R-01.6 | `metadata.title = 'Habilidades — SOS Jaraguá'`. |

## T-01 — Listagem

| ID | Regra |
| --- | --- |
| T-01.1 | A primeira página é resolvida no Server Component e entregue hidratada (`estadoHidratado` + `HydrationBoundary`), com a chave derivada dos `searchParams` **da URL** — fixá-la dispararia um POST redundante no primeiro render. |
| T-01.2 | As demais páginas vêm por `useListagemPaginada({ chave: chaveHabilidades, buscar: listarHabilidadesAction })`. `page`/`pageSize` continuam na URL; a visão segue compartilhável. |
| T-01.3 | Colunas: **Nome**, **Voluntários** (contagem, FR-013), **Cadastrada em** (data formatada pt-BR), **Ações**. |
| T-01.4 | Estados: carregando (`SkeletonLista` no `Suspense`), atualizando (indicador do `Table`), vazio ("Nenhuma habilidade cadastrada.") e erro (`Alert` com "Tentar novamente" chamando `refetch`) — FR-019. |
| T-01.5 | O botão "Nova habilidade" fica acima da tabela, alinhado à direita, e permanece disponível inclusive com a lista vazia (US1 cenário 3). |

## T-02 — Ações da linha

| ID | Regra |
| --- | --- |
| T-02.1 | Duas `IconButton` por linha, cada uma dentro de `Tooltip`: editar (`Pencil`) e excluir (`Trash2`). |
| T-02.2 | O rótulo acessível **nomeia o registro**: `"Editar Motosserra"`, `"Excluir Motosserra"` — mesmo texto no `aria-label` e na dica (padrão fixado em 015). |
| T-02.3 | A ação de excluir nunca executa direto: sempre abre a confirmação (FR-011). |

## D-01 — Diálogo de cadastro/edição

| ID | Regra |
| --- | --- |
| D-01.1 | **Um único componente** para os dois modos: `habilidade` ausente = cadastro, presente = edição pré-preenchida. Título "Nova habilidade" / "Editar habilidade". |
| D-01.2 | `Dialog` compartilhado (já responsivo: folha em mobile, modal em desktop) — FR-018 sai da escolha do componente, não de CSS próprio. |
| D-01.3 | `useFormulario` + Zod: `nome` obrigatório, mínimo 2 e máximo 80 caracteres, mensagens pt-BR. `Formulario` garante `<form noValidate>` (016). |
| D-01.4 | `reset` ao abrir e ao trocar de registro sem fechar — o nome digitado para uma habilidade jamais pode alcançar a seguinte. |
| D-01.5 | Recusa do servidor é distribuída por `aplicarErrosDoServidor` com `camposConhecidos: ['nome']`; `duplicado` aparece **abaixo do campo**, não só no toast (US2 cenário 4). |
| D-01.6 | Falha de rede/servidor mantém o diálogo aberto com os dados preenchidos (spec §Edge Cases). |
| D-01.7 | Sucesso: fecha o diálogo, dispara `avisar.sucesso` ("Habilidade cadastrada" / "Habilidade atualizada") e chama `onSucesso`, que invalida `RAIZ_HABILIDADES` no cliente. |
| D-01.8 | Rodapé: "Cancelar" (secundário, `X`) e "Cadastrar"/"Salvar" (primário, `Check`, com `loading={isSubmitting}`). Cancelar ou fechar não cria nem altera nada. |

## D-02 — Diálogo de confirmação de exclusão

| ID | Regra |
| --- | --- |
| D-02.1 | Componente local à feature (`excluir-habilidade-dialog.tsx`) sobre o `Dialog` compartilhado — research D7. |
| D-02.2 | O texto **nomeia a habilidade**: "Excluir a habilidade “Motosserra”? Esta ação não pode ser desfeita." (FR-011). |
| D-02.3 | Quando `voluntariosVinculados > 0`, o diálogo abre já em modo impeditivo: explica quantos voluntários estão vinculados e o botão de confirmar fica **desabilitado**. A recusa é do servidor (X-01.2); a tela apenas antecipa, não substitui. |
| D-02.4 | Botão de confirmação em variante destrutiva, com `loading` durante a ação. |
| D-02.5 | Sucesso: fecha, `avisar.sucesso('Habilidade excluída', '"X" foi removida.')`, invalida `RAIZ_HABILIDADES`. |
| D-02.6 | `vinculo_existente` vindo do servidor (corrida, X-01.3): toast de erro com a mensagem do servidor e invalidação da listagem, para que a contagem em tela se corrija. |
| D-02.7 | Excluir o último item de uma página não deixa a tela em branco — `paginarComClamp` já devolve a última página válida no próximo carregamento. |

## Acessibilidade e idioma

| ID | Regra |
| --- | --- |
| ACC-01 | Todo texto em pt-BR, incluindo mensagens de validação e de erro (Princípio II). |
| ACC-02 | Ações só de ícone sempre com `aria-label` que nomeia o registro (T-02.2). |
| ACC-03 | Foco no primeiro campo com erro no envio inválido — comportamento já fixado por `useFormulario` (016). |
| ACC-04 | Sem rolagem horizontal em telas pequenas (FR-018). |
