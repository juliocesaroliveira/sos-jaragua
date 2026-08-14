# Data Model: Topbar Fixo Durante a Rolagem

**Feature**: [spec.md](./spec.md)

## Entidades

Nenhuma. A feature é puramente estrutural/visual (layout do shell autenticado) — não introduz, altera nem persiste dados de domínio.

## Estado de apresentação (já existente, inalterado)

O único estado envolvido já existe hoje e não muda de forma:

| Estado                | Onde vive               | Efeito nesta feature                                                                                                                                                                                                                                                      |
| --------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `menuAberto: boolean` | `AppShell` (`useState`) | Continua controlando a visibilidade da gaveta mobile de `SidebarNav`. Com o contêiner de altura travada (research.md D1/D2), abrir a gaveta passa a encolher a área de rolagem de `<main>` em vez de aumentar a altura da página — mesma variável, novo efeito de layout. |

Nenhum novo campo, prop obrigatória ou transição de estado é introduzido.
