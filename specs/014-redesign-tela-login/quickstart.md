# Quickstart — Verificação do Redesign da Tela de Login

**Feature**: `014-redesign-tela-login` | **Data**: 2026-08-16

Roteiro de verificação da feature. Não há testes automatizados de UI neste repositório (ver D10
em [research.md](./research.md)) — este documento **é** a suíte, e cada passo aponta o critério
de sucesso que fecha.

## Pré-requisitos

- Node 24, dependências instaladas (`npm ci`)
- `.env` com as variáveis já usadas em desenvolvimento (banco, better-auth, provedores sociais)
- Uma conta de teste com e-mail e senha válidos
- DevTools do navegador (emulação de dispositivo, throttling de rede, auditoria de
  acessibilidade)

## Portões automatizados

Rodar antes de qualquer verificação manual. Todos precisam passar limpos.

```bash
npx tsc --noEmit
npx eslint app src
npx prettier --check "app/**/*.{ts,tsx}" "src/**/*.{ts,tsx}"
npx next build
npm test          # suíte de domain/application — precisa continuar verde (nada aqui a toca)
```

Subir o ambiente:

```bash
npm run dev
```

---

## Bloco 1 — Composição e identidade (US1 · SC-001)

Abrir `http://localhost:3000/login` em desktop, janela de 1280×800, sem sessão.

| # | Verificar | Fecha |
| --- | --- | --- |
| 1.1 | Marca, nome do sistema e mensagem de propósito visíveis, com a marca em maior peso visual | FR-001, FR-002 |
| 1.2 | Opções de acesso agrupadas em cartão visualmente delimitado, distinto do fundo | FR-003 |
| 1.3 | Hierarquia clara entre ação primária, secundárias e texto informativo | FR-004 |
| 1.4 | Nenhuma rolagem vertical em 1280×800 | US1 cenário 1 |
| 1.5 | Exatamente um `<h1>` na página (`document.querySelectorAll('h1').length === 1`) | FR-016 |
| 1.6 | Três opções iniciais, mesmos rótulos e mesma ordem de antes | FR-021 |

**SC-001** exige teste com pelo menos 5 pessoas: mostrar a tela por 5 segundos e perguntar de
que organização é a ferramenta. Não é verificável sozinho — agendar.

## Bloco 2 — Fundo e contraste sobre a foto (US1 · SC-010)

| # | Ação | Esperado | Fecha |
| --- | --- | --- | --- |
| 2.1 | DevTools → bloquear a requisição da imagem de fundo e recarregar | Tela inteiramente legível e operável; nenhum texto ilegível | FR-006b, FR-006d |
| 2.2 | Network → "Slow 3G", recarregar e observar | Conteúdo utilizável antes da foto; nada se desloca quando ela chega | FR-006d, SC-006 |
| 2.3 | Conta-gotas em 5 pontos distintos da foto (incluindo o mais claro e o mais escuro), medir contraste do texto sobreposto | ≥ 4.5:1 (≥ 3:1 texto grande) em todos | FR-006c, SC-010 |
| 2.4 | Repetir 2.3 no tema escuro | Idem | FR-006f, SC-010 |
| 2.5 | Emulação de celular (360px), aba Network | A variante de desktop da foto **não** é baixada | FR-006e |
| 2.6 | Comparar bytes até a tela ficar operável com os da versão anterior (`git stash`) | Igual ou menor | SC-006a |
| 2.7 | Conferir `public/login/PROCEDENCIA.md` | Existe, com origem e licença | FR-006g |

> **Enquanto a fotografia não existir** (D2): 2.1, 2.2, 2.5 e 2.6 valem contra o gradiente de
> marca e devem passar. 2.3, 2.4 e 2.7 ficam **pendentes** e bloqueiam o aceite das FR-006a e
> FR-006g — não o restante da feature.

## Bloco 3 — Mobile em campo (US2 · SC-002, SC-003, SC-007)

Emulação de dispositivo a 360×640.

