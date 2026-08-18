# Implementation Plan: Padrão único de validação de formulários

**Branch**: `016-formularios-rhf-zod` | **Date**: 2026-08-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/016-formularios-rhf-zod/spec.md`

## Summary

Transformar em padrão único e verificável o que hoje existe em três graus diferentes de
aderência: validação de formulário no cliente com react-hook-form + Zod, mensagem de erro em
pt-BR imediatamente abaixo do campo, e validação nativa do navegador desligada em toda a
aplicação.

A abordagem tem três peças, todas pequenas: (1) um wrapper `useFormulario` que fixa a
configuração de validação — submit + revalidação `onChange` + foco no primeiro erro — para que
nenhum formulário escolha outro comportamento em silêncio; (2) um componente `Formulario` que
sempre renderiza `<form noValidate>`, tornando FR-003 estrutural em vez de disciplinar (hoje
`usuario-form-dialog.tsx` esqueceu justamente disso); (3) o fechamento das lacunas nos
controles de campo — `Switch` sem estado de erro, `RadioGroup`/`CheckboxGroup` com faixa de
mensagem própria fora do padrão, e a ausência de `ref` nos controles Ark, que faz o foco no
primeiro erro falhar em silêncio nos campos mais difíceis de achar na tela.

Nenhuma dependência nova, nenhuma mudança de banco, nenhuma mudança na fronteira Server Action
— o contrato `ResultadoAction<T>`/`camposComErro` já existente é reaproveitado para levar o
erro do servidor ao campo certo.

## Technical Context

**Language/Version**: TypeScript 5.9 (estrito), React 19.1, Next.js 16.3 (App Router,
Turbopack)

**Primary Dependencies**: react-hook-form 7.85, @hookform/resolvers 5.7 (zodResolver), zod 4.4
(locale pt via `src/shared/validacao/zod-ptbr.ts`), @ark-ui/react 5.38, Tailwind CSS v4.
**Nenhuma dependência nova** — todas já estão no `package.json`.

**Storage**: N/A — feature exclusivamente de apresentação, sem tabela, migração ou mudança de
esquema.

**Testing**: Vitest 4.1, ambiente `node`, `include: ['src/**/*.test.ts']`. Cobre o que é puro
(construtores de esquema e mapeamento de erro do servidor); comportamento de interface é
verificado pelo roteiro manual de [quickstart.md](quickstart.md) — ver research D9.

**Target Platform**: Web responsivo (mobile-first), navegadores modernos; tema claro/escuro.

**Project Type**: Aplicação web — monolito modular Next.js, telas em `app/`, código
compartilhado em `src/shared/`.

**Performance Goals**: Sem impacto nos caminhos de leitura críticos (<300ms, Fluxo de
Desenvolvimento). A validação roda no cliente, em campos de formulário; o custo é
imperceptível. O wrapper não adiciona re-render: `useFormulario` devolve o retorno do
react-hook-form sem estado próprio.

**Constraints**:

- TC-001..TC-003 da spec são mandatórias (react-hook-form, Zod, `noValidate`).
- Interface 100% pt-BR, incluindo toda mensagem de validação (Princípio II).
- A validação no cliente é de experiência de uso; as Server Actions continuam validando toda
  entrada independentemente (Princípio IV).
- Sem jsdom/testing-library — decisão registrada em research D9, reavaliável.

**Scale/Scope**: 3 formulários existentes, 10 componentes de campo em `src/shared/ui/`, 2
módulos novos pequenos em `src/shared/`. Formulários futuros (estoque, atividades, triagem)
herdam o padrão sem trabalho adicional.

## Constitution Check

_GATE: verificado antes da Phase 0 e reavaliado após a Phase 1 — resultado idêntico nas duas
passagens._

| Princípio                                | Situação | Avaliação                                                                                                                                                                                                            |
| ---------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Clean Architecture por Módulo (DDD)   | ✅ Passa | Feature vive inteiramente em `presentation`/`shared`. `domain/` e `application/` não são tocados; nenhuma regra de negócio migra para o cliente (research D10) — a validação local é de forma, o domínio segue autoridade. |
| II. Tipagem Estrita e Qualidade          | ✅ Passa | Sem `any`; tipos derivados por `z.infer`. Todas as mensagens em pt-BR, com `z.config(pt())` como rede de segurança. Commits em Conventional Commits.                                                                     |
| III. Testes Focados em Regras de Negócio | ✅ Passa | Nenhuma regra de negócio muda ⇒ nenhum teste de `domain`/`application` é exigido. O que esta feature acrescenta de lógica pura (`aplicarErrosDoServidor`, construtores de campo) recebe teste unitário no `npm test`.    |
| IV. Segurança e Defesa em Profundidade   | ✅ Passa | Validação do cliente é adicional, nunca substituta. As Server Actions e os esquemas de servidor permanecem intocados. Mensagem de credencial inválida no login segue genérica de propósito (não revela se o e-mail existe). |
| V. Auditoria Não Bloqueante              | ✅ N/A   | Nenhuma escrita nova; `withAudit` não é tocado.                                                                                                                                                                          |
| VI. Simplicidade Operacional             | ✅ Passa | Zero dependências novas; dois módulos pequenos que **removem** duplicação (o laço de `setError` copiado em duas telas, o helper `obrigatorio()` local, o markup de erro duplicado nos grupos). Decisões arquiteturais registradas em research.md antes do código. |

**Gate pós-design**: nenhuma violação; a tabela de Complexity Tracking permanece vazia.

**Ponto de atenção registrado, não violação**: a spec nomeia bibliotecas (TC-001..TC-003).
Isso é exigência explícita do solicitante, isolada na seção de restrições técnicas — os
requisitos funcionais seguem comportamentais. E o padrão diverge do guia de formulários do
Next 16 (`<form action={serverAction}>`); a divergência é deliberada e justificada em
research D1, conforme o Princípio VI exige de decisões arquiteturais.

## Project Structure

### Documentation (this feature)

```text
specs/016-formularios-rhf-zod/
├── plan.md              # Este arquivo
├── spec.md              # Especificação da feature
├── research.md          # Phase 0 — decisões D1..D10
├── data-model.md        # Phase 1 — entidades de formulário, contrato de campo, inventário
├── quickstart.md        # Phase 1 — roteiro de validação (automatizado + manual)
├── contracts/
│   └── componentes-formulario.md   # Phase 1 — API de useFormulario, Formulario, aplicarErrosDoServidor
├── checklists/
│   └── requirements.md  # Checklist de qualidade da spec
└── tasks.md             # Phase 2 — gerado por /speckit-tasks, NÃO por este comando
```

### Source Code (repository root)

```text
src/shared/
├── formulario/                     # NOVO — lógica compartilhada de formulário
│   ├── use-formulario.ts           # wrapper de useForm com a configuração do padrão
│   ├── erros-servidor.ts           # aplicarErrosDoServidor (puro)
│   ├── erros-servidor.test.ts      # NOVO — cobre os três ramos do contrato
│   ├── campos.ts                   # construtores Zod compartilhados (textoObrigatorio, email, senha…)
│   ├── campos.test.ts              # NOVO — mensagens pt-BR, inclusive o caso undefined
│   └── index.ts
├── validacao/zod-ptbr.ts           # existente — locale pt do Zod, reaproveitado
├── kernel/action.ts                # existente — camposComErro, reaproveitado sem alteração
└── ui/
    ├── formulario/formulario.tsx   # NOVO — <form noValidate>, único ponto de submissão
    ├── campo/campo.tsx             # existente — moldura de rótulo/apoio/erro, base do padrão
    ├── switch/switch.tsx           # ALTERADO — ganha `erro` (research D6)
    ├── radio-group/radio-group.tsx # ALTERADO — faixa de mensagem via idsCampo + apoio (D7)
    ├── checkbox-group/checkbox-group.tsx # ALTERADO — idem
    ├── select/, combobox/, date-picker/, number-input/, password/  # ALTERADOS — encaminham `ref` (D4)
    └── index.ts                    # ALTERADO — exporta Formulario

