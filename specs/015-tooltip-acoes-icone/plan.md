# Implementation Plan: Tooltip em ações de ícone

**Branch**: `015-tooltip-acoes-icone` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-tooltip-acoes-icone/spec.md`

## Summary

O componente `Tooltip` **já existe** sobre o Ark UI e já é exportado pelo barril — só está adotado
em um lugar. E a leitura do primitivo instalado mostrou que a maior parte dos requisitos já é
comportamento padrão dele: Esc dispensa, foco de teclado abre (e clique de mouse não), rolagem
dispensa, camada acima de diálogo já resolvida pela escala de empilhamento do projeto, e **toque
nunca abre a dica** — o zag descarta `pointerType === 'touch'` explicitamente, o que atende a US4
sem uma linha de código.

Sobram **três lacunas reais** e uma adoção.

**Lacuna 1 — anúncio duplicado.** O trigger recebe `aria-describedby` apontando para o conteúdo, e
o `IconButton` exige `aria-label`. Com o mesmo texto nos dois, o leitor de tela lê duas vezes. Os
dois usos existentes na navegação lateral já têm esse defeito hoje. A correção é distinguir os dois
papéis possíveis de uma dica: repetir visualmente o nome acessível (padrão — a dica não é exposta) ou
acrescentar informação (`descricao` — a dica é exposta).

**Lacuna 2 — controle desabilitado.** `<button disabled>` não dispara evento de ponteiro nem recebe
foco; é regra do navegador. Os dois botões que mais precisam explicar sua indisponibilidade
(remover linha de saída, remover componente de kit) são exatamente `disabled`. Entra no `IconButton`
um estado `inativo`: mesma aparência, mas focável e hoverável, com o clique bloqueado no componente.

**Lacuna 3 — largura.** Falta limite de largura com quebra de linha.

**Depois disso, adoção** em oito grupos de controles, começando por corrigir os dois usos atuais.

Nenhuma dependência nova, nenhuma mudança de banco, de rota, de autorização ou de regra de negócio.

## Technical Context

**Language/Version**: TypeScript 5.9 (estrito)

**Primary Dependencies**: React 19.1, Next.js 16.3.0 (App Router), Ark UI 5.38.1
(`@zag-js/tooltip`), Tailwind CSS v4, lucide-react. **Nenhuma dependência nova.**

**Storage**: N/A — a feature não persiste nada.

**Testing**: portões existentes (`tsc --noEmit`, `npm run lint`, `npm test`) + roteiro manual de
[quickstart.md](./quickstart.md). Sem teste automatizado novo — justificativa em `research.md` D10.

**Target Platform**: navegadores desktop (ponteiro + teclado) e móveis (toque). O comportamento
difere por plataforma **por design**, então a validação exige as duas.

**Project Type**: monolito modular Next.js; a feature vive no design system compartilhado
(`src/shared/ui/`) e em telas de `app/(interno)/`.

**Performance Goals**: N/A — não há caminho de dados. Restrição relacionada: o atraso de 300 ms
antes de abrir existe para que atravessar uma fileira de botões não dispare uma sequência de dicas.

**Constraints**: interface 100% pt-BR; a dica nunca é o único canal de informação (não há hover em
toque); contraste e alvo de toque nos padrões do design system; nenhuma tela importa o primitivo do
Ark diretamente.

**Scale/Scope**: 2 arquivos do design system alterados, 8 sítios de adoção em 8 arquivos, 1 vitrine,
1 documento de design system. 0 arquivos novos, 0 removidos, 0 migrações, 0 rotas.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio | Avaliação | Status |
| --- | --- | --- |
| **I. Clean Architecture por Módulo** | Feature inteiramente de apresentação. Não toca `domain`, `application` nem `infrastructure` de módulo algum. As telas de `app/(interno)/` alteradas só ganham um envoltório visual em controles que já existiam; nenhuma passa a chamar caso de uso novo. | ✅ PASS |
| **II. Tipagem Estrita e Qualidade** | Sem `any`. Props em pt-BR (`conteudo`, `posicao`, `descricao`, `inativo`), coerentes com o restante do design system. Todos os textos de interface em pt-BR e, na maioria, reaproveitados dos `aria-label` existentes em vez de redigidos de novo. | ✅ PASS |
| **III. Testes Focados em Regras de Negócio** | A feature **não tem** regra de negócio, entidade nem caso de uso — o princípio dispensa cobertura exaustiva em apresentação. O que haveria a testar exige DOM renderizado, e o projeto não tem biblioteca de teste de componente instalada; adicioná-la seria dependência nova sem necessidade comprovada. A verificação é o roteiro de `quickstart.md`, com R5 (toque) e R6 (leitor de tela) bloqueantes. Decisão registrada em `research.md` D10, com a alternativa nomeada e explicitamente adiada. | ✅ PASS |
| **IV. Segurança e Defesa em Profundidade** | Nenhuma mudança de sessão, rota, role ou autorização. Ponto de atenção tratado: `inativo` **não** é mecanismo de autorização — é comunicação de estado da interface. As condições que hoje desabilitam cada botão permanecem idênticas (`contracts/adocao-telas.md` A-05); nenhuma ação passa a ser possível onde não era. | ✅ PASS |
| **V. Auditoria Não Bloqueante** | Não se aplica — a feature não escreve em Voluntariado, Estoque ou Atividade. Exibir uma dica não é escrita. | ✅ PASS |
| **VI. Simplicidade Operacional** | Zero dependência nova. O componente existente é **reusado**, não substituído (D1). Metade dos requisitos é atendida por comportamento que já vem pronto, e isso está documentado justamente para que a implementação não o reescreva (D2). Duas decisões de "não escrever" ficam registradas: sem animação (D6) e sem biblioteca de teste (D10). `inativo` convive com `disabled` em vez de migrar toda a base. | ✅ PASS |

**Gate result**: aprovado, sem violações. `Complexity Tracking` não se aplica.

**Re-avaliação pós-Fase 1**: o design não introduziu nenhum mecanismo além dos três previstos, e
encolheu o escopo em relação à leitura inicial da spec — o inventário fechado de A-01..A-06 tem 11
arquivos e nenhum arquivo novo. O único ponto que mereceu atenção extra foi o `inativo`, que cria um
controle focável que não age: mitigado por regra de contrato (C-03: só com dica que explique o
motivo) e por manter `disabled` como padrão. Gates mantidos.

## Project Structure

### Documentation (this feature)

```text
specs/015-tooltip-acoes-icone/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — D1..D10, verificados no pacote instalado
├── data-model.md        # Fase 1 — papéis da dica, estados do controle, vocabulário dos textos
├── quickstart.md        # Fase 1 — roteiro de validação (26 itens; R5 e R6 bloqueantes)
├── contracts/
│   ├── tooltip.md            # Contrato do componente e do estado `inativo`
│   └── adocao-telas.md       # Inventário fechado dos sítios de adoção
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/shared/ui/
├── tooltip/tooltip.tsx              # + `descricao`, largura máxima com quebra
├── icon-button/icon-button.tsx      # + estado `inativo`
├── theme/theme-toggle.tsx           # + dica
└── shell/
    ├── topbar.tsx                   # + dica (abrir navegação, sair)
    └── sidebar-nav.tsx              # CORRIGE os 2 usos atuais (anúncio duplicado)

