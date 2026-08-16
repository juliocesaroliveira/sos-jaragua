# Implementation Plan: Navegação lateral responsiva

**Branch**: `013-navegacao-lateral-responsiva` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-navegacao-lateral-responsiva/spec.md`

## Summary

Três mudanças, nesta ordem obrigatória.

**Primeiro, a rolagem.** `app-shell.tsx` deixa de ser uma caixa travada na altura da janela com o
conteúdo rolando por dentro; quem rola passa a ser a página. Topbar e coluna viram `sticky`. Isso
sozinho devolve o recolher da barra de endereço no celular e elimina as barras duplas — e é
pré-requisito para o resto, porque o travamento de rolagem de fundo do diálogo age sobre o
documento, não sobre o `<main>`.

**Depois, a gaveta.** O painel construído sobre o menu de ações do Ark é removido inteiro, junto
com a fiação de âncora que existia só para posicioná-lo. No lugar entra uma gaveta lateral
esquerda sobre o `Drawer` que o projeto já tem, acrescido de um lado `left`. Contenção de foco,
travamento de fundo, restauração de foco, Esc e clique-fora vêm dos padrões do primitivo — nada
disso precisa ser escrito.

**Por fim, a coluna recolhível.** Um controle alterna entre rótulos e trilha de ícones, com a
escolha persistida e aplicada por script inline no `<head>`, exatamente como o tema já faz — sem
isso a coluna saltaria de largura a cada navegação.

Nenhuma mudança de banco, de autorização, de rotas ou do catálogo de destinos.

## Technical Context

**Language/Version**: TypeScript 5.9 (estrito)

**Primary Dependencies**: Next.js 16.3.0 (App Router, `cacheComponents`), React 19.1,
Ark UI 5.38 (`Dialog` via `Drawer`, `Tooltip`), Tailwind CSS v4. **Nenhuma dependência nova.**

**Storage**: `localStorage` do navegador, para a preferência de apresentação da coluna. **Nenhuma
mudança de banco de dados.**

**Testing**: Vitest — `npm test`. A feature é quase toda apresentação e layout; a lógica pura
testável é a leitura/normalização da preferência.

**Target Platform**: navegadores móveis (Android/iOS) e desktop; a feature é sobre comportamento
de viewport, então a validação real é em aparelho e em janela redimensionável

**Project Type**: Monolito modular Next.js; a navegação vive no design system compartilhado
(`src/shared/ui/shell/`)

**Performance Goals**: gaveta pronta em menos de 300 ms (SC-005); nenhuma repintura de largura
após a hidratação (D7); nenhuma regressão de rolagem nas telas de operação

**Constraints**: uma única região de rolagem para o conteúdo (FR-001); sem dependência nova;
destinos, grupos e filtragem por perfil intocados (FR-023/FR-024); contraste e alvos de toque nos
padrões do design system; interface 100% pt-BR

**Scale/Scope**: 5 arquivos do shell, 1 do design system (`drawer.tsx`), 1 de layout raiz
(script inline); 1 arquivo removido; 0 migrações; 0 rotas novas

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio | Avaliação | Status |
| --- | --- | --- |
| **I. Clean Architecture por Módulo** | A feature é inteiramente de apresentação compartilhada (`src/shared/ui/shell/` e `src/shared/ui/drawer/`). Não toca `domain`, `application` nem `infrastructure` de nenhum módulo. A fonte da estrutura de navegação continua sendo `src/shared/auth/navegacao.ts`, consumida como hoje. | ✅ PASS |
| **II. Tipagem Estrita e Qualidade** | Sem `any`. Nomes em pt-BR (`GavetaNavegacao`, `preferenciaColuna`). Nenhum texto de interface novo além do rótulo da gaveta e do controle de recolher, ambos em pt-BR. Commits Conventional. | ✅ PASS |
| **III. Testes Focados em Regras de Negócio** | A feature **não adiciona regra de negócio** — é layout e comportamento de viewport, que a constituição não exige cobrir exaustivamente. A única lógica pura (normalizar a preferência lida do armazenamento, com padrão para valor ausente ou inválido) recebe teste unitário. O resto é verificado pelo roteiro de validação, que é o instrumento adequado: barra de endereço recolhendo e foco contido não se testam sem navegador. | ✅ PASS |
| **IV. Segurança e Defesa em Profundidade** | Nenhuma mudança de autorização, rota ou sessão. Os destinos continuam chegando **já filtrados do servidor** (FR-024) — esconder item de menu segue sendo ergonomia, não autorização, como o próprio `app-shell.tsx` documenta. A preferência de coluna não influencia o que o usuário pode acessar. | ✅ PASS |
| **V. Auditoria Não Bloqueante** | Não se aplica — a feature não escreve nada em Voluntariado, Estoque ou Atividade. | ✅ PASS |
| **VI. Simplicidade Operacional** | Zero dependência nova. A gaveta **reusa** o `Drawer` existente em vez de duplicar um segundo componente de painel lateral (D4), e a persistência **reusa** o padrão de script inline já validado pelo tema (D7). O saldo de código é negativo: um componente é removido e a fiação de âncora entre topbar e menu desaparece (D9). Três decisões de "não escrever" ficam registradas (D5). | ✅ PASS |

**Gate result**: aprovado, sem violações. `Complexity Tracking` não se aplica.

**Re-avaliação pós-Fase 1**: o design confirmou o saldo negativo de código e não introduziu
nenhum mecanismo além do previsto. O único ponto que mereceu atenção extra foi a manipulação de
histórico para o fechamento por gesto de voltar (D6) — autorizada explicitamente pela
documentação do Next instalado, com degradação definida caso se mostre instável. Gates mantidos.

## Project Structure

### Documentation (this feature)

```text
specs/013-navegacao-lateral-responsiva/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — D1..D10 e riscos residuais
├── data-model.md        # Fase 1 — preferência, estados de layout, regras
├── quickstart.md        # Fase 1 — roteiro de validação (majoritariamente manual, por natureza)
├── contracts/
│   ├── arquitetura-rolagem.md   # Contrato da rolagem e do layout do shell
│   ├── gaveta-navegacao.md      # Contrato da navegação em telas pequenas
│   └── coluna-recolhivel.md     # Contrato da navegação em telas grandes
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
app/
└── layout.tsx                          # + script inline da preferência de coluna