app/
├── (publico)/login/login-form.tsx                        # ALTERADO — Formulario + useFormulario
├── (interno)/voluntariado/candidatura/candidatura-form.tsx # ALTERADO — + condicional no esquema, refs, helper de erro
└── (interno)/(staff)/admin/usuario-form-dialog.tsx        # ALTERADO — corrige noValidate ausente, refs, helper

spec/DESIGN_SYSTEM.md               # ALTERADO — §4.2.1 (exceção do Switch) + nova seção do padrão de formulário (FR-018)
eslint.config.mjs                   # ALTERADO (opcional) — proíbe <form> cru fora de shared/ui/formulario
```

**Structure Decision**: a feature segue a organização já estabelecida no repositório e não
cria camada nova. Lógica compartilhada sem JSX vai para `src/shared/formulario/` (mesmo padrão
de `src/shared/paginacao/` e `src/shared/validacao/`); o componente com JSX vai para
`src/shared/ui/formulario/` (mesmo padrão dos demais componentes do design system, um diretório
por componente, conforme DESIGN_SYSTEM.md §5). As telas em `app/` continuam sendo a camada
fina que apenas compõe — nenhuma regra de negócio se muda de lugar.

## Complexity Tracking

> Nenhuma violação do Constitution Check. Tabela intencionalmente vazia.
