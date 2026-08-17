# Phase 0 — Research: Redesign da Tela de Login

**Feature**: `014-redesign-tela-login` | **Data**: 2026-08-16

Este documento resolve as incógnitas técnicas do plano antes de qualquer código. Cada entrada
segue o formato Decisão / Motivo / Alternativas consideradas.

---

## D1 — Estrutura da composição: imersiva no desktop, sólida no mobile

**Decisão**: a tela tem duas composições distintas, separadas no breakpoint `md` (768px).

- **Base (mobile, < 768px)**: coluna única sobre `--background` sólido. **Sem fotografia,
  sem desfoque.** Marca no topo, cartão de acesso ocupando a largura útil, convite ao
  cadastro no rodapé.
- **`md`+ (tablet/desktop)**: fotografia em tela cheia como camada de fundo, sobre ela um
  gradiente de contraste (_scrim_), e sobre esse conjunto o conteúdo em duas zonas — bloco
  institucional (marca + nome + mensagem) e cartão de acesso translúcido.

**Motivo**: as FR-006e e SC-006a proíbem mandar a imagem de desktop para o celular, e a
FR-010/§1.3 do design system exige alvos de 44px que já consomem a altura útil de uma tela de
360×640. Uma foto atrás do cartão em mobile custaria bytes em 3G (o cenário de campo da
constituição, Princípio VI) sem ganho — o cartão ocuparia quase toda a viewport e a foto seria
uma moldura de poucos pixels. Cortar a foto no mobile não é uma degradação: é a decisão certa
para o contexto de uso, e ainda entrega a SC-006a de graça.

**Alternativas consideradas**:

- _Foto também no mobile, em versão pequena_: rejeitado — paga bytes e custo de composição
  (`backdrop-filter` é caro em Android de baixo custo) por área visível quase nula.
- _Painel dividido também no desktop_ (a opção A oferecida na spec): descartado pela decisão
  do usuário na fase de especificação.

---

## D2 — Fotografia de fundo: ativo ainda inexistente

**Decisão**: o repositório **não possui** a fotografia, e o plano **não a inventa**. O
trabalho é estruturado para que tudo, exceto o arquivo de imagem, seja construído e
verificável sem ela:

- A camada de fundo é um componente próprio com **duas camadas empilhadas**: um gradiente de
  marca (sempre presente, gerado por token) e, por cima, a fotografia (opcional).
- Enquanto o arquivo não existir, o componente renderiza só o gradiente. A tela fica
  completa, correta e entregável; a foto é um _drop-in_ posterior de um arquivo só.
- FR-006a e FR-006g só são consideradas atendidas quando o arquivo entra **com origem e
  licença registradas** em `public/login/PROCEDENCIA.md`.

**Motivo**: a spec veta explicitamente resolver com imagem de banco genérica, e travar a
feature inteira à espera de um arquivo desperdiça todo o restante do trabalho — que é a maior
parte. Separar a camada em componente próprio custa quase nada e transforma um bloqueio em
uma tarefa isolada.

**Requisitos do arquivo, quando vier**:

| Aspecto | Exigência |
| --- | --- |
| Assunto | Operação da Defesa Civil, equipe ou cidade de Jaraguá do Sul — reconhecível como local |
| Origem | Acervo próprio da Defesa Civil, ou licença compatível com uso institucional, registrada |
| Resolução mínima | 2560px na maior dimensão (cobre o limite superior da FR-007) |
| Enquadramento | Assunto fora da faixa central-direita, onde o cartão o cobriria |
| Formato de entrega | Import estático, servido pelo otimizador de imagem em AVIF/WebP |
| Composição tonal | Preferir imagem de tonalidade média a escura — reduz o quanto o scrim precisa escurecer |

**Alternativas consideradas**:

- _Bloquear a feature até a foto existir_: rejeitado — a foto é ~10% do trabalho e 100% do
  atraso.
- _Foto de banco genérica como provisório_: vetado pela spec, e com razão: uma foto genérica
  de "equipe de resgate" em uma tela institucional lê como falsidade, o oposto do objetivo.
- _Ilustração vetorial no lugar da foto_: seria mudar a decisão do usuário; o gradiente de
  marca já cumpre o papel de provisório sem fingir ser a decisão final.

---

## D3 — Garantia de contraste sobre imagem variável

