# Roteiro de validação — Tooltip em ações de ícone

Esta feature não adiciona teste automatizado (`research.md` D10): não há regra de negócio, e o
projeto não tem biblioteca de teste de componente instalada. **Este roteiro é o instrumento de
verificação.** Hover, foco visível, leitor de tela e ausência de hover em toque não se verificam
sem navegador.

## Pré-requisitos

```bash
npm run dev
```

Entrar como perfil `coordenador` (alcança todas as telas do roteiro). Ter à mão: janela
redimensionável, alternador de tema claro/escuro e o simulador de dispositivo do navegador.

## Portões automáticos (rodar antes do roteiro manual)

```bash
npx tsc --noEmit     # sem erro de tipo
npm run lint         # sem aviso novo
npm test             # a suíte existente continua verde
```

Nenhum dos três prova a feature — provam apenas que nada quebrou.

---

## R1 — Vitrine do design system (US5, SC-005)

`/design-system`, seção do tooltip.

1. Apontar cada exemplo → a dica aparece após um instante curto, no lado indicado.
2. Apontar o exemplo posicionado contra a borda da janela → a dica **vira de lado** e aparece
   inteira. Nada é cortado; a página **não** ganha rolagem horizontal.
3. Alternar claro/escuro com uma dica visível → o texto permanece legível nos dois temas.
4. Exemplo com texto longo → quebra em mais de uma linha; não vira uma faixa atravessando a tela.
5. Exemplo `inativo` → a dica aparece **mesmo com o botão esmaecido**, e explica o motivo.
6. Clicar no exemplo `inativo` → nada acontece.

## R2 — Ponteiro nas telas reais (US1, SC-001)

Percorrer, apontando cada controle e conferindo que a dica aparece e descreve a ação:

| Tela | Controles |
| --- | --- |
| qualquer tela interna | abrir navegação (abaixo de `lg`), sino, tema, sair |
| `lg+`, coluna lateral | recolher/expandir; com a coluna **recolhida**, cada item de navegação |
| `/admin` | editar, em várias linhas da tabela — inclusive a **última** (a dica deve virar para cima, não sair da tela) |
| `/atividades/{id}` | alocar no turno; remover voluntário do turno (o texto **nomeia a pessoa**) |
| `/estoque/saida` | remover linha |
| `/estoque/kits` | remover componente |

7. Atravessar rapidamente uma fileira de botões sem parar → **nenhuma** dica chega a aparecer
   (FR-003).
8. Com uma dica visível numa linha de tabela, rolar a página → a dica é dispensada; não fica
   flutuando sobre lugar vazio.

## R3 — Teclado (US2, SC-001)

9. Percorrer uma tela interna só com **Tab** → cada controle de ícone focado exibe a dica.
10. Com a dica visível, **Esc** → some, e o foco **continua no mesmo botão** (Tab seguinte vai para
    o próximo controle, não recomeça).
11. **Clicar** com o mouse num botão de ícone → a dica some ao clicar e **não** volta pelo foco
    resultante do clique (só foco de teclado a traz).
12. Abrir um diálogo (editar usuário) e apontar um controle de ícone dentro dele → a dica aparece
    **acima** do diálogo, nunca atrás.

## R4 — Ação indisponível (US3)

`/estoque/saida`, com **uma única linha** no formulário.

13. O botão de remover está esmaecido. Apontar → a dica aparece e diz que a saída precisa de ao
    menos uma linha.
14. **Tab** até esse botão → ele **recebe foco** (com anel visível) e exibe a mesma dica.
15. Clicar e pressionar Enter nele → a linha **não** é removida.
16. Acrescentar uma segunda linha → o botão volta ao normal e a dica passa a ser `Remover linha`.
17. Repetir 13–16 em `/estoque/kits` com um único componente.

## R5 — Toque, em celular (US4, SC-004) — **o mais importante**

Simulador de dispositivo em modo toque, ou aparelho real. Largura de celular.

18. Tocar cada controle de ícone → a ação executa **no primeiro toque**. Nenhuma dica aparece e
    nenhum toque extra é exigido.
19. Concluir, do início ao fim e sem ver nenhuma dica: registrar uma saída de estoque; alocar um
    voluntário em turno; editar um usuário. Nenhum passo fica incompreensível.
20. Tocar o botão de remover **esmaecido** → nada acontece e nada trava. (Em toque, o motivo não é
    exibido — é a limitação aceita da plataforma, e por isso nenhum requisito depende dela.)

## R6 — Leitor de tela (SC-003)

Narrador (Windows) ou NVDA, numa tela interna.

21. Focar "Sair" → anunciado **uma única vez**. Nada como "Sair, Sair".
22. Focar "Editar {nome}" na tabela → o nome da pessoa é anunciado uma vez.
23. Focar o item de navegação com a **coluna recolhida** → o rótulo do destino é anunciado uma vez.
    (Este é o defeito que existe hoje — ver `contracts/adocao-telas.md` A-02.)
24. Focar o botão de remover **inativo** → o nome é anunciado, seguido do motivo, e o controle é
    anunciado como indisponível.

## R7 — Preferências do sistema

25. Ativar "reduzir movimento" no sistema operacional → as dicas continuam aparecendo, sem
    deslizar (não há animação a suprimir — D6).

## R8 — Completude (SC-006, FR-013)

```bash
# nenhuma tela pode importar o primitivo direto
grep -rn "@ark-ui/react/tooltip" app/ src/ --include=*.tsx
# esperado: só src/shared/ui/tooltip/tooltip.tsx

# inventário de controles só-ícone
grep -rn "IconButton" app/ src/ --include=*.tsx
```

26. Todo resultado do segundo comando está coberto por `contracts/adocao-telas.md` (A-02..A-06) ou
    consta explicitamente de A-07 (fora do escopo). Nenhum controle sobrando.

## Critério de aceite

Os 26 itens passam. R5 e R6 são bloqueantes: uma falha ali significa que a feature **removeu**
acessibilidade em vez de acrescentar apoio visual, e não deve ser integrada.
