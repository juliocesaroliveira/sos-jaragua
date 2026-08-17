# Contrato: composição da tela de login

**Feature**: `014-redesign-tela-login` | **Rota**: `/login`
**Cobre**: FR-001 a FR-020, FR-028 | **Arquivos**: `app/(publico)/login/`

---

## Camadas e empilhamento

Três camadas, de trás para frente. Só a terceira participa do fluxo do documento.

| # | Camada | Componente | Fluxo | Acessível? |
| --- | --- | --- | --- | --- |
| 1 | Fundo — gradiente de marca, sempre presente | `fundo-login.tsx` | Fora (fixa, cobre a viewport) | `aria-hidden` |
| 2 | Fotografia + scrim — só a partir de `md` | `fundo-login.tsx` | Fora (mesma caixa da camada 1) | `aria-hidden` |
| 3 | Conteúdo — painel de marca + cartão de acesso | `page.tsx` | No fluxo, rolável | Sim |

Empilhamento **abaixo** de tudo em `CAMADA` (`cn.ts`): a tela pública não tem diálogo, gaveta
nem menu, então as camadas de fundo usam `z-index` negativo ou `isolate` no contêiner — nunca
entram na escala de `CAMADA`, que é reservada a elementos flutuantes.

## Camada de fundo — `fundo-login.tsx`

Server Component. Isola o único insumo que o repositório ainda não tem (D2).

**Contrato**:

- **MUST** renderizar o gradiente de marca **incondicionalmente**, e é ele que garante o
  contraste (FR-006d). O gradiente é derivado de tokens (`primary`, `neutral`, `surface`), sem
  cor avulsa (FR-005).
- **MUST** renderizar a fotografia apenas a partir de `md` (FR-006e).
- **MUST** tratar a fotografia como opcional: sem o arquivo, a tela fica completa e correta —
  só perde a foto.
- **MUST** ser `aria-hidden`, sem texto alternativo: é decorativa (FR-006b, FR-014).
- **MUST NOT** ser `priority`, e **MUST NOT** reposicionar nada ao carregar (FR-006d, SC-006).
- **MUST** definir o tratamento separadamente para claro e escuro (FR-006f).

**Quando a fotografia entrar**:

| Aspecto | Exigência |
| --- | --- |
| Import | Estático, para que o build gere dimensões e `blurDataURL` |
| Ajuste | Cobre a caixa, centralizado, sem distorcer |
| Entrega | `sizes` que impeça o celular de baixar a variante de desktop |
| Chegada | Transição de opacidade curta; suprimida sob movimento reduzido (FR-015) |
| Procedência | `public/login/PROCEDENCIA.md` com origem e licença (FR-006g) |

**Scrim** (camada 2, sobre a foto): a opacidade tem **mínimo garantido** na região onde há
texto — um gradiente que chegue a zero ali quebra a FR-006c. O contraste do texto é calculado
contra o scrim, nunca contra a foto (D3).

## Painel de marca — `painel-marca.tsx`

Server Component. Marca, nome do sistema e mensagem de propósito (FR-001, FR-002).

- Usa o `Logo` compartilhado; não recria a marca (FR-006).
- Contém o único `<h1>` da página (FR-016).
- Todo o texto fica sobre região com scrim de opacidade mínima garantida (FR-006c).
- Em mobile aparece acima do cartão, compacto, sem competir com o bloco de acesso (FR-008).

## Cartão de acesso

Envolve `<LoginForm />`. É o elemento de maior peso visual (FR-003, FR-004).

| Contexto | Aparência |
| --- | --- |
| Base (< `md`) | Superfície sólida (`surface`), sem desfoque, sem translucidez |
| `md`+ | Translúcido sobre a foto, com desfoque de fundo e borda; opacidade alta o bastante para o fundo efetivo do texto ser praticamente o token de superfície |
| `prefers-contrast: more` | Opaco; scrim intensificado |
| `prefers-reduced-transparency` | Opaco; desfoque removido |