**Decisão**: três mecanismos empilhados, de modo que nenhum texto dependa do que a foto tem
atrás dele.

1. **Nenhum texto sobre a foto crua.** Todo texto está ou dentro do cartão, ou sobre a zona
   institucional coberta pelo scrim.
2. **Scrim determinístico**: gradiente sobre a foto com opacidade **mínima garantida** na
   região onde há texto (não um gradiente que chegue a zero ali). A cor do scrim vem de token
   e é definida separadamente por tema (FR-006f).
3. **Cartão suficientemente opaco**: o cartão translúcido usa opacidade alta o bastante para
   que o fundo efetivo do texto seja praticamente o token de superfície — o "vidro" é efeito
   de borda e desfoque, não transparência real do fundo de leitura.

O ponto central: **a translucidez é decorativa, o contraste é calculado contra o token**, não
contra a foto. Assim a SC-010 (verificar em 5 pontos da imagem) passa por construção, e trocar
a fotografia depois não reabre a auditoria de contraste.

**Reforços por preferência do usuário** (progressivos, não obrigatórios ao MVP):

- `prefers-contrast: more` → cartão fica totalmente opaco e o scrim intensifica.
- `prefers-reduced-transparency` → cartão fica opaco e o desfoque é removido.

**Motivo**: contraste sobre fotografia é a falha clássica desse tipo de tela, e a única forma
de garanti-lo sem depender da imagem escolhida é não deixar a imagem participar do cálculo.
Foi a reserva nº 2 levantada na especificação, e esta é a resposta a ela.

**Alternativas consideradas**:

- _Escolher a foto e medir contraste ponto a ponto_: rejeitado — a garantia morre na primeira
  troca de imagem, e a spec já prevê que a foto ainda será escolhida.
- _Extrair cor dominante da foto em tempo de build e derivar o scrim_: complexidade
  desproporcional (Princípio VI) para um problema que um scrim fixo resolve.

---

## D4 — Peso e sequência de carregamento da fotografia

**Decisão**:

- A foto **não** é `priority` e **não** bloqueia nada: o gradiente de marca pinta primeiro e
  já garante todo o contraste (FR-006d).
- Import estático, para que o build gere `blurDataURL` e dimensões — o que elimina
  deslocamento de layout na chegada da imagem (SC-006).
- Servida apenas a partir de `md` via `sizes`, de modo que o celular não baixe a variante de
  desktop (FR-006e).
- A camada de fundo é `aria-hidden` e ocupa posição fixa fora do fluxo — sua chegada não pode
  reposicionar nada.

**Motivo**: reserva nº 3 da especificação — o peso da imagem conflita com o uso em campo sob
3G. Com o gradiente pintando primeiro e a foto entrando por cima sem reflow, o tempo até a
tela ficar operável não depende da imagem, que é exatamente o que a SC-006/SC-006a pedem.

---

## D5 — Base do componente `Password`: `PasswordInput` do Ark UI

**Decisão**: construir `src/shared/ui/password/password.tsx` sobre
`@ark-ui/react` → `PasswordInput` (partes `Root`, `Control`, `Input`, `VisibilityTrigger`),
como determinado pelo usuário.

**O que o Ark entrega de graça** (verificado em `@zag-js/password-input`):

- Alternância de `type` entre `password` e `text` — sem tocar no valor (FR-034).
- `translations.visibilityTrigger: (visible) => string` — permite `aria-label` em pt-BR que
  muda com o estado (FR-032).
- `aria-controls` e `aria-expanded` no gatilho, apontando para o input.
- `type="button"` no gatilho — não submete o formulário (metade da FR-033).
- `defaultVisible` ausente ⇒ inicia oculto (FR-031).
- `autoComplete` tipado como `'current-password' | 'new-password'` — cobre login e cadastro.
- Não aplica os atributos de _opt-out_ de gerenciador de senha por padrão, então 1Password,
  Bitwarden e afins continuam reconhecendo o campo (FR-035).

**Alternativas consideradas**:

- _`<input>` nativo com `useState` local_: menos código, mas reimplementaria à mão os rótulos
  acessíveis e o `aria-controls`, e divergiria da convenção do design system de usar o
  primitivo Ark quando existe (DESIGN_SYSTEM.md §4). Descartado também por decisão do usuário.

---

## D6 — O gatilho do Ark é inacessível por teclado (correção obrigatória)

