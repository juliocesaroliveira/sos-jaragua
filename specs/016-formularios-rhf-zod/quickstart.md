# Quickstart — Validação do padrão de formulários

**Feature**: `specs/016-formularios-rhf-zod` | **Data**: 2026-08-17

Roteiro para provar que a feature funciona ponta a ponta. Duas partes: o que a máquina
verifica (§2) e o que só a interface prova (§3). A divisão é deliberada — ver research D9: o
projeto roda Vitest em ambiente `node`, sem DOM, e a feature não introduz jsdom.

---

## 1. Pré-requisitos

```bash
npm install                 # já satisfeito: react-hook-form, @hookform/resolvers, zod estão no package.json
cp .env.example .env.local  # se ainda não existir
npm run dev
```

Contas necessárias para o roteiro manual: uma com papel administrativo (acesso a
`/admin`) e uma conta comum sem candidatura enviada.

---

## 2. Verificação automatizada

```bash
npm test          # unitários (node, sem rede)
npm run lint      # inclui a regra que proíbe <form> cru, se adotada
npx tsc --noEmit  # tipos dos novos módulos e das props ref
```

**Esperado**:

- `src/shared/formulario/erros-servidor.test.ts` passa nos três ramos do contrato
  ([`contracts/componentes-formulario.md`](contracts/componentes-formulario.md) §3): campos
  conhecidos, campo desconhecido agregado à mensagem geral, erro sem `detalhes.campos`.
- `src/shared/formulario/campos.test.ts` passa: cada construtor rejeita `undefined`, string
  vazia e valor fora de formato **com mensagem em pt-BR** — inclusive o caso `undefined`, que
  não chega ao `.min()`.
- Suíte existente segue verde (nenhuma regressão em `domain`/`application`).
- `npm run lint` sem erros; nenhum `<form>` fora de `src/shared/ui/formulario/`.

**Busca de conformidade** (FR-003, FR-017 — deve não retornar nada):

```bash
grep -rn "<form" app src --include=*.tsx | grep -v "shared/ui/formulario"
```

---

## 3. Verificação manual na interface

Rodar **em dois navegadores diferentes** (SC-001). Os três formulários da aplicação são o
universo completo hoje — inventário em [`data-model.md`](data-model.md) §6.

### 3.1. Login — `/login`

| Passo                                                        | Esperado                                                                 | Requisito |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ | --------- |
| "Usar usuário e senha" → Acessar com os dois campos vazios    | Nenhum balão do navegador; erro abaixo de cada campo, ambos de uma vez   | FR-003, FR-006 |
| Mesmo passo                                                   | Foco no campo de e-mail                                                  | FR-011    |
| Digitar `abc` no e-mail                                       | "Informe um e-mail válido." abaixo do campo                              | FR-005    |
| Corrigir para e-mail válido                                   | Mensagem some sem novo envio                                             | FR-007    |
| Enviar credenciais inexistentes                               | Aviso geral "E-mail ou senha incorretos." — **não** fixado no campo       | FR-012    |
| Voltar → "Usar usuário e senha" de novo                       | Campos limpos, sem mensagens remanescentes                               | FR-016    |

### 3.2. Candidatura — `/voluntariado/candidatura`

| Passo                                                        | Esperado                                                                 | Requisito |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ | --------- |
| Enviar o formulário inteiramente vazio                        | Toda pendência visível de uma vez; nenhum campo obrigatório sem mensagem  | SC-004    |
| Mesmo passo                                                   | Foco vai ao primeiro campo com erro (nome completo), sem rolar procurando | FR-011, SC-005 |
| Não marcar disponibilidade e enviar                           | "Selecione ao menos uma disponibilidade." abaixo do grupo de checkboxes, mesmo formato dos campos de texto | FR-008 |
| Ligar "Possui veículo próprio" e enviar sem escolher o tipo   | "Selecione o tipo de veículo." abaixo do grupo de rádio — **antes** de ir ao servidor | FR-014 |
| Desligar "Possui veículo próprio" e enviar                    | Envio prossegue; nenhum erro órfão do campo que sumiu                     | FR-014    |
| Campo com apoio ("Como está no seu documento") que entra em erro | Erro substitui a dica na mesma faixa; o formulário abaixo não desloca  | FR-010    |
| Enviar CPF com formato válido mas dígito verificador errado   | Recusa do servidor exibida abaixo do campo CPF                           | FR-012    |
| Alterar o CPF em seguida                                      | Mensagem do servidor desaparece                                          | US3/AC3   |
| Clicar "Enviar candidatura" duas vezes seguidas               | Um único envio; botão em estado de carregamento e desabilitado           | FR-013    |
| Tela estreita (~360px)                                        | Mensagem longa quebra em linhas, sem rolagem horizontal                  | Edge case |

### 3.3. Cadastro/edição de conta — `/admin`

| Passo                                                        | Esperado                                                                 | Requisito |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ | --------- |
| "Nova conta" → Cadastrar com tudo vazio                       | **Nenhum balão do navegador** (era a lacuna conhecida); erro abaixo de cada campo | FR-003 |
| Não escolher papel e enviar                                   | "Selecione o papel." abaixo do Select, com foco indo até ele             | FR-008, FR-011 |
| Cadastrar com e-mail já existente                             | Mensagem do servidor abaixo do campo de e-mail                           | FR-012    |
| Fechar o diálogo e reabrir                                    | Sem valores nem mensagens do envio anterior                              | FR-016    |
| Editar conta: o e-mail somente leitura                        | Não bloqueia o envio nem gera mensagem                                    | FR-015    |
| "Trocar Senha" → salvar com a nova senha vazia                | "A senha deve ter ao menos 8 caracteres." abaixo do campo                | FR-014    |
| Cancelar troca de senha → salvar                              | Envio prossegue; nenhum erro remanescente do campo recolhido             | FR-014    |

### 3.4. Acessibilidade (SC-007)

Com leitor de tela ativo (NVDA no Windows, VoiceOver no macOS), em qualquer um dos três
formulários:

1. Submeter inválido → a mensagem é anunciada (`role="alert"`).
2. Navegar até o campo em erro → é anunciado como inválido e a mensagem é lida junto.
3. Campo obrigatório → anunciado como obrigatório mesmo sem o atributo nativo `required`.
4. Campo com apoio e erro simultâneos → a dica não é anunciada no lugar do erro.

---

## 4. Critério de conclusão

A feature está pronta quando:

- §2 passa inteiramente e a busca por `<form` cru não retorna nada;
- §3.1 a §3.4 passam nos dois navegadores;
- `spec/DESIGN_SYSTEM.md` documenta o padrão (§4.2.1 atualizada quanto ao `Switch`, e a nova
  seção do fluxo de formulário), atendendo FR-018;
- um formulário novo escrito seguindo apenas essa documentação passa em §3 sem ajustes
  (SC-006) — verificável na próxima tela de estoque/atividades.
