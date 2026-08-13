# Data Model: Menu Mobile/Tablet Abaixo do Topbar

**Feature**: [spec.md](./spec.md)

## Entidades

Nenhuma. A feature reorganiza a apresentação de destinos de navegação já existentes (`ItemNavegacao`, `SecaoNavegacao`, ambos em `src/shared/auth/navegacao.ts`) — não introduz, altera nem persiste dados novos.

## Estado de apresentação

| Estado | Onde vive | Efeito nesta feature |
|--------|-----------|------------------------|
| `menuAberto: boolean` | `AppShell` (`useState`, inalterado em forma) | Passa a alimentar `useMenu({ open: menuAberto, onOpenChange })` (research.md D3), além de continuar controlando o ícone/`aria-expanded` do botão em `Topbar`. Mesmo dado, agora com um segundo consumidor (o painel Ark Menu). |
| Estado interno do Ark Menu (highlight do item focado, posição calculada) | Dentro do `store` retornado por `useMenu` | Novo, mas inteiramente gerenciado pelo primitivo Ark — não é estado de aplicação, não precisa ser modelado ou persistido. |

Nenhum novo campo, prop obrigatória de domínio ou transição de estado de negócio é introduzido. `ItemNavegacao.href` passa a ser também o `value` de cada `Menu.Item` (identificador de item exigido pelo primitivo) — reaproveita um campo já existente, não cria um novo.
