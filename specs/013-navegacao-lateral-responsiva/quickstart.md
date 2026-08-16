# Quickstart — Validação da feature 013

**Feature**: `013-navegacao-lateral-responsiva`

Roteiro para provar que a feature funciona. Sem código de implementação — os contratos estão em
[contracts/](./contracts/) e as regras em [data-model.md](./data-model.md).

**Natureza desta validação**: esta feature é sobre comportamento de viewport, foco e rolagem.
Barra de endereço recolhendo, foco contido num diálogo e gesto de voltar **não se verificam sem
navegador**. Por isso o roteiro manual é o instrumento principal aqui, e não um complemento — ao
contrário de features de regra de negócio, onde o teste automatizado é a autoridade.

## Pré-requisitos

- Ambiente já configurado do projeto — **nenhuma variável nova**, nenhum serviço novo, nenhuma
  migração.
- Uma conta de **coordenador ou administrador** (16 destinos, 7 grupos) e uma de **voluntário**
  (3 destinos). A diferença entre elas é o que expõe FR-011 e FR-012.
- Um **aparelho móvel real** ou, no mínimo, o modo de emulação do navegador. A emulação **não**
  reproduz o recolher da barra de endereço — a V1 exige aparelho de verdade.
- Uma tela longa para rolar: a fila de triagem ou a listagem de estoque servem.

## Setup

```bash
npm install
npm run dev
```

## Testes automatizados

```bash
npm test        # inclui a normalização da preferência de coluna
npm run lint
npm run build   # confirma que o shell compila sem o menu removido
```

Cobertura esperada — deliberadamente pequena, porque a feature não adiciona regra de negócio
(Princípio III):

- **Normalização da preferência**: `expandida` e `recolhida` passam; ausente, vazio, corrompido e
  qualquer outro valor resolvem para `expandida`.

## Validações manuais

### V1 — A barra de endereço volta a se recolher (FR-002, SC-002) — **aparelho real**

Abra uma tela longa em um celular e role para baixo.

**Esperado**: a barra de endereço do navegador se recolhe, como em qualquer site.

Este é o teste que prova que a correção foi estrutural. Se a barra não recolher, o layout ainda
tem um contêiner rolante em algum lugar.

### V2 — Uma única barra de rolagem (FR-001, SC-001)

Percorra as telas de listagem (estoque, voluntários, usuários) em desktop, com conteúdo suficiente
para ultrapassar a altura da janela.

**Esperado**: uma única barra vertical em cada tela. Tabelas largas continuam com rolagem
horizontal própria — isso é esperado e não conta como violação.

### V3 — Rolagem por teclado sem clicar antes (FR-004)

Carregue uma tela longa e pressione Page Down **sem clicar em nada** antes.

**Esperado**: a página rola. Hoje isso falha porque o contêiner rolante precisa receber foco
primeiro.

### V4 — A gaveta abre e fecha pelos quatro caminhos (FR-007, FR-008)

Em celular, abra a navegação e feche-a de cada uma das formas, uma por vez:

1. escolhendo um destino → navega e fecha
2. tocando no fundo escurecido → fecha sem navegar
3. pressionando Esc (teclado externo) → fecha sem navegar
4. usando o gesto ou botão de voltar do sistema → fecha sem sair da tela

**Esperado**: os quatro funcionam. O quarto é o mais frágil — se ele sair da tela em vez de fechar
a gaveta, falta a entrada de histórico (contrato G-04).

### V5 — O fundo não rola com a gaveta aberta (FR-003, SC-003) — **o teste central**

Abra a gaveta sobre uma tela longa e arraste o dedo sobre o conteúdo atrás dela, várias vezes, em
pontos diferentes.

**Esperado**: o conteúdo de trás não se move em nenhuma tentativa.

Este é o sintoma que a feature nasceu para corrigir, e é o que prova que a US1 realmente aconteceu
— o travamento de rolagem já existe hoje e não funciona porque age sobre o documento, que não é
quem rola.

### V6 — A gaveta comporta o perfil máximo e o mínimo (FR-011, FR-012, FR-005)

Com o **coordenador**: abra a gaveta e role até o último destino dos 16.
Com o **voluntário**: abra a gaveta e observe a altura ocupada.

**Esperado**: no primeiro caso, todos os destinos alcançáveis e a rolagem contida dentro da gaveta
— chegar ao fim da lista **não** rola a página atrás. No segundo, a gaveta não apresenta grande
área vazia.

### V7 — Teclado e leitor de tela na gaveta (FR-009, SC-006, SC-007)

Abra a gaveta e navegue apenas por Tab.

**Esperado**: o foco percorre os destinos e **não escapa** para a página atrás; ao fechar, o foco
volta ao botão de navegação. Com leitor de tela, os destinos são anunciados como **links**, e não
como itens de menu.

### V8 — Redimensionar cruzando o limiar (edge case)

Com a gaveta aberta em janela estreita, alargue a janela até passar o limiar de tela grande.

**Esperado**: a gaveta fecha e a coluna aparece. Nunca as duas ao mesmo tempo, nunca nenhuma.

### V9 — Recolher e expandir a coluna (FR-015, FR-022, SC-008)

Em janela de notebook, recolha a coluna numa tela de listagem larga.

**Esperado**: a trilha de ícones aparece e a tabela ganha largura. Meça: o ganho deve ser de ao
menos 200 px.

### V10 — A preferência sobrevive (FR-016, SC-009)

Recolha a coluna, navegue para outra tela, recarregue a página e feche/reabra o navegador.

**Esperado**: continua recolhida em todos os casos — e, o mais importante, **sem salto visual**:
a coluna não pode aparecer expandida por um instante antes de recolher. Se saltar, falta o script
inline (contrato C-02).

### V11 — Rótulo e identificação na coluna recolhida (FR-018, FR-019, C-05)

Com a coluna recolhida: aponte um ícone; percorra a trilha por teclado; navegue com leitor de
tela; e olhe a tela inteira procurando a identificação da aplicação.

**Esperado**: a dica com o rótulo aparece ao apontar e ao focar; o leitor anuncia cada destino
pelo rótulo; o destino atual é identificável; os grupos continuam separados; e a identificação da
aplicação está visível em algum lugar. Este último é a regressão fácil — a topbar a esconde em
telas grandes porque a coluna expandida a exibia.

### V12 — Movimento reduzido (FR-014)

Ative "reduzir movimento" no sistema e abra a gaveta.

**Esperado**: a abertura respeita a preferência.

### V13 — Teclado virtual e rotação (edge cases)

Em celular: abra um formulário, foque um campo para levantar o teclado, e então abra a navegação.
Depois, gire o aparelho com a gaveta aberta.

**Esperado**: a gaveta permanece utilizável e legível nos dois casos, sem corte.

## Checklist de conclusão

- [ ] `npm test`, `npm run lint` e `npm run build` verdes
- [ ] V1–V13 conferidos, com V1 e V5 em **aparelho real**
- [ ] Nenhuma dependência adicionada ao `package.json`
- [ ] Nenhuma migração em `db/migrations/`
- [ ] `menu-mobile.tsx` removido; nenhuma referência restante a ele
- [ ] Nenhum `overflow-y-auto` reintroduzido no `<main>` do shell
- [ ] Destinos por perfil idênticos aos de antes (SC-010)
- [ ] Interface 100% pt-BR