| # | Verificar | Fecha |
| --- | --- | --- |
| 3.1 | Coluna única, sem rolagem horizontal, nenhum texto abaixo do tamanho legível | FR-007, FR-008 |
| 3.2 | Primeira opção de acesso alcançável **sem rolar** | FR-008 |
| 3.3 | Todo botão e campo com ≥ 44×44px (inspecionar caixa) | FR-010, §1.3 |
| 3.4 | Campo de e-mail abre teclado de e-mail e permanece visível acima dele (aparelho real) | US2 cenário 3 |
| 3.5 | Paisagem ~360×400: rola verticalmente, sem corte nem sobreposição | Edge case |
| 3.6 | Larguras 320, 360, 768, 1280, 2560: sem rolagem horizontal nem sobreposição | FR-007, FR-009, SC-007 |
| 3.7 | Zoom de 200%: reflow sem sobreposição, nada interativo perdido | FR-011 |
| 3.8 | Entrada completa com credenciais válidas em menos de 30s | SC-002 |

## Bloco 4 — Acessibilidade (US3 · SC-004, SC-005)

Executar **duas vezes**: tema claro e tema escuro. Trocar o tema pela preferência do sistema
operacional — a tela pública não tem alternador (D13).

| # | Ação | Esperado | Fecha |
| --- | --- | --- | --- |
| 4.1 | Percorrer com Tab do início ao fim | Ordem de foco = ordem visual; anel visível em todos | FR-013, SC-004 |
| 4.2 | Concluir a entrada usando só o teclado | Funciona; sem armadilha de foco | SC-004 |
| 4.3 | Auditoria automatizada (axe / Lighthouse) | Zero violações A e AA | SC-005 |
| 4.4 | Leitor de tela (NVDA ou VoiceOver) | Anuncia nome do sistema, propósito e cada opção; nada decorativo é anunciado | US3 cenário 3, FR-014 |
| 4.5 | Ativar movimento reduzido no SO e recarregar | Nenhuma animação de entrada nem movimento contínuo | FR-015 |
| 4.6 | Inspecionar a camada de fundo | `aria-hidden`, sem texto alternativo | FR-014, FR-006b |

## Bloco 5 — Avisos e estados (US4)

| # | URL / ação | Esperado | Fecha |
| --- | --- | --- | --- |
| 5.1 | `/login?motivo=expirado` em 360×640 | Aviso acima das opções, visível sem rolagem | FR-017 |
| 5.2 | `/login?error=account_not_linked` | Mensagem em pt-BR explicando o caminho de saída | FR-027 |
| 5.3 | `/login?error=xpto_desconhecido` | Mensagem genérica em pt-BR, nunca o código cru | FR-027, edge case |
| 5.4 | `/login?motivo=expirado` → "Usar usuário e senha" | Aviso segue legível; conteúdo não salta | FR-018, FR-020 |
| 5.5 | Credenciais erradas | "E-mail ou senha incorretos." — sem revelar se o e-mail existe | FR-024 |
| 5.6 | Acionar um login social | Só aquele botão mostra carregamento; os demais ficam inertes | FR-019 |
| 5.7 | Alternar `'opcoes'` ↔ `'credenciais'` observando o topo do cartão | Não salta de posição | FR-020 |

## Bloco 6 — Componente `Password` (US5 · SC-011)

Na tela de login, estado de e-mail e senha. Repetir em claro e escuro.