**Decisão**: sobrescrever o comportamento padrão do gatilho — `tabIndex={0}` e um
`onKeyDown` que aciona a alternância em `Enter` e `Espaço`.

**Motivo**: `getVisibilityTriggerProps()` do Zag emite **`tabIndex: -1`** e trata apenas
`onPointerDown`. Não há nenhum manipulador de teclado. Ou seja, **o gatilho do Ark, como vem,
não é alcançável nem acionável por teclado** — viola diretamente a FR-033 e a diretriz de
foco visível da DESIGN_SYSTEM.md §6.

Provavelmente é decisão deliberada da biblioteca (tirar o botão da ordem de tabulação encurta
a travessia do formulário, sob o argumento de que quem digita sabe o que digitou). Para esta
aplicação o argumento não se sustenta: a FR-033 é explícita, e quem navega por teclado inclui
quem usa leitor de tela e quer conferir o campo.

**Detalhe de implementação que evita um bug sutil**: usar `onKeyDown`, **não** `onClick`. O
Zag chama `event.preventDefault()` no `pointerdown`, o que impede o foco mas **não** impede o
evento `click` subsequente. Um `onClick` adicional dispararia junto com o `TRIGGER.CLICK` já
enviado pelo `pointerdown` e a visibilidade alternaria duas vezes no clique de mouse — voltando
ao estado original. Com `onKeyDown` os dois caminhos ficam disjuntos: ponteiro pelo Zag,
teclado pelo nosso manipulador.

**Alternativas consideradas**:

- _Aceitar `tabIndex: -1` e considerar a FR-033 atendida pelo campo em si_: rejeitado — a FR
  fala do controle de alternância, não do campo.
- _Trocar `onPointerDown` do Zag por `onClick` próprio_: exigiria anular o manipulador da
  biblioteca; sobrepor menos é mais estável a atualizações.

---

## D7 — Integração com a moldura `Campo` e com React Hook Form

**Decisão**: o `Password` reaproveita a moldura compartilhada `Campo` (rótulo, marcação de
obrigatório, faixa de apoio/erro) e **não** usa a parte `PasswordInput.Label` do Ark.

Consequências resolvidas:

- **Rótulo único.** `Campo` já renderiza `<label htmlFor={id}>`. Para que ele aponte para o
  input do Ark, passar `ids={{ input: id }}` ao `Root` — sem isso o Ark gera um id próprio e o
  rótulo apontaria para o vazio.
- **`aria-describedby`.** O Ark não o emite; o `Password` passa o valor calculado por
  `idsCampo()` diretamente na parte `Input`, como o `Input` atual faz. As props do usuário são
  mescladas sobre as da máquina, então isso funciona sem contorno.
- **React Hook Form.** A máquina do Ark é não controlada (não tem `value`/`onChange`): o
  retorno de `register('senha')` — `ref`, `name`, `onChange`, `onBlur` — é espalhado na parte
  `Input`, exatamente como no `Input` de hoje. `required` e `invalid` vão para o `Root`, que os
  propaga como `required`/`aria-invalid` no input.
- **Estilo.** A parte `Control` recebe as classes de borda/altura hoje aplicadas ao `<input>`
  (`CLASSES_CONTROLE_TEXTO`, `bordaControle`, `ALTURA_POR_TAMANHO`), e o `Input` interno fica
  transparente e sem borda — porque o gatilho precisa viver dentro da mesma caixa visual, à
  direita. O anel de foco passa a ser desenhado no `Control` via `focus-within`, não no input.

**Motivo**: a FR-035 exige preservar todo o comportamento do campo atual, e a única forma
barata de garantir isso é usar a mesma moldura, não recriá-la. A §4.2.1 do design system
(erro substitui apoio, altura estável) sai de graça.

**Alternativas consideradas**:

- _Usar `PasswordInput.Label` e dispensar `Campo`_: divergiria da marcação de erro de todos
  os outros campos — exatamente o drift visual que a §4 do design system existe para impedir.

---

## D8 — Reserva de área do gatilho dentro do campo

**Decisão**: o gatilho é um botão de 44×44px posicionado à direita **dentro** do `Control`, e o
input ganha padding à direita equivalente para que o texto digitado nunca passe por baixo dele.

**Motivo**: FR-036 (não sobrepor o texto, não reduzir a área acionável) e §1.3 do design
system (44px sem exceção em mobile). Um ícone de 20px com área de toque de 44px é o padrão já
usado pelo `IconButton`.

