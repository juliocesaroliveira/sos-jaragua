# Phase 1 — Modelo de Dados

**Feature**: Página Padrão de Endereço Não Encontrado (404)
**Data**: 2026-08-12

> **Nenhuma tabela é criada, alterada ou removida, e nenhuma consulta nova é introduzida.** A feature é inteiramente de apresentação. O que existe para modelar são os **estados de apresentação** e o que cada um pode ler — que é onde mora o risco de vazamento (FR-009/FR-015).

---

## Estados de apresentação

A página tem exatamente dois estados, decididos no servidor a partir da sessão (FR-010).

### `ComSessao`

| Aspecto | Valor |
|---------|-------|
| Condição | `obterSessao()` retorna um ator |
| Envoltório | Shell da aplicação — barra superior + menu lateral |
| Dados lidos | `nome`, `role`, `rotuloRole`, `userId` (para o sino), itens de navegação do perfil |
| Destino do botão | `AREA_PADRAO` (`/`) |
| Origem | URL desconhecida com sessão válida (US1); `notFound()` na área autenticada (US3) |

### `SemSessao`

| Aspecto | Valor |
|---------|-------|
| Condição | `obterSessao()` retorna `null` |
| Envoltório | **Nenhum** — conteúdo direto sob o root layout |
| Dados lidos | **nenhum**. Sem consulta, sem identidade, sem itens de navegação |
| Destino do botão | `ROTA_PUBLICA` (`/login`) |
| Origem | Caminhos onde o gate de sessão não roda (ver nota da spec) |

**Invariante de vazamento**: o estado `SemSessao` não recebe `ator` nem lista de itens — não por convenção, mas porque o componente de conteúdo simplesmente não tem essa entrada. Não há como o menu ou o nome do usuário chegarem a essa variante, o que torna FR-009 uma propriedade estrutural em vez de uma regra a lembrar.

---

## Resolução: qual fronteira atende cada origem

| Origem | Fronteira | Shell vem de |
|--------|-----------|--------------|
| URL desconhecida, com sessão | `app/not-found.tsx` | a própria fronteira, via `ShellAutenticado` |
| URL desconhecida, sem sessão | `app/not-found.tsx` | — (nenhum) |
| `notFound()` sob `(interno)` | `app/(interno)/not-found.tsx` | `(interno)/layout.tsx`, já na árvore |

Ver research.md D1 para por que as duas fronteiras são necessárias.

---

## O que esta página **não** é

Distinção que a implementação precisa preservar (FR-016, SC-006):

| Situação | Resposta | Onde é decidida |
|----------|----------|-----------------|
| Endereço **não existe** | esta página | fronteira `not-found` |
| Endereço existe, perfil **sem permissão** | `/sem-permissao` | `proxy.ts` e `exigirRoles` |
| **Sem sessão** em rota protegida | `/login?redirecionar=…` | `proxy.ts` e `exigirSessao` |

Reaproveitar esta página para o segundo caso diria a alguém que a área não existe quando ela existe — e, para quem tem permissão parcial, mudaria o significado do que vê. Nenhuma das três decisões acima é alterada por esta feature.

---

## Funções derivadas

### `destinoDeRetorno(temSessao: boolean): string`

Pura, sem I/O, testável em `npm test`.

| Entrada | Saída | Requisito |
|---------|-------|-----------|
| `true` | `AREA_PADRAO` (`'/'`) | FR-012 |
| `false` | `ROTA_PUBLICA` (`'/login'`) | FR-013 |

**Regra a travar por teste**: qualquer que seja a entrada, o destino MUST ser alcançável por quem o receberá — com sessão, `/` é acessível a todos os cinco perfis; sem sessão, `/login` é a única rota que dispensa sessão. É o que garante SC-004 (o botão nunca leva a nova negativa).

---

## Transições de estado

Não há estado persistido nem transição própria. A apresentação é derivada da sessão **no momento da renderização** — o caso de borda "sessão encerrada entre a navegação e a exibição" (spec) se resolve sozinho: a leitura acontece durante o render, então reflete o estado corrente, nunca o anterior.
