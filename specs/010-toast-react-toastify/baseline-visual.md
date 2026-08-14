# Linha de Base Visual — motor Ark (antes da migração)

**Capturada em**: 2026-08-13, sobre o commit `cae7173`, com `src/shared/ui/toast/toast.tsx` ainda no primitivo Ark.

**Método**: estilos computados lidos do DOM em `/design-system`, não screenshots. Valores numéricos são comparáveis de forma objetiva; imagem depende de julgamento. Os screenshots ficam como registro complementar, não como critério.

> Referência de comparação para **T017** e **SC-003**. Se após a migração algum valor abaixo divergir, é regressão visual — não "diferença aceitável".

---

## Superfície do cartão (comum aos 4 tons)

| Propriedade   | Tema claro                                     | Tema escuro                                     |
| ------------- | ---------------------------------------------- | ----------------------------------------------- |
| fundo         | `lab(100 0 0)` — branco                        | `lab(7.79 1.82 -15.05)` — slate-900             |
| borda externa | `lab(91.74 -1.00 -4.77)` — slate-200, `0.53px` | `lab(16.13 -0.32 -14.67)` — slate-800, `0.53px` |
| raio          | `12px` (`rounded-xl`)                          | idem                                            |
| padding       | `16px` (`p-4`)                                 | idem                                            |
| gap interno   | `12px` (`gap-3`)                               | idem                                            |
| largura       | `384px` = 24rem (viewport 1101px)              | idem                                            |
| borda lateral | `3.73px` (`border-l-4`)                        | idem                                            |
| título        | `16px` / peso `600` / `rgb(23,23,23)`          | `16px` / `600` / `rgb(237,237,237)`             |
| descrição     | `14px` / `lab(35.56 -1.75 -15.43)`             | `14px` / `lab(84.77 -1.95 -7.93)`               |
| ícone         | `20px` (`size-5`)                              | idem                                            |

---

## Cor por tom

### Borda lateral — **idêntica nos dois temas**

| Tom        | Valor                           | Token           |
| ---------- | ------------------------------- | --------------- |
| sucesso    | `lab(59.0978 -58.6621 41.2579)` | success-600     |
| erro       | `lab(48.4493 77.4328 61.5452)`  | danger-600      |
| atenção    | `lab(72.7183 31.8672 97.9407)`  | warning-**500** |
| informação | `lab(44.0605 29.0279 -86.0352)` | info-600        |

### Ícone — muda com o tema

| Tom        | Claro (`*-600`)                 | Escuro (`*-400`)                 |
| ---------- | ------------------------------- | -------------------------------- |
| sucesso    | `lab(59.0978 -58.6621 41.2579)` | `lab(78.503 -64.9265 39.7492)`   |
| erro       | `lab(48.4493 77.4328 61.5452)`  | `lab(63.7053 60.7449 31.3109)`   |
| atenção    | `lab(60.3514 40.5624 87.1228)`  | `lab(80.1641 16.6016 99.2089)`   |
| informação | `lab(44.0605 29.0279 -86.0352)` | `lab(65.0361 -1.42062 -56.9803)` |

### ⚠️ Assimetria do tom "atenção" — confirmada empiricamente

No tema claro, o ícone de atenção é `lab(60.35 …)` (warning-600) enquanto a borda é `lab(72.72 …)` (warning-500). **São valores diferentes.** Nos outros três tons, ícone e borda coincidem no tema claro.

Isto não é bug: é a escolha registrada em `data-model.md`, agora comprovada com número. **Não uniformizar durante a migração.**

---

## Comportamento de empilhamento — corrigido após medição

A medição derrubou uma premissa que eu havia inferido errado no `data-model.md`.

**Medido**: com 4 avisos na tela, os quatro ficam em `left: 691` e `top` entre 787 e 809 — ou seja, **sobrepostos na mesma posição**, não em coluna. O `overlap: true` do Ark cria uma pilha colapsada que só expande no hover; o `gap: 8` é o recuo entre cartões empilhados, não espaço de coluna.

**Decisão do usuário** (registrada como D8 em `research.md`): **não** preservar esse comportamento. A migração adota layout em coluna, com os avisos visíveis simultaneamente.

**Razão**: a pilha colapsada só expande no hover, e mobile não tem hover. Em campo, no celular — contexto primário de uso do sistema — os avisos ocultos ficam inalcançáveis. É desvio proposital que corrige um defeito de acessibilidade em vez de preservá-lo.

Consequência para a validação: **o Cenário 6 de `quickstart.md` muda de critério**. O esperado passa a ser "os 4 avisos visíveis simultaneamente em coluna", não "empilhados".

---

## Registro complementar

Screenshot do estado anterior (tema escuro, aviso de erro visível):
`C:\Users\julio\AppData\Local\Temp\claude-chrome-screenshots-4SJ20x\screenshot-1786663958415-0.jpg`
