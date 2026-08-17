# Procedência da imagem de fundo da tela de login

**Status: EM ABERTO — a imagem ainda não foi recebida.**

A FR-006g de `specs/014-redesign-tela-login/spec.md` exige que a fotografia de fundo tenha
origem e direito de uso documentados. Enquanto este arquivo estiver em aberto, a tela de login
renderiza apenas o gradiente de marca — o que é uma composição completa e correta, só não é a
composição imersiva decidida na especificação.

**Não preencher com imagem de banco genérica.** A spec veta explicitamente esse caminho: uma
foto genérica de "equipe de resgate" em uma tela institucional lê como falsidade, que é o
oposto do objetivo da feature.

## Requisitos do arquivo

| Aspecto | Exigência |
| --- | --- |
| Nome | `fundo-login.jpg` (nesta pasta) |
| Assunto | Operação da Defesa Civil, equipe ou cidade de Jaraguá do Sul — reconhecível como local |
| Origem | Acervo próprio da Defesa Civil, ou licença compatível com uso institucional |
| Resolução mínima | 2560px na maior dimensão (cobre o limite superior da FR-007) |
| Enquadramento | Assunto **fora** da faixa central-direita, onde o cartão de acesso o cobriria |
| Composição tonal | Preferir tonalidade média a escura — reduz o quanto o scrim precisa escurecer |
| Formato | JPEG; a otimização para AVIF/WebP é feita no build |

## Registro (preencher ao receber)

| Campo | Valor |
| --- | --- |
| Arquivo | _pendente_ |
| Autoria | _pendente_ |
| Data da captura | _pendente_ |
| Origem / acervo | _pendente_ |
| Licença ou autorização de uso | _pendente_ |
| Pessoas identificáveis na imagem? | _pendente_ — se sim, anexar autorização de uso de imagem |
| Recebido em | _pendente_ |

## Ao preencher

1. Colocar `fundo-login.jpg` nesta pasta
2. Descomentar o import estático em `app/(publico)/login/fundo-login.tsx`
3. Preencher a tabela acima
4. Executar os passos 2.3, 2.4 e 2.7 do `quickstart.md` — contraste em 5 pontos da imagem,
   incluindo o mais claro e o mais escuro, nos dois temas
