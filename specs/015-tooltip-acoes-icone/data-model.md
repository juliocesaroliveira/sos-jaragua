# Fase 1 — Modelo: Tooltip em ações de ícone

**Não há entidade de domínio, tabela, migração ou estado de servidor nesta feature.** O que segue
modela o estado de interface e o vocabulário de configuração — é isso que precisa estar acordado
antes da implementação.

## Entidades

### Dica (tooltip)

Rótulo textual efêmero associado a um controle, exibido por ponteiro ou foco.

| Atributo | Tipo | Regra |
| --- | --- | --- |
| `conteudo` | texto | Obrigatório, não vazio, pt-BR, imperativo curto. Sem pontuação final. |
| `posicao` | `top` \| `bottom` \| `left` \| `right` | Padrão `top`. É **preferência**, não garantia: reposiciona se não couber (FR-004). |
| `atrasoMs` | número | Padrão 300. Atraso antes de abrir por ponteiro; foco de teclado abre sem atraso. |
| `descricao` | booleano | Padrão `false`. Ver "Papel da dica" abaixo. |

### Papel da dica

Determina como a dica é (ou não é) exposta à tecnologia assistiva. É a distinção central do
modelo — ver `research.md` D3.

| Papel | Quando | Efeito |
| --- | --- | --- |
| **Repetição visual** (`descricao: false`, padrão) | O texto da dica é igual ao nome acessível do controle | A dica é apenas visual; nada é anunciado por ela. Evita o anúncio duplicado. |
| **Descrição** (`descricao: true`) | O texto acrescenta informação que o nome não carrega — na prática, o motivo de a ação estar indisponível | A dica é exposta como descrição do controle e anunciada além do nome. |

**Invariante**: se `descricao` é `false`, `conteudo` **deve** ser a mesma expressão usada como nome
acessível do controle. Duas strings literais iguais escritas separadamente violam o espírito da
regra (elas divergem com o tempo) — a origem tem que ser uma só.

### Estado de disponibilidade do controle de ícone

| Estado | Aparência | Foco | Ponteiro | Clique | Dica |
| --- | --- | --- | --- | --- | --- |
| **Disponível** | normal | recebe | recebe | executa | repetição visual |
| **Inativo** (`inativo`) | esmaecida | **recebe** | **recebe** | ignorado no componente | **descrição** com o motivo |
| **Desabilitado** (`disabled` nativo) | esmaecida | não recebe | não recebe | impossível | nenhuma — não há como exibi-la |
| **Carregando** (`loading`) | indicador girando | não recebe | não recebe | impossível | nenhuma, por ser transitório |

**Regra de escolha**: use `inativo` **somente** quando houver uma dica explicando o motivo. Sem
explicação, `inativo` só produz um controle focável que não faz nada — pior que `disabled`.

**Invariante**: `inativo` e `disabled` não convivem no mesmo controle. Se ambos forem informados,
`disabled` vence (é a garantia mais forte) — e isso indica erro de uso.

## Transições de estado da dica

```text
oculta ──ponteiro entra, 300ms──▶ visível
oculta ──foco de teclado──────────▶ visível        (sem atraso)
oculta ──toque────────────────────▶ oculta          (não existe hover em toque)

visível ──ponteiro sai────────────▶ oculta
visível ──foco sai────────────────▶ oculta
visível ──Esc────────────────────▶ oculta          (foco permanece no controle)
visível ──clique/pointerdown─────▶ oculta
visível ──rolagem────────────────▶ oculta
visível ──rótulo muda (ex.: tema alterna)──▶ visível com o novo texto
```

Todas essas transições, exceto a última, são comportamento padrão do primitivo — ver `research.md`
D2. A última decorre de o texto ser derivado do estado atual do controle, não memorizado.

## Vocabulário dos textos (pt-BR)

| Controle | Texto da dica | Papel |
| --- | --- | --- |
| Abrir navegação | `Abrir navegação` | repetição |
| Sair | `Sair` | repetição |
| Sino | `Notificações` / `Notificações (N não lidas)` | repetição |
| Tema | `Mudar para tema claro` / `Mudar para tema escuro` | repetição |
| Recolher coluna | `Recolher navegação` / `Expandir navegação` | repetição |
| Editar usuário | `Editar {nome}` | repetição |
| Alocar no turno | `Alocar voluntário neste turno` | repetição |
| Remover do turno | `Remover {nome} do turno` | repetição |
| Remover linha (disponível) | `Remover linha` | repetição |
| Remover linha (inativo) | `A saída precisa de ao menos uma linha` | descrição |
| Remover componente (disponível) | `Remover componente` | repetição |
| Remover componente (inativo) | `O kit precisa de ao menos um componente` | descrição |

Todos os textos de "repetição" já existem hoje como `aria-label` nos respectivos arquivos — o
trabalho é reaproveitá-los, não redigi-los.

## O que esta feature não modela

- Nenhuma entidade de domínio, nenhuma tabela, nenhuma migração.
- Nenhuma preferência persistida — a dica não guarda estado entre sessões.
- Nenhuma permissão: quem pode ver o controle continua decidido onde já era.
- Nenhum evento de auditoria: exibir uma dica não é escrita.
