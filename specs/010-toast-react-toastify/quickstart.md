# Roteiro de Validação

**Feature**: Migração do Toast para react-toastify

**Objetivo**: comprovar que a troca de motor preservou comportamento e aparência, e que nenhuma tela regrediu.

> Por que manual: ver decisão D7 em [research.md](research.md). O projeto não tem stack de teste de componente, e introduzir uma só para este arquivo contraria o Princípio VI da constituição. O que protege esta mudança de forma automática é o compilador — ver Cenário 0.

---

## Pré-requisitos

```bash
npm install          # traz react-toastify@^11.1.0
npm run dev
```

Aplicação em `http://localhost:3000`. A superfície principal de validação é `/design-system`, que demonstra os quatro tons lado a lado.

**Pré-requisito de implementação**: a galeria hoje só demonstra `sucesso` e `erro`. A tarefa de implementação deve acrescentar os botões de `atenção` e `informação` — sem eles os Cenários 2 e 3 não têm como ser executados de forma isolada.

---

## Cenário 0 — Nenhuma tela foi alterada (SC-001, FR-012)

Este é o cenário mais importante e o único totalmente automático.

```bash
npm run build

# Compare contra o commit imediatamente anterior ao início da migração —
# não contra `master`. O trabalho corre em `feat/ui-improvements`, que já
# carrega outros commits; diferenciar contra `master` traria arquivos
# alheios a esta feature e tornaria a verificação inútil.
git diff --name-only <commit-antes-da-migração>..HEAD
```

**Esperado**:

1. O build passa. Como `avisar` é tipado e consumido em 26 pontos, qualquer divergência de assinatura vira erro de compilação — não bug em produção. Build verde é a prova de que o contrato foi preservado.
2. A lista de arquivos alterados contém **apenas**:
    - `src/shared/ui/toast/toast.tsx`
    - `src/shared/ui/index.ts`
    - `app/globals.css`
    - `app/(interno)/design-system/galeria.tsx`
    - `spec/DESIGN_SYSTEM.md`
    - `package.json`, `package-lock.json`
    - `specs/010-toast-react-toastify/**`

**Falha**: qualquer arquivo em `app/(interno)/(staff)/`, `app/(publico)/` ou `app/layout.tsx` na lista significa que o contrato não foi preservado. Corrigir o módulo, não a tela.

---

## Cenário 1 — Os quatro tons aparecem corretos no tema claro (C-01, C-02, FR-008)

1. Abrir `/design-system` no tema claro, seção "Sobreposições".
2. Acionar cada um dos quatro botões de aviso.