src/shared/ui/
├── drawer/drawer.tsx                   # + lado 'left'
└── shell/
    ├── app-shell.tsx                   # rolagem de página; remove useMenu/RootProvider
    ├── topbar.tsx                      # sticky; botão comum no lugar do Ark.Trigger
    ├── sidebar-nav.tsx                 # sticky; estados expandida/recolhida
    ├── gaveta-navegacao.tsx            # NOVO — navegação de telas pequenas
    ├── preferencia-coluna.ts           # NOVO — script inline, leitura e normalização
    ├── preferencia-coluna.test.ts      # NOVO — única lógica pura da feature
    └── menu-mobile.tsx                 # REMOVIDO
```

**Structure Decision**: tudo permanece em `src/shared/ui/shell/`, onde a navegação já vive. A
gaveta entra ao lado dos outros componentes do shell em vez de virar um módulo próprio — é a
mesma responsabilidade que `menu-mobile.tsx` tinha, com implementação diferente. `drawer.tsx`
ganha um lado novo por ser o dono do primitivo.

## Ordem de execução sugerida

1. **Rolagem** — `app-shell.tsx` e `topbar.tsx` (sticky). Entrega a US1 inteira, sozinha.
2. **Lado `left`** no `Drawer`.
3. **Gaveta** — componente novo, ligação no shell, remoção do `menu-mobile.tsx` e da fiação de
   âncora.
4. **Preferência** — script inline, leitura normalizada e teste.
5. **Coluna recolhível** — dois estados, controle de alternância, dica e nome acessível.
6. **Validação** — roteiro do `quickstart.md`, em aparelho real e em janela redimensionável.

Os passos 1–3 entregam o MVP (US1 + US2). Os passos 4–5 entregam a US3.

## Dependência entre as histórias — não é preferência de ordem

A US2 **depende** da US1 para atender FR-003, e a razão é mecânica: o travamento de rolagem de
fundo do diálogo age sobre o **documento**. Hoje esse travamento já está ativo no menu atual e
mesmo assim o fundo rola, porque quem rola é o `<main>`. Construir a gaveta antes de corrigir a
rolagem reproduziria o mesmo defeito com um componente novo — e daria a impressão de que a gaveta
é que está com problema.

A US3 é independente das outras duas e pode ser adiada sem prejuízo.

## Complexity Tracking

Não aplicável — Constitution Check passou sem violações.
