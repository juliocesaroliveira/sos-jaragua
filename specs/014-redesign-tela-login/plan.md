# Implementation Plan: Redesign da Tela de Login

**Branch**: `014-redesign-tela-login` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-redesign-tela-login/spec.md`

## Summary

Reconstruir a apresentação de `/login` — hoje uma coluna estreita com título, parágrafo e três
botões — como uma composição imersiva no desktop (fotografia em tela cheia, scrim de contraste,
cartão de acesso translúcido) e uma coluna sólida e leve no mobile, sem alterar uma linha do
comportamento de autenticação. Junto vem um componente `Password` compartilhado do design
system, sobre o `PasswordInput` do Ark UI, com alternância de visibilidade por ícone.

A abordagem técnica, detalhada em [research.md](./research.md), gira em torno de três decisões:

1. **A imagem não participa do cálculo de contraste** (D3). Todo texto fica sobre token de
   superfície ou sobre scrim de opacidade mínima garantida; a translucidez do cartão é efeito
   de borda, não transparência de leitura. Trocar a foto depois não reabre a auditoria.
2. **A fotografia é um _drop-in_ posterior** (D2). A camada de fundo é um componente com
   gradiente de marca sempre presente e foto opcional por cima. Tudo é construído e
   verificável antes de o arquivo existir — que é o único insumo que o repositório ainda não
   tem.
3. **O gatilho de visibilidade do Ark precisa de correção de acessibilidade** (D6). O Zag emite
   `tabIndex: -1` e nenhum manipulador de teclado; a FR-033 exige o contrário.

## Technical Context

**Language/Version**: TypeScript 5.9 estrito, React 19.1, Next.js 16.3 (App Router, Turbopack)

**Primary Dependencies**: `@ark-ui/react` 5.38 (`PasswordInput`), Tailwind CSS v4,
`lucide-react` (ícones `Eye`/`EyeOff`), `react-hook-form` + `zod` (já em uso no formulário),
`next/image` (import estático)

**Storage**: N/A — a feature não lê nem escreve dados. Consome sessão e parâmetros de URL já
existentes.

**Testing**: sem testes automatizados nesta feature (D10 — o repositório não tem harness de UI:
`vitest.config.ts` é `environment: 'node'`, `include: ['src/**/*.test.ts']`). Verificação por
roteiro manual em [quickstart.md](./quickstart.md) mais `tsc --noEmit`, `eslint`,
`prettier --check` e `next build`.

**Target Platform**: navegadores atuais de desktop; navegadores padrão de Android e iOS.
Aplicação instalável (PWA) — a tela de login é a primeira coisa que o atalho de tela inicial
abre.

**Project Type**: aplicação web monolítica modular (Next.js App Router)

**Performance Goals**: tela operável em até 2s em 3G, **sem contar a fotografia** (SC-006); o
total transferido até a tela ficar operável precisa ficar **abaixo** do que a versão atual
transfere (SC-006a); deslocamento cumulativo de layout imperceptível.

**Constraints**: sem rolagem horizontal de 320px a 2560px; contraste AA (4.5:1 / 3:1) nos dois
temas; alvos de toque de 44×44px; operável a 200% de zoom; movimento reduzido respeitado;
interface 100% pt-BR.

**Scale/Scope**: 1 rota redesenhada, 1 componente novo de design system, 2 componentes novos de
apresentação da tela, 1 ativo de imagem pendente. Sem mudança de esquema, de API ou de módulo
de domínio.

## Constitution Check

_GATE: avaliado antes da Phase 0 e reavaliado após a Phase 1._

| Princípio | Avaliação | Situação |
| --- | --- | --- |
| **I. Clean Architecture por Módulo** | A feature é inteiramente `presentation` + `shared/ui`. Não toca `domain`, `application` nem `infrastructure`; não cria módulo novo nem acessa dados de outro módulo. A camada mais fina continua fina — o `page.tsx` só lê sessão e redireciona. | ✅ Passa |
| **II. Tipagem Estrita e Qualidade** | TypeScript estrito, sem `any`. Componentes seguem a convenção de pasta da DESIGN_SYSTEM.md §5 (`src/shared/ui/password/password.tsx`). Todo texto em pt-BR, inclusive os rótulos do gatilho. Commits em Conventional Commits. | ✅ Passa |
| **III. Testes Focados em Regras de Negócio** | Nenhuma regra de negócio é tocada, então o TDD obrigatório de `domain`/`application` não se aplica. `presentation` é fina por design e não exige cobertura exaustiva — o próprio princípio diz isso. Ver D10 para por que não se introduz harness de UI aqui. | ✅ Passa, com ressalva registrada |
| **IV. Segurança e Defesa em Profundidade** | O fluxo de autenticação é preservado integralmente (FR-021 a FR-027). A mensagem genérica de credenciais inválidas continua genérica (FR-024). A alternância de visibilidade é local ao navegador e não altera transporte, cookie nem sessão. Nenhuma rota nova, nenhum mapa de roles tocado. | ✅ Passa |
| **V. Auditoria Não Bloqueante** | Nenhuma escrita em Voluntariado, Estoque ou Atividade. Não se aplica. | ✅ N/A |
| **VI. Simplicidade Operacional** | Zero dependências novas — o `PasswordInput` já vem no `@ark-ui/react` instalado. Nenhum serviço, cache ou armazenamento externo. As decisões arquiteturais estão registradas aqui e em `research.md` **antes** do código, como o princípio exige. | ✅ Passa |

**Fluxo de Desenvolvimento**: a exigência de "responsividade mobile e clareza sob estresse como
requisito de aceitação, não refinamento posterior" é o núcleo da US2 e das FR-007 a FR-011 —
está no caminho crítico, não no fim da fila.

**Violações a justificar**: nenhuma. A seção Complexity Tracking fica vazia.

## Project Structure

### Documentation (this feature)

```text
specs/014-redesign-tela-login/
├── plan.md              # Este arquivo
├── spec.md              # Especificação (fase anterior)
├── research.md          # Phase 0 — decisões técnicas (D1 a D13)
├── data-model.md        # Phase 1 — estado de UI (a feature não tem entidades de dados)
├── quickstart.md        # Phase 1 — roteiro de verificação manual
├── checklists/
│   └── requirements.md  # Checklist de qualidade da spec
├── contracts/
│   ├── password.md      # Contrato do componente de design system
│   └── tela-login.md    # Contrato de composição da tela
└── tasks.md             # Phase 2 — gerado por /speckit-tasks, NÃO por este comando
```

### Source Code (repository root)

```text
src/shared/ui/
├── password/
│   └── password.tsx          # NOVO — componente de design system (FR-029 a FR-036)
├── campo/campo.tsx           # reutilizado sem alteração (moldura, ids, faixa de mensagem)
├── logo/logo.tsx             # reutilizado; ganha o tamanho usado na composição
├── cn.ts                     # reutilizado (ANEL_FOCO, ALTURA_POR_TAMANHO)
└── index.ts                  # ALTERADO — exporta Password