**Esperado** — comparar contra a tabela de [data-model.md](data-model.md#derivação-de-tipo--apresentação):

| Tom        | Ícone               | Cor do ícone | Borda esquerda |
| ---------- | ------------------- | ------------ | -------------- |
| sucesso    | círculo com "check" | verde        | verde, 4px     |
| erro       | círculo com "x"     | vermelho     | vermelho, 4px  |
| atenção    | triângulo com "!"   | âmbar        | âmbar, 4px     |
| informação | círculo com "i"     | azul         | azul, 4px      |

Todos com: fundo de superfície, borda fina em volta, cantos arredondados (`rounded-xl`), sombra, título em semibold e botão de fechar à direita.

3. Acionar o aviso de sucesso da galeria (`'Saída registrada com sucesso'`, sem descrição).

**Esperado**: o cartão exibe só o título, sem linha vazia nem altura extra reservada.

**Falha**: cor verde vibrante (`#07bc0c`), raio de canto pequeno ou sombra diferente indicam que o `ReactToastify.css` foi importado por engano — ver D1.

---

## Cenário 2 — Tema escuro e troca de tema com aviso aberto (C-08, FR-009)

1. Alternar para o tema escuro pelo botão do topbar.
2. Disparar um aviso de cada tom.

**Esperado**: fundo escuro de superfície, texto claro legível, ícones nos tons `*-400`, bordas laterais preservadas.

3. **O teste que importa**: disparar um aviso de erro (8s de duração, dá tempo) e, **com ele ainda visível**, alternar o tema pelo topbar.

**Esperado**: o aviso que já está na tela muda de tema instantaneamente, junto com o resto da página.

**Falha**: se o aviso permanecer com o tema antigo até desaparecer, a prop `theme` da biblioteca foi usada em vez das variantes `dark:` do Tailwind — ver D2. Não é cosmético: é o requisito US2/cenário 3.

---

## Cenário 3 — Durações por tom (C-03, FR-003)

Com cronômetro (ou contando), disparar isoladamente e medir até o desaparecimento:

| Tom        | Esperado |
| ---------- | -------- |
| sucesso    | ~5 s     |
| informação | ~5 s     |
| atenção    | ~6 s     |
| erro       | ~8 s     |

O que precisa ser verdade, mesmo que a medição seja grosseira: **erro dura visivelmente mais que sucesso**. É a razão de a duração ser diferenciada — mensagem de erro exige leitura, não só ciência.

---

## Cenário 4 — Pausa em hover e em perda de foco (C-04, FR-004)

1. Disparar um aviso de sucesso e posicionar o cursor sobre ele imediatamente.

**Esperado**: não desaparece enquanto o cursor permanecer sobre o cartão.

2. Retirar o cursor.

**Esperado**: volta a contar **de onde parou**, não do início. (Se some instantaneamente ao sair, o tempo continuou correndo por baixo; se recomeça do zero, o temporizador foi reiniciado. Ambos são falha.)

3. Disparar um aviso e trocar para outra janela/aba antes de ele sumir; voltar depois de alguns segundos.

**Esperado**: o aviso ainda está lá — a contagem pausou com a janela sem foco.

---

## Cenário 5 — Fechar manualmente, por mouse e por teclado (C-05, FR-005)

1. Disparar um aviso e clicar no botão de fechar.

**Esperado**: sai imediatamente, com a mesma animação de saída do desaparecimento automático.

2. Disparar outro aviso e navegar com `Tab` até o botão de fechar.

**Esperado**: o botão recebe foco visível (anel de foco padrão do design system) e `Enter`/`Espaço` fecham o aviso.

3. Inspecionar o botão no DevTools.

**Esperado**: `aria-label="Fechar aviso"` (pt-BR, C-09) e área clicável de 44×44px (`size-11`, alvo de toque do §1.3).

---

## Cenário 6 — Limite de 4 e enfileiramento (C-06, FR-006)

1. Acionar o botão de aviso de sucesso **seis vezes** em sequência rápida.

**Esperado**:

- No máximo 4 cartões visíveis ao mesmo tempo, **dispostos em coluna e todos legíveis** — sem depender de hover para revelar os de baixo (D8).
- Conforme os primeiros desaparecem, os dois restantes **aparecem** — nenhum é engolido.
- Contagem total de avisos exibidos ao longo do teste: 6.

> **Mudança de critério em relação ao comportamento anterior**: o motor Ark empilhava os avisos colapsados na mesma posição, revelando os de baixo só no hover. A migração adota coluna de propósito — ver D8 em `research.md` e a seção de empilhamento em `baseline-visual.md`. Ver 4 cartões sobrepostos aqui seria **falha**, não paridade.

**Falha**: se apenas 4 aparecerem no total, os excedentes foram descartados em vez de enfileirados.

2. Acionar duas vezes seguidas o **mesmo** aviso.

**Esperado**: dois cartões distintos. Deduplicação não é desejada — esconder que a ação ocorreu duas vezes é pior que a repetição visual (decisão registrada na spec).

---

## Cenário 7 — Posicionamento, mobile e texto longo (C-07, SC-004)

1. Em desktop, disparar um aviso.

**Esperado**: canto inferior direito, com respiro das bordas, sem cobrir botões de ação da tela.

2. DevTools → modo dispositivo → largura 360px. Navegar até uma tela com ação primária (ex.: `/estoque/entrada`) e disparar um aviso salvando o formulário.

**Esperado**: o cartão cabe na largura sem cortar texto e **não cobre o botão primário** da tela.

3. Disparar um aviso com título e descrição longos.

**Esperado**: o texto quebra em várias linhas dentro da largura máxima; o cartão cresce em altura; nada é truncado sem indicação nem estoura a caixa.

---

## Cenário 8 — Aviso sobre diálogo aberto (C-11, edge case)

1. Em `/design-system`, abrir o diálogo.
2. Com ele aberto, disparar um aviso (o botão fica atrás — usar o console do navegador ou disparar antes de abrir, com duração de erro para dar tempo).

**Esperado**: o aviso aparece **acima** do diálogo e do seu backdrop, legível e com o botão de fechar clicável.

**Falha**: aviso atrás do backdrop indica que o `z-index` não veio da escala `CAMADA` — ver D6.

---

## Cenário 9 — Regressão nas telas reais (SC-006)

Percorrer um fluxo de escrita real por área, confirmando que o feedback continua aparecendo:

| Tela                   | Ação                                   | Aviso esperado                   |
| ---------------------- | -------------------------------------- | -------------------------------- |
| `/admin`               | cadastrar uma conta                    | sucesso "Conta cadastrada"       |
| `/admin`               | cadastrar com e-mail duplicado         | erro, com a mensagem do servidor |
| `/estoque/entrada`     | registrar uma entrada                  | sucesso                          |
| `/estoque/saida`       | registrar saída com saldo insuficiente | erro, com a mensagem de saldo    |
| `/cadastros-pendentes` | aprovar uma candidatura                | sucesso                          |
| `/cadastros-pendentes` | rejeitar uma candidatura               | informação                       |
| `/atividades`          | criar uma atividade                    | sucesso                          |

Não é preciso esgotar os 26 pontos — o Cenário 0 já garante que todos compilam contra o mesmo contrato. Esta amostra confirma que o caminho fim a fim (Server Action → resultado → aviso) continua ligado.

---

## Cenário 10 — Acessibilidade e movimento reduzido (C-10, FR-015, D5)

1. Inspecionar um aviso no DevTools.

**Esperado**: `role="alert"` presente no elemento do aviso.

2. Com leitor de tela ativo (Narrador no Windows, VoiceOver no macOS), disparar um aviso.

**Esperado**: o conteúdo é anunciado assim que aparece, sem exigir navegação até ele.

3. Ativar "reduzir movimento" no sistema operacional e disparar um aviso.

**Esperado**: o aviso aparece e some sem deslizamento — só a transição de opacidade, ou nenhuma.

---

## Critérios de aprovação

A feature está pronta quando:

- [ ] Cenário 0 passa — build verde e nenhuma tela na lista de alterados
- [ ] Cenários 1 e 2 passam — paridade visual nos quatro tons, nos dois temas, incluindo troca com aviso aberto
- [ ] Cenários 3 a 6 passam — durações, pausa, fechamento e fila
- [ ] Cenários 7 e 8 passam — posicionamento, 360px e camada acima do diálogo
- [ ] Cenário 9 passa — amostra de telas reais sem regressão
- [ ] Cenário 10 passa — `role="alert"`, anúncio e movimento reduzido
- [ ] `spec/DESIGN_SYSTEM.md` §4.8 não cita mais o Ark como motor do toast
- [ ] Busca por `createToaster` no projeto retorna zero ocorrências (FR-013, SC-005)

## Critérios de reversão

Reverter a migração se, após a implementação:

- A paridade visual não for atingível sem importar o CSS padrão da biblioteca — significaria que a premissa central de D1 estava errada.
- O Cenário 2, passo 3 (troca de tema com aviso aberto) não passar em CSS puro — significaria que D2 não se sustenta e a solução exigiria acoplar o container ao contexto de tema, encarecendo a mudança além do previsto.
- Alguma tela precisar ser alterada — significaria que o contrato de `avisar` não pôde ser preservado, invalidando a premissa de custo da feature.