---

## D9 — Fronteira servidor/cliente da tela

**Decisão**: manter a divisão atual. `page.tsx` continua Server Component (lê a sessão,
redireciona, declara `instant = false`); a nova camada de fundo e o bloco institucional são
Server Components; só `login-form.tsx` e o `Password` são `'use client'`.

**Motivo**: nada na composição nova precisa de estado no cliente — é layout, imagem e texto. A
fronteira atual já é a correta, e ampliá-la mandaria bytes desnecessários para um dispositivo
de campo. `instant = false` continua obrigatório porque a página lê sessão a cada requisição
(DESIGN.md §7).

---

## D10 — Estratégia de verificação: sem harness de testes de UI

**Decisão**: esta feature **não adiciona testes automatizados**. A verificação é o roteiro
manual de `quickstart.md`, mais `tsc`, `eslint`, `prettier` e `next build`.

**Motivo**: verificado no repositório — `vitest.config.ts` roda em `environment: 'node'` com
`include: ['src/**/*.test.ts']`; não há jsdom, nem Testing Library, nem `.tsx` no escopo de
teste. Introduzir um harness de UI inteiro é uma decisão de arquitetura de testes que
extrapola um redesign de tela (Princípio VI) e contraria o Princípio III, que reserva a
cobertura obrigatória para `domain`/`application` e trata `presentation` como fina por design.

O que **não** é desculpa: a §6 do design system exige teste manual em claro e escuro antes de
considerar um componente pronto, e a §7 exige validação em duas larguras. O `quickstart.md`
transforma isso em roteiro conferível em vez de intenção.

**Alternativas consideradas**:

- _Introduzir Vitest + jsdom + Testing Library nesta feature_: valioso, mas é feature
  própria. Registrar como trabalho de acompanhamento.

---

## D11 — Movimento e animação

**Decisão**: a única animação da tela é uma transição de opacidade na chegada da fotografia e
o estado de carregamento já existente dos botões. Nenhuma animação de entrada de conteúdo,
nenhum movimento contínuo.

**Motivo**: FR-015. O projeto já trata movimento reduzido como requisito real e não enfeite
(ver o bloco `prefers-reduced-motion` em `app/globals.css`, escrito para os avisos). Uma tela
de login que "aparece animada" atrasa quem só quer entrar, e o contexto é operação sob
estresse.

---

## D12 — Escopo da adoção do `Password` nas demais telas

**Decisão**: nesta feature, apenas `login-form.tsx` adota o componente. Os outros quatro
campos de senha permanecem no `Input` atual.

Levantamento no repositório — cinco campos de senha em três arquivos:

| Arquivo | Campos | Nesta feature? |
| --- | --- | --- |
| `app/(publico)/login/login-form.tsx` | 1 | **Sim** (FR-037) |
| ~~`app/(publico)/cadastro/cadastro-form.tsx`~~ | ~~2~~ | **Arquivo removido em 2026-08-16** junto com a rota `/cadastro` |
| `app/(interno)/(staff)/admin/usuario-form-dialog.tsx` | 2 | Não |

**Motivo**: escopo definido na spec (FR-037 e Assumptions). Registro a ressalva de forma
explícita: deixar 4 de 5 campos no componente antigo é uma migração pela metade, e migrações
pela metade apodrecem. Os dois arquivos restantes são trocas de uma linha cada
(`<Input type="password">` → `<Password>`) mais a escolha de `autoComplete`
(`new-password` nos dois casos, ambos criam/redefinem senha). Recomendo incluí-los; se ficarem
fora, precisam virar item de acompanhamento com dono, não uma nota solta.

---

## D13 — Ausência de alternância de tema na tela pública

**Constatação, não decisão**: o `ThemeToggle` vive no topbar da área autenticada; a tela de
login não o tem. O tema segue a preferência do sistema operacional ou a escolha já persistida
em `localStorage`.

Isso **não** impede atender a US3 e a FR-012 — as duas falam de a tela funcionar em ambos os
temas, não de poder alternar ali. A verificação em tema escuro é feita mudando a preferência
do sistema operacional, e o `quickstart.md` diz como.

Registro porque é uma pergunta que aparece na revisão: adicionar um alternador à tela pública
seria requisito novo, fora desta spec.
