# Data Model: Central de relatórios

**Feature**: 023-central-relatorios | **Date**: 2026-10-08

A feature **não cria tabelas nem coleções**. Ela lê as existentes (DB_SCHEMA.md §4–§9) e
acrescenta só três índices (research.md D12). Os modelos abaixo são estruturas em memória do
módulo Contingência/Relatórios.

---

## 1. Catálogo

### `SlugRelatorio`

União fechada dos 17 identificadores; é também o último segmento da rota.

| ID   | slug                     | Grupo        | Período | Dados sensíveis |
| ---- | ------------------------ | ------------ | ------- | --------------- |
| R-01 | `inventario`             | estoque      | não     | não             |
| R-02 | `saidas`                 | estoque      | sim     | não             |
| R-03 | `entradas`               | estoque      | sim     | não             |
| R-04 | `descartes`              | estoque      | sim     | não             |
| R-05 | `estoque-critico`        | estoque      | não     | não             |
| R-06 | `validades`              | estoque      | não¹    | não             |
| R-07 | `movimentacao`           | estoque      | sim     | não             |
| R-08 | `entregas-por-destino`   | estoque      | sim     | não             |
| R-09 | `voluntarios`            | voluntariado | não     | **sim**         |
| R-10 | `triagem`                | voluntariado | sim     | não             |
| R-11 | `capacidade-habilidades` | voluntariado | não     | não             |
| R-12 | `ocupacao-turnos`        | voluntariado | sim     | não             |
| R-13 | `participacao`           | voluntariado | sim     | **sim**²        |
| R-14 | `evolucao-crise`         | crise        | sim     | não             |
| R-15 | `demanda-kits`           | crise        | não     | não             |
| R-16 | `notificacoes`           | comunicacao  | sim     | não             |
| R-17 | `auditoria`              | auditoria    | sim     | **sim**         |

¹ R-06 usa horizonte em dias, não período. ² R-13 inclui CPF para identificar o participante.

### `GrupoRelatorio`

`'estoque' | 'voluntariado' | 'crise' | 'comunicacao' | 'auditoria'` com rótulo e ordem
(Estoque, Voluntariado, Crise, Comunicação, Auditoria). Grupo sem relatório visível ao perfil
não é exibido (mesma regra de `gruposVisiveis` da navegação).

### `DescricaoRelatorio` (domínio, pura — vai para o cliente)

| Campo                  | Tipo             | Regra                                                   |
| ---------------------- | ---------------- | ------------------------------------------------------- |
| `slug`                 | `SlugRelatorio`  | único                                                   |
| `nome`                 | string           | pt-BR, único                                            |
| `grupo`                | `GrupoRelatorio` |                                                         |
| `pergunta`             | string           | uma frase (FR-003)                                      |
| `camposFiltro`         | `CampoFiltro[]`  | `{ nome, rotulo, tipo: 'select' \| 'texto' \| 'numero' \| 'booleano', opcoes? }` — gera o formulário |
| `rota`                 | string           | `/relatorios/${slug}` — fonte da autorização (D3)       |
| `usaPeriodo`           | boolean          | habilita o filtro de período (FR-005)                   |
| `contemDadosSensiveis` | boolean          | exibe aviso LGPD (D10)                                  |
| `avisos`               | string[]         | ex.: validade é da doação; horas ≠ presença (FR-018/28) |

### `DefinicaoRelatorio<F, L>` (aplicação, servidor)

Estende `DescricaoRelatorio` com:

| Campo           | Tipo                                                    | Regra                                                         |
| --------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| `esquemaFiltros`| esquema Zod → `F`                                       | nunca lança; valor inválido de filtro opcional vira ausente   |
| `colunas`       | `Coluna<L>[]` (`planilha.ts`)                           | mesmas para prévia e exportação (D2)                          |
| `contar`        | `(f: F) => Promise<number>`                             | usado antes da exportação (D8) e na paginação                 |
| `carregar`      | `(f: F, pagina?: {page, pageSize}) => Promise<L[]>`     | com `pagina` = prévia; a exportação chama em lotes de 2.000 (streaming, research D8) |
| `resumo?`       | `(f: F) => Promise<ItemResumo[]>`                       | blocos de totais (R-10, R-16, R-07)                           |
| `detalhe?`      | `(l: L) => AlteracaoCampo[]`                            | só R-17 (diff antes/depois)                                   |
| `descreverFiltros` | `(f: F) => { rotulo; valor }[]`                      | alimenta o cabeçalho do arquivo (FR-008)                      |
| `opcoesFiltros?`   | `() => Promise<Record<string, {valor, rotulo}[]>>`    | opções dinâmicas (habilidades, atividades, autores)           |

Invariantes (testadas):

- INV-R1: `slug` e `nome` únicos; `rota === '/relatorios/' + slug`.
- INV-R2: `podeAcessar(rota, 'membro_defesa_civil')` é verdadeiro para todos **exceto**
  `auditoria`; `podeAcessar(rota, 'administrador')` é verdadeiro para todos.
- INV-R3: `podeAcessar(rota, r)` é falso para `coordenador`, `voluntario`, `usuario` (SC-005).
- INV-R4: toda definição com `usaPeriodo` tem `periodo` no esquema de filtros.

---

## 2. Filtros

### `Periodo`

| Campo | Tipo         | Regra                                        |
| ----- | ------------ | -------------------------------------------- |
| `de`  | `AAAA-MM-DD` | ≤ `ate`; não pode ser posterior a hoje (BRT) |
| `ate` | `AAAA-MM-DD` | padrão: hoje (BRT)                           |

Padrão sem parâmetros: `de = hoje − 29 dias`, `ate = hoje`. Atalhos: hoje, 7 dias, 30 dias.
Convertido por `intervaloUtc(periodo)` → `{ inicio: Date; fimExclusivo: Date }` (D6).
Período inválido é **erro de validação** exibido no formulário (edge case), não correção
silenciosa.

### Filtros específicos (parâmetros de URL, todos opcionais)

| Relatório | Filtros além do período |
| --- | --- |
| R-01 | `categoria`, `situacao` (`abaixo` \| `ok`) |
| R-02 | `tipo` (`avulso` \| `kit`), `destino` (texto, contém, sem acento/caixa), `categoria` |
| R-03 | `categoria`, `condicao` |
| R-04 | `categoria` |
| R-05 | `categoria` |
| R-06 | `horizonte` (1–365, padrão 30), `categoria` |
| R-07 | `categoria` |
| R-08 | `categoria` |
| R-09 | `status`, `bairro`, `habilidadeId`, `tipoVeiculo`, `disponibilidade` |
| R-11 | `bairro` |
| R-12 | `atividadeId`, `categoriaAtividadeId`, `statusAtividade`, `apenasComVagas` |
| R-16 | `tipo`, `canal`, `status` |
| R-17 | `entidade`, `acao`, `autorId` |

Paginação da prévia: `page`, `pageSize` (mesmo esquema de `normalizarPaginacao`).

---

## 3. Resultado

### `PaginaRelatorio` (atravessa servidor → cliente)

| Campo        | Tipo                                   | Nota                                      |
| ------------ | -------------------------------------- | ----------------------------------------- |
| `colunas`    | `string[]`                             | cabeçalhos                                |
| `rows`       | `{ celulas: Celula[]; detalhe?: AlteracaoCampo[] }[]` | `Celula = string \| number \| null`, já formatada pt-BR |
| `totalCount` | number                                 | total no filtro                           |
| `page`, `pageSize` | number                           | após clamp                                |
| `resumo`     | `ItemResumo[]`                         | vazio quando não se aplica                |
| `excedeLimiteExportacao` | boolean                    | `totalCount > 50.000` (D8)                |

