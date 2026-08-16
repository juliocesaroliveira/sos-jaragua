# Data Model — Navegação lateral responsiva

**Feature**: `013-navegacao-lateral-responsiva` | **Data**: 2026-08-16

## Alteração de esquema

**Nenhuma.** A feature não cria, altera nem remove tabela, coluna, índice ou enum. Não há migração
a gerar nem a aplicar, e nenhum dado novo trafega entre servidor e navegador.

O único estado novo é uma preferência de interface, guardada no navegador da pessoa.

## Entidades

### Preferência de apresentação da coluna (nova)

Escolha do usuário sobre como a coluna de navegação se apresenta em telas grandes.

| Aspecto | Valor |
| --- | --- |
| Valores possíveis | `expandida` \| `recolhida` |
| Padrão, sem valor gravado | `expandida` (FR-017) |
| Onde vive | `localStorage` do navegador |
| Escopo | Por navegador e por dispositivo — **não** acompanha o usuário |
| Influencia autorização? | **Não** |
| Viaja para o servidor? | **Não** |

**Por que não é dado de negócio**: não descreve nada sobre a operação nem sobre a pessoa; é
configuração de conforto visual. Perdê-la ao trocar de navegador é aceitável e está declarado nas
Assumptions da spec. Guardá-la no perfil exigiria escrita no banco a cada clique de um controle
de layout — desproporcional.

**Normalização obrigatória na leitura**: qualquer valor que não seja exatamente `expandida` ou
`recolhida` — ausente, corrompido, escrito por versão futura — resolve para `expandida`. É a
única lógica pura da feature e a única que recebe teste unitário.

### Destino de navegação (existente, inalterado)

Rótulo, ícone, endereço e grupo. Definido em `src/shared/auth/navegacao.ts`. Continua chegando ao
navegador **já filtrado por perfil no servidor** — nenhum destino fora do perfil é serializado
(FR-024).

### Grupo de navegação (existente, inalterado)

Sete grupos (Início, Minha conta, Voluntariado, Operação, Estoque, Coordenação, Administração),
usados só para legibilidade. Não carregam permissões próprias.

## Estados de layout

### E1 — Regiões de rolagem

| Região | Rola verticalmente? | Condição |
| --- | --- | --- |
| Documento (conteúdo da página) | **Sim** — é a rolagem principal | Sempre |
| Coluna lateral | Sim, internamente | Só quando os destinos excedem a altura da janela |
| Gaveta aberta | Sim, internamente, com contenção | Só quando os destinos excedem a altura da gaveta |
| Tabelas largas | **Horizontal apenas** | Já existente, preservado |

A regra que FR-001 impõe é: **nunca duas barras verticais disputando o mesmo conteúdo**. Coluna e
gaveta são landmarks próprios com conteúdo próprio; não competem com o conteúdo da página.

### E2 — Formas de navegação por tamanho de tela

| Faixa | Forma | Estado |
| --- | --- | --- |
| Abaixo de `lg` | Gaveta lateral esquerda | Fechada por padrão; abre pelo botão da topbar |
| `lg` e acima | Coluna fixa | `expandida` ou `recolhida`, conforme a preferência |

**Exclusividade mútua**: exatamente uma forma está ativa em qualquer largura. Ao cruzar o limiar
com a gaveta aberta, ela fecha — nunca as duas visíveis, nunca nenhuma.

**Perfil sem destinos**: nenhuma das duas é oferecida, e nenhuma largura é reservada.
Comportamento atual, preservado.

### E3 — Transições da gaveta

```
fechada ──(botão de navegação)──> aberta
aberta  ──(destino escolhido)───> fechada + navegação
aberta  ──(fundo, Esc, voltar)──> fechada, sem navegar
aberta  ──(largura cruza lg)────> fechada
aberta  ──(sessão expira)───────> fechada + redireciona ao login
```

### E4 — Transições da coluna

```
expandida ──(controle de recolher)──> recolhida  + grava preferência
recolhida ──(controle de expandir)──> expandida  + grava preferência
```

A gravação é imediata e local; não há estado intermediário nem confirmação.

## Regras

### R1 — A rolagem de fundo depende da rolagem ser do documento

O travamento de rolagem de fundo (FR-003) é fornecido pelo primitivo de diálogo e age sobre o
**documento**. Enquanto o conteúdo rolar dentro de um contêiner interno, o travamento não tem
efeito — que é exatamente o defeito atual.

Consequência: **FR-003 só é atendido depois de FR-002**. Não é ordem de conveniência.

### R2 — Aplicação da preferência antes da hidratação

A preferência é aplicada ao documento por script inline no `<head>`, antes de qualquer
JavaScript de aplicação, seguindo o padrão já usado pelo tema.

Sem isso, a coluna renderiza expandida no HTML do servidor e salta para recolhida após a
hidratação — um salto de largura em toda navegação, pior que não ter a funcionalidade.

Corolário: o estado inicial no React **não** pode ser lido do armazenamento no inicializador —
isso causaria divergência de hidratação. O documento já carrega a preferência aplicada; o estado
do React sincroniza depois, como o tema faz.

### R3 — Nome acessível e dica visual são coisas distintas

Na coluna recolhida:

- **Dica visual** ao apontar ou focar o ícone → atende FR-018.
- **Nome acessível textual sempre presente** → atende FR-019.

Uma não substitui a outra. Dica visual não é nome acessível e não aparece em toque; um ícone sem
texto associado é anunciado como link sem nome.

### R4 — Entrada de histórico é empilhada e desempilhada em par

Abrir a gaveta empilha uma entrada de histórico, para que o gesto de voltar a feche (FR-008).
Fechar por qualquer outro caminho **desempilha** a entrada.

Sem o par completo, o histórico acumula entradas e o usuário precisa apertar voltar duas vezes
para sair da tela.

### R5 — Identificação da aplicação em todos os estados

A identificação precisa estar visível em: telas pequenas com a gaveta fechada, telas pequenas com
a gaveta aberta, coluna expandida e **coluna recolhida**.

O último caso é o que hoje não existiria: a topbar esconde a identificação em telas grandes
porque a coluna expandida a exibe. Com a coluna recolhida, nenhuma das duas mostraria.

## Impacto em tipos existentes

| Tipo / símbolo | Arquivo | Mudança |
| --- | --- | --- |
| `DrawerProps.lado` | `src/shared/ui/drawer/drawer.tsx` | `'bottom' \| 'right'` → `+ 'left'` |
| `TopbarProps` | `src/shared/ui/shell/topbar.tsx` | perde `menuAberto`; ganha o disparo de abertura da gaveta |
| `Topbar` | idem | deixa de encaminhar `ref` (a âncora do menu deixa de existir) |
| `SidebarNavProps` | `src/shared/ui/shell/sidebar-nav.tsx` | ganha o estado de apresentação |
| `MenuMobileProps` | `src/shared/ui/shell/menu-mobile.tsx` | **removido com o arquivo** |
| `ItemNavegacao`, `GRUPOS` | `src/shared/auth/navegacao.ts` | **inalterados** |