app/(publico)/login/
├── page.tsx                  # ALTERADO — nova composição, mesma lógica de sessão
├── login-form.tsx            # ALTERADO — adota Password; lógica de auth intocada
├── fundo-login.tsx           # NOVO — camada de fundo (gradiente + foto opcional)
└── painel-marca.tsx          # NOVO — bloco institucional (marca, nome, mensagem)

app/(interno)/design-system/
└── galeria.tsx               # ALTERADO — Password entra na galeria de validação

public/login/
├── fundo-login.jpg           # PENDENTE — ativo externo (ver D2)
└── PROCEDENCIA.md            # PENDENTE — origem e licença da imagem (FR-006g)

spec/DESIGN_SYSTEM.md         # ALTERADO — §4.2 e §5 passam a documentar o Password
```

**Structure Decision**: a feature respeita a separação já vigente no repositório — componentes
reutilizáveis em `src/shared/ui/<componente>/<componente>.tsx` (um por pasta,
DESIGN_SYSTEM.md §5) e componentes específicos da tela colocalizados na própria rota, como
`login-form.tsx` já faz hoje. `fundo-login.tsx` e `painel-marca.tsx` ficam em
`app/(publico)/login/` porque são composição desta tela e de mais nenhuma; se a tela de
cadastro vier a compartilhá-los, a promoção para `src/shared/ui/` é o passo seguinte — não
antecipado agora (Princípio VI).

## Phase 0 — Outline & Research

Concluída. Saída: [research.md](./research.md), com 13 decisões registradas.

Achados que mudam o trabalho, em ordem de impacto:

- **D6 — o gatilho de visibilidade do Ark não é acessível por teclado.** `getVisibilityTriggerProps()`
  do `@zag-js/password-input` emite `tabIndex: -1` e só trata `onPointerDown`. A correção é
  `tabIndex={0}` mais `onKeyDown`; **não** `onClick`, porque o `preventDefault()` do Zag no
  `pointerdown` não impede o `click` subsequente e a visibilidade alternaria duas vezes no
  mouse.
- **D2 — a fotografia não existe no repositório.** É o único insumo faltante. A arquitetura da
  camada de fundo isola isso em um arquivo.
- **D7 — o `PasswordInput` do Ark tem rótulo próprio e não emite `aria-describedby`.** Usar a
  moldura `Campo` e passar `ids={{ input: id }}` ao `Root`, senão o rótulo aponta para o vazio.
- **D10 — o repositório não tem harness de teste de UI.** A verificação desta feature é manual
  e roteirizada.

## Phase 1 — Design & Contracts

Concluída. Saídas:

- [data-model.md](./data-model.md) — a feature não introduz entidades de dados; o documento
  registra o estado de UI, suas transições e as entradas de URL consumidas.
- [contracts/password.md](./contracts/password.md) — API pública do componente de design
  system, incluindo o que é herdado do Ark, o que é sobrescrito e por quê.
- [contracts/tela-login.md](./contracts/tela-login.md) — contrato de composição da tela:
  camadas, ordem de empilhamento, comportamento por breakpoint, e a interface entre a camada de
  fundo e o ativo pendente.
- [quickstart.md](./quickstart.md) — roteiro de verificação cobrindo os 12 critérios de
  sucesso.

### Constitution Re-Check (pós-design)

Reavaliado contra os artefatos da Phase 1. Nenhuma violação nova:

- Os contratos não introduzem dependência, serviço ou armazenamento (VI).
- `contracts/password.md` mantém o componente sem texto em inglês fixo e com props de
  conteúdo, como exige a DESIGN_SYSTEM.md §6 (II).
- Nenhum artefato move regra de negócio para `presentation` (I).
- A correção de teclado do D6 **fortalece** a conformidade com a §6 do design system em relação
  ao que a biblioteca entrega.

**Resultado: gate aprovado.** Sem entradas em Complexity Tracking.

## Dependências externas e riscos

| Item | Natureza | Impacto se não resolvido | Encaminhamento |
| --- | --- | --- | --- |
| Fotografia de fundo (`public/login/fundo-login.jpg`) | Ativo externo, ainda inexistente | FR-006a e FR-006g não são atendidas; a tela entrega com gradiente de marca e fica visualmente completa, mas não é a decisão que o usuário tomou | Solicitar ao acervo da Defesa Civil com os requisitos da tabela em D2. Isolado em uma tarefa; não bloqueia o restante |
| Registro de licença (`public/login/PROCEDENCIA.md`) | Documentação obrigatória (FR-006g) | A imagem não pode ser publicada sem procedência | Entra junto com a imagem, na mesma tarefa |
| Migração dos 4 campos de senha restantes | Escopo adiado por decisão da spec | Design system com dois campos de senha divergentes | Ver D12 — recomendo incluir; se não, precisa de item de acompanhamento com dono |
| Harness de teste de UI | Ausente no repositório | Esta e futuras telas dependem de verificação manual | Feature própria; registrar como acompanhamento |

## Complexity Tracking

> Preenchido apenas se o Constitution Check tiver violações a justificar.

Nenhuma violação. Tabela vazia por não haver desvio a justificar: a feature não adiciona
dependência, projeto, camada ou padrão novo — usa o que o repositório já tem.