| # | Ação | Esperado | Fecha |
| --- | --- | --- | --- |
| 6.1 | Abrir o formulário | Campo mascarado; ícone de revelar presente | FR-031 |
| 6.2 | Digitar e acionar o ícone com o mouse | Texto em claro; valor inalterado; **alterna uma vez só** | FR-030, FR-034 |
| 6.3 | Acionar de novo | Volta a mascarar | FR-030 |
| 6.4 | Chegar ao ícone com Tab | **Recebe foco** com anel visível — a correção do D6; sem ela o Ark o deixa fora da tabulação | FR-033 |
| 6.5 | Acionar com Enter e com Espaço | Alterna; **o formulário não é submetido**; a página não rola no Espaço | FR-033 |
| 6.6 | Posicionar o cursor no meio do texto e alternar | Valor e posição do cursor preservados | FR-034 |
| 6.7 | Leitor de tela no ícone | "Mostrar senha" quando oculto, "Ocultar senha" quando visível | FR-032 |
| 6.8 | Digitar uma senha longa | O texto nunca passa por baixo do ícone | FR-036 |
| 6.9 | Ícone: medir a caixa | ≥ 44×44px | FR-036, FR-010 |
| 6.10 | Submeter vazio | Erro do resolver Zod na faixa padrão; borda de erro; `aria-invalid` | FR-035, §4.2.1 |
| 6.11 | Gerenciador de senha (1Password/Bitwarden/nativo) | Reconhece e preenche o campo | FR-035 |
| 6.12 | Revelar, "Voltar", reabrir o formulário | Campo volta **mascarado** | FR-031 |
| 6.13 | Autopreenchimento do navegador no tema escuro | Texto legível | Edge case |
| 6.14 | Abrir `/design-system` e localizar o `Password` na galeria | Presente, validável em claro/escuro | §7 do design system |

**SC-011** exige usuário de teste: quem erra a senha na primeira tentativa deve corrigir usando
a alternância, sem uma terceira tentativa. Agendar junto com o SC-001.

## Bloco 7 — Cadastro e preservação (US6)

| # | Verificar | Fecha |
| --- | --- | --- |
| 7.1 | Convite ao cadastro visível no estado inicial, com link para `/cadastro` | FR-028 |
| 7.2 | Continua acessível no estado de e-mail e senha | FR-028, US6 cenário 2 |
| 7.3 | Login com Google e com Facebook completos | FR-005 de `001`, FR-021 |
| 7.4 | Aviso de transparência sobre os dados do provedor visível antes do redirecionamento | FR-023 |
| 7.5 | `/login?redirecionar=/estoque` → autenticar | Cai em `/estoque` | FR-026 |
| 7.6 | Autenticado, abrir `/login` | Redireciona sem exibir o formulário | FR-025 |
| 7.7 | "Voltar" após preencher os campos | Valores descartados | FR-022 |
| 7.8 | Botão "voltar" do navegador após trocar de estado | Sem estado inconsistente | Edge case |

**SC-008** fecha quando 7.3 a 7.8, mais 5.2, 5.3 e 5.5, passarem: são as 11 verificações
herdadas de `001-unified-login-flow` mais a FR-010 de `011-auto-cadastro-provedor`.

## Bloco 8 — Disciplina do design system (SC-009)

| # | Verificar | Fecha |
| --- | --- | --- |
| 8.1 | Inspecionar o código da tela e do `Password`: nenhuma cor, espaçamento, tipografia, raio ou sombra fora dos tokens | FR-005, SC-009 |
| 8.2 | Componentes compartilhados reutilizados (`Button`, `Campo`, `Alert`, `Logo`), sem equivalente local | FR-006 |
| 8.3 | Nenhum texto de interface em inglês fixo | §6 do design system, Princípio II |
| 8.4 | `spec/DESIGN_SYSTEM.md` §4.2 e §5 atualizados com o `Password` | §5 |

---

## Resumo de cobertura

| Critério | Onde fecha |
| --- | --- |
| SC-001 | Bloco 1 + teste com 5 pessoas (agendar) |
| SC-002 | 3.8 |
| SC-003 | 3.3, 3.7 + usuários de teste |
| SC-004 | 4.1, 4.2 |
| SC-005 | 4.3 |
| SC-006 | 2.2 |
| SC-006a | 2.6 |
| SC-007 | 3.6 |
| SC-008 | Bloco 7 + 5.2, 5.3, 5.5 |
| SC-009 | Bloco 8 |
| SC-010 | 2.3, 2.4 — **pendente do ativo de imagem** |
| SC-011 | Bloco 6 + usuários de teste |

**Dois itens não fecham sozinhos**: SC-001 e SC-011 exigem usuários de teste, e SC-010 exige a
fotografia. Tudo o mais é verificável hoje.