### `ItemResumo`

`{ rotulo: string; valor: string | number }` — ex.: "Pendentes: 12", "Tempo médio até decisão:
2,4 dias", "Falhas de e-mail: 3".

### `AlteracaoCampo` (R-17)

`{ campo: string; antes: string | null; depois: string | null; tipo: 'alterado' | 'incluido' |
'removido' }`. Valores serializados para texto (objetos/arrays como JSON curto). Em `create`
todos os campos são `incluido`; em `delete`, `removido`.

### `Aba<T>` (extensão de `contingencia/infrastructure/planilha.ts`)

Campos novos opcionais: `cabecalhoDocumento?: { rotulo: string; valor: string }[]`,
`resumo?: ItemResumo[]`. Ausentes ⇒ comportamento atual (pacote de contingência inalterado).

Cabeçalho do documento (FR-008), nesta ordem: Relatório, Período (ou "—"), um par por filtro
aplicado, Gerado em (data/hora BRT), Gerado por (nome da sessão), Total de linhas.

---

## 4. Linhas por relatório (colunas)

| Relatório | Colunas |
| --- | --- |
| R-01 | Item, Categoria, Unidade, Saldo atual, Mínimo aplicado, Origem do mínimo (Próprio/Padrão/Sem alerta), Situação |
| R-02 | Data, Tipo, Destino, Responsável pelo transporte, Item, Categoria, Quantidade, Unidade, Registrado por |
| R-03 | Data, Item, Categoria, Quantidade, Unidade, Condição, Perecível, Validade, Kit de destino, Registrado por |
| R-04 | Data, Item, Categoria, Quantidade, Unidade, Motivo, Registrado por |
| R-05 | Item, Categoria, Unidade, Saldo, Mínimo aplicado, Falta, Falta (%) |
| R-06 | Situação, Validade, Dias até vencer, Item, Categoria, Quantidade recebida, Unidade, Data da entrada |
| R-07 | Item, Categoria, Unidade, Saldo inicial, Entradas, Saídas, Descartes, Saldo final |
| R-08 | Destino, Categoria, Unidade, Quantidade entregue, Nº de saídas |
| R-09 | Nome, CPF, Situação, Telefone, Bairro, Profissão, Habilidades, Veículo próprio, Tipo de veículo, Disponibilidade, Restrições de saúde, Cadastro em, Decisão em |
| R-10 | Nome, Telefone, Bairro, Enviado em, Situação, Decidido em, Dias até decisão / Dias de espera |
| R-11 | Dimensão (Habilidade/Veículo/Disponibilidade), Valor, Voluntários aprovados |
| R-12 | Atividade, Categoria, Local, Situação da atividade, Início, Fim, Vagas, Confirmados, Ocupação (%) |
| R-13 | Participante, CPF, Telefone, Turnos confirmados, Horas escaladas |
| R-14 | Data, Famílias afetadas, Variação famílias, Pessoas afetadas, Variação pessoas, Atualizado por |
| R-15 | Kit, Base de demanda, Proporção, Demanda projetada, Kits montáveis, Déficit, Atendimento (%) |
| R-16 | Data, Tipo, Canal, Situação, Destinatário, Erro |
| R-17 | Data/hora, Assunto, Tabela, Registro, Ação, Autor, Papel do autor, Alterações |

Resumos: R-07 (totais do período), R-10 (pendentes/aprovadas/rejeitadas, tempo médio), R-12
(turnos com vaga, ocupação média), R-16 (totais por canal × situação).

---

## 5. Índices novos (migration)

| Índice                   | Tabela        | Colunas     |
| ------------------------ | ------------- | ----------- |
| `entrada_criado_idx`     | `entrada`     | `criado_em` |
| `descarte_criado_idx`    | `descarte`    | `criado_em` |
| `notificacao_criado_idx` | `notificacao` | `criado_em` |
