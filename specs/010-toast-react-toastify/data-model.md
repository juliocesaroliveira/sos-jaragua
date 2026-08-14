# Fase 1 — Modelo de Dados

**Feature**: Migração do Toast para react-toastify

> Esta feature não persiste nada. As "entidades" abaixo são estruturas efêmeras em memória do cliente, existentes apenas entre o disparo e o desaparecimento do aviso. Nenhuma tabela, nenhuma migração, nenhum repositório.

---

## Entidade: Aviso

Uma mensagem pontual de feedback exibida ao usuário após uma ação.

| Campo       | Tipo                                         | Obrigatório | Origem                                | Regras                                                                                    |
| ----------- | -------------------------------------------- | ----------- | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `tipo`      | `'sucesso' \| 'erro' \| 'atencao' \| 'info'` | sim         | derivado do atalho `avisar.*` chamado | Determina cor, ícone e duração. Não é passado pelo chamador — é implícito no método.      |
| `titulo`    | `string`                                     | sim         | primeiro argumento                    | Frase curta em pt-BR. Sempre visível.                                                     |
| `descricao` | `string`                                     | não         | segundo argumento                     | Quando ausente, o cartão renderiza só o título, sem espaço reservado (edge case da spec). |
| `duracao`   | `number` (ms)                                | sim         | derivada do `tipo`                    | Não é configurável pelo chamador — ver tabela abaixo.                                     |
| `id`        | `string \| number`                           | sim         | gerado pela biblioteca                | Interno. Não exposto na API pública.                                                      |

### Derivação de tipo → apresentação

Esta é a única tabela de verdade da aparência do aviso. Os valores de cor e ícone são os **atuais** do componente Ark e devem ser preservados na íntegra (SC-003).

| `tipo`    | Duração | Ícone (lucide-react) | Cor do ícone (claro / escuro)                | Borda lateral                     |
| --------- | ------- | -------------------- | -------------------------------------------- | --------------------------------- |
| `sucesso` | 5000 ms | `CheckCircle2`       | `text-success-600` / `dark:text-success-400` | `border-l-4 border-l-success-600` |
| `erro`    | 8000 ms | `XCircle`            | `text-danger-600` / `dark:text-danger-400`   | `border-l-4 border-l-danger-600`  |
| `atencao` | 6000 ms | `AlertTriangle`      | `text-warning-600` / `dark:text-warning-400` | `border-l-4 border-l-warning-500` |
| `info`    | 5000 ms | `Info`               | `text-info-600` / `dark:text-info-400`       | `border-l-4 border-l-info-600`    |

> Atenção à assimetria proposital: a borda do tipo `atencao` usa `warning-500` enquanto o ícone usa `warning-600`. Isso está assim hoje e é intencional (o tom 500 tem presença suficiente na borda; o 600 dá contraste no ícone). **Não "corrigir" durante a migração** — seria uma mudança visual não pedida.

### Superfície do cartão (comum a todos os tipos)

Preservar exatamente do componente atual:

- Caixa: `flex w-[min(92vw,24rem)] items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-lg`
- Título: `text-base font-semibold text-foreground`
- Descrição: `text-sm text-neutral-600 dark:text-neutral-300`
- Ícone: `size-5`, com `aria-hidden`
- Botão fechar: `size-11` (alvo de toque de 44px, §1.3 do design system), `text-neutral-500 hover:bg-surface-muted`, `rounded-lg`, mais o `ANEL_FOCO` de `cn.ts`, `aria-label="Fechar aviso"`

O `w-[min(92vw,24rem)]` é o que resolve SC-004 (360px sem cortar texto): a 360px de largura o aviso ocupa 331px, deixando folga.

---

## Entidade: Fila de Avisos

Conjunto ordenado de avisos gerenciado pela biblioteca. Não é código nosso — é comportamento configurado.

| Propriedade              | Valor                                                                         | Requisito                       |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------------------- |
| Máximo simultâneo        | 4                                                                             | FR-006                          |
| Excedentes               | enfileirados, nunca descartados                                               | FR-006, edge case da spec       |
| Posição na tela          | inferior-direita                                                              | FR-007                          |
| Layout                   | **coluna**, todos visíveis simultaneamente                                    | D8 — desvio proposital do atual |
| Espaçamento entre avisos | `gap-2` (8px)                                                                 | —                               |
| Camada                   | `z-100` (`CAMADA.toast`)                                                      | edge case "aviso sobre diálogo" |
| Pausa                    | em hover e em perda de foco da janela                                         | FR-004                          |
| Ordem                    | mais recentes na base da pilha (paridade com `bottom-end` + `overlap` atuais) | paridade                        |

### Ciclo de vida

```
[disparo] ──> [na fila] ──┬─(há vaga)──> [visível] ──┬─(temporizador expira)──> [saindo] ──> [removido]
                          │                          │
                          │                          ├─(hover/foco)──> [pausado] ──(sai o cursor)──> [visível]
                          │                          │
                          └─(4 já visíveis)          └─(clique em fechar)─────> [saindo] ──> [removido]
                             aguarda vaga
```

Transições relevantes para validação:

- **na fila → visível**: ocorre imediatamente se houver menos de 4 avisos na tela.
- **visível → pausado**: a contagem congela; ao sair o cursor, retoma de onde parou (não reinicia).
- **visível → saindo**: por expiração ou por fechamento manual; ambos passam pela mesma animação de saída.
- **removido**: libera vaga e o primeiro da fila entra.

---

## O que esta feature **não** modela

Registrado explicitamente para evitar escopo confundido:

- **Histórico de avisos** — não existe. Aviso não lido e depois desaparecido está perdido, por design. O histórico de eventos relevantes é responsabilidade do sino de notificações (`app/(interno)/sino-notificacoes.tsx`), que é outro mecanismo, com outra fonte de dados e fora do escopo desta feature.
- **Persistência entre rotas ou sessões** — o aviso sobrevive a uma navegação de rota apenas porque o container está montado no layout raiz; não há armazenamento envolvido.
- **Ações dentro do aviso** (botões de desfazer, links) — não existem hoje e não são introduzidas.
- **Agrupamento/deduplicação** de avisos idênticos — a spec decide explicitamente por exibir os dois, para não esconder do usuário que a ação ocorreu duas vezes.