app/(interno)/
├── sino-notificacoes.tsx                        # + dica
├── design-system/galeria.tsx                    # vitrine das variações
└── (staff)/
    ├── admin/tabela-usuarios.tsx                # + dica por linha
    ├── atividades/[id]/painel-escala.tsx        # + dicas (alocar, remover do turno)
    └── estoque/
        ├── saida/saida-form.tsx                 # disabled → inativo + dica explicativa
        └── kits/gestao-kits.tsx                 # disabled → inativo + dica explicativa

spec/DESIGN_SYSTEM.md                            # §4.10 — papéis da dica e regra do `inativo`
```

**Structure Decision**: nada de novo é criado. O componente permanece onde está, o estado novo
entra no `IconButton` que já é seu dono, e as telas apenas consomem. `theme-toggle.tsx` e o botão de
recolher da `sidebar-nav.tsx` continuam sendo `<button>` próprios — o `Tooltip` envolve qualquer
elemento, e convertê-los para `IconButton` seria mexer no que não precisa mudar.

## Ordem de execução sugerida

1. **`tooltip.tsx`** — `descricao` e largura máxima. Sem isso, adotar propagaria o anúncio duplicado.
2. **`icon-button.tsx`** — estado `inativo`.
3. **`sidebar-nav.tsx`** — corrigir os dois usos existentes. É a menor mudança que já valida o
   passo 1 num caso real.
4. **`topbar.tsx`, `theme-toggle.tsx`, `sino-notificacoes.tsx`** — presentes em toda tela interna;
   entregam a US1 de uma vez em todo o sistema.
5. **`tabela-usuarios.tsx`, `painel-escala.tsx`** — o caso em que o texto nomeia o registro.
6. **`saida-form.tsx`, `gestao-kits.tsx`** — os dois casos de `inativo`; entregam a US3.
7. **`galeria.tsx` e `DESIGN_SYSTEM.md`** — vitrine e registro do padrão (US5).
8. **Validação** — roteiro de `quickstart.md`, incluindo aparelho de toque e leitor de tela.

Os passos 1–5 entregam o MVP (US1 + US2 + US4, esta última por não-regressão). O passo 6 entrega a
US3; o 7, a US5.

## Dependência entre as histórias

US1 e US2 são o mesmo mecanismo visto por dois meios de entrada — saem juntas, não há como entregar
uma sem a outra.

US3 **depende** do passo 2, e a razão é mecânica, não de preferência: enquanto o botão usar
`disabled` nativo, nenhum ajuste no tooltip fará a dica aparecer, porque o navegador não entrega o
evento. Tentar a US3 antes do `inativo` produziria a impressão de que o tooltip está quebrado.

US4 não é construída — é **preservada**. Ela vale como portão de não-regressão (R5 do roteiro), e é
por isso que nenhum requisito depende da dica para a tarefa ser possível.

US5 é independente e pode ser adiada sem prejuízo às demais.

## Complexity Tracking

Não aplicável — Constitution Check passou sem violações.