**Por que não há desfoque no mobile**: `backdrop-filter` é caro em Android de baixo custo, e no
mobile não há foto atrás — o efeito não teria o que desfocar. Corta custo sem perder nada
(D1).

Raio `rounded-xl`, sombra conforme §1.5 (no escuro, borda em vez de sombra). Nenhum valor
visual novo (SC-009).

## Faixa de avisos

Posição **fixa e previsível**, dentro do cartão, imediatamente acima das opções de acesso
(FR-017).

- Comporta mais de um aviso simultâneo (sessão expirada + erro) sem empurrar as opções para
  fora da tela (FR-018, edge case).
- Em 360×640px, com aviso visível, a primeira opção de acesso permanece alcançável sem rolagem
  (FR-008, FR-017).
- Usa o `Alert` compartilhado, sem variante nova (FR-006).

## Estabilidade entre os dois estados

FR-020: alternar entre `'opcoes'` e `'credenciais'` não pode deslocar o cartão.

Os dois estados têm alturas naturais diferentes (3 botões + parágrafo vs. 2 campos + 2 botões).
O contrato **não** exige alturas idênticas — exige que o cartão não *salte*: ancorá-lo de modo
que a variação de altura não reposicione o que já estava sob os olhos do usuário. Ancoragem
pelo topo do cartão, não pelo centro da viewport, resolve.

## Comportamento responsivo

| Faixa | Composição |
| --- | --- |
| 320–767px | Coluna única, fundo sólido, sem foto. Marca compacta no topo, cartão, convite ao cadastro |
| 768–1023px | Foto entra; conteúdo ainda em coluna, centralizado |
| 1024px+ | Duas zonas: painel institucional e cartão de acesso |
| 2560px | Conteúdo com largura máxima, sem esticar; a foto continua cobrindo (FR-009) |

Mobile-first (DESIGN_SYSTEM.md §6): a base é a versão de celular, `md:`/`lg:` acrescentam.

**Altura reduzida** (celular em paisagem, ~360×400px): a tela rola verticalmente em vez de
cortar ou sobrepor. Sem `100vh` travando conteúdo fora de alcance — usar `min-h-dvh`, como o
`page.tsx` atual já faz.

## Convite ao cadastro

FR-028: link para `/cadastro` visível nos **dois** estados da tela — logo, fora do bloco que
alterna entre `'opcoes'` e `'credenciais'`.

## O que não muda

Contrato de preservação (FR-021 a FR-027). `login-form.tsx` tem sua **apresentação** alterada
e sua **lógica** intocada:

- Os três botões iniciais, com os mesmos rótulos e na mesma ordem.
- A alternância sem navegação; "Voltar" descartando os campos.
- O aviso de transparência sobre os dados obtidos do provedor.
- `signIn.email` e `signIn.social` com os mesmos argumentos, incluindo `errorCallbackURL`.
- `MENSAGEM_POR_ERRO_SOCIAL` e o texto genérico, sem alteração.
- "E-mail ou senha incorretos." — genérica de propósito.
- `redirecionar`, `motivo` e `error` lidos como hoje.
- `page.tsx`: `obterSessao()`, redirecionamento de quem já está autenticado, `instant = false`,
  e o limite de `Suspense` que o `useSearchParams` exige.

**A única mudança funcional dentro do formulário** é o campo de senha passar a ser o
`Password` — mesmo `register('senha')`, mesmo nome, mesmo resolver Zod.

## Fronteira servidor/cliente

| Arquivo | Tipo |
| --- | --- |
| `page.tsx` | Server — lê sessão, redireciona, `instant = false` |
| `fundo-login.tsx` | Server — imagem e gradiente, sem estado |
| `painel-marca.tsx` | Server — texto e marca |
| `login-form.tsx` | Client — já é, por `useSearchParams`/`useForm` |
| `password.tsx` | Client — máquina do Ark |

Nada novo cruza para o cliente (D9).
