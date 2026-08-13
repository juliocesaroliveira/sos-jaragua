# Quickstart — Validação da Feature

**Feature**: Página Padrão de Endereço Não Encontrado (404)
**Data**: 2026-08-12

Roteiro para provar que a feature funciona ponta a ponta. Detalhes de contrato em [contracts/nao-encontrado.md](./contracts/nao-encontrado.md); estados de apresentação em [data-model.md](./data-model.md).

---

## Pré-requisitos

As contas de teste da feature 002 já servem — nenhuma conta nova é necessária.

```bash
npm install
npm run db:migrate
SEED_TESTE_PASSWORD='<sua-senha>' npm run db:seed   # se ainda não semeado
npm run dev
```

Contas por perfil e senha: ver `specs/002-role-based-app-shell/quickstart.md`.

---

## Nível 1 — Verificação automatizada

```bash
npm test          # inclui os testes de destinoDeRetorno
npm run lint
npx tsc --noEmit
npm run build     # ver Nível 6: o build é onde o risco de Cache Components aparece
```

**Esperado**: tudo verde. Em `rotas.test.ts`, as invariantes INV-01…INV-03 de [contracts/nao-encontrado.md](./contracts/nao-encontrado.md).

### O teste que mais importa

INV-01: o destino do botão com sessão é alcançável por **todos** os perfis. É a mesma classe de defeito que a feature 002 corrigiu no login — um botão de saída que leva a `/sem-permissao` é pior que não ter botão.

---

## Nível 2 — Com sessão: URL desconhecida (US1, SC-001)

Autenticado, acesse um endereço inventado — por exemplo `http://localhost:3000/pagina-que-nao-existe`.

Para **cada** um dos cinco perfis, confirme:

1. A página aparece em pt-BR, com identidade visual da aplicação — não a tela genérica em inglês.
2. Barra superior visível, com nome, perfil, tema, sino e sair.
3. Menu lateral visível, com **os destinos daquele perfil** (confira contra a matriz de `specs/002-role-based-app-shell/data-model.md`).
4. Botão de retorno presente e rotulado em pt-BR.
5. O endereço digitado **não** é ecoado na tela (FR-017).
6. O conteúdo não revela quais endereços existem (FR-015).

### Retorno e navegação (SC-003)

- Acionar o botão leva a `/` em um clique.
- Pelo menu lateral, alcançar qualquer destino do perfil sem usar o "voltar" do navegador.

---

## Nível 3 — Sem sessão (US2, SC-002)

> **Leia antes**: na configuração atual, um visitante anônimo que digite um endereço desconhecido é desviado para `/login` **pelo `proxy.ts`**, antes de a página ser alcançada. Isso é o modelo *deny-by-default* da feature 001, **não** um defeito desta. Ver a nota ao fim da spec.

Para exercitar a variante sem shell, use um caminho que o gate não cobre — o matcher do `proxy.ts` exclui arquivos com extensão:

```
http://localhost:3000/arquivo-inexistente.png
```

**Esperado**, deslogado:

1. A página aparece **sem** barra superior e **sem** menu lateral.
2. Nenhum nome de usuário, perfil, sino ou destino interno em lugar algum do HTML.
3. O botão de retorno leva a `/login` — e **não** a `/`, que só produziria um salto extra.

### Verificação de vazamento (FR-009)

Inspecione o HTML servido e busque por nomes de áreas internas ("Painel", "Estoque", "Convocação", "Relatórios"). **Nenhum** pode aparecer.

---

## Nível 4 — Recurso inexistente na área autenticada (US3)

Autenticado como perfil interno, acesse uma atividade com identificador inválido:

```
http://localhost:3000/atividades/00000000-0000-0000-0000-000000000000
```

**Esperado**:

1. A página de endereço não encontrado aparece **com** o shell — e o shell é o que já estava na tela, não um remontado.
2. O item de menu "Atividades" segue destacado como ativo, porque o layout da área continua na árvore.
3. A mensagem não informa se o registro já existiu (FR-015).

**Sobre o status HTTP**: aqui a resposta será `200` com `<meta name="robots" content="noindex">`, e não `404`. É comportamento documentado do Next quando `notFound()` é chamado após o início do streaming — decisão consciente registrada em [research.md](./research.md) D4. Confirme apenas que a meta tag `noindex` está presente.

---

## Nível 5 — Não confundir com falta de permissão (SC-006, FR-016)

O teste que separa esta feature de um defeito de segurança.

| Perfil | Endereço | Esperado |
|--------|----------|----------|
| `usuario` | `/dashboard` | `/sem-permissao` — **não** a página de 404 |
| `voluntario` | `/estoque` | `/sem-permissao` |
| `coordenador` | `/relatorios` | `/sem-permissao` (feature 002 moveu relatórios para a Defesa Civil) |
| `membro_defesa_civil` | `/convocacao` | `/sem-permissao` |

Se qualquer linha exibir "endereço não encontrado", a implementação está dizendo que uma área não existe quando ela existe.

---

## Nível 6 — Status HTTP e indexação (FR-002)

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/pagina-que-nao-existe
```

**Esperado**: `307` para `/login` se deslogado (o gate age primeiro); autenticado via navegador, a resposta da URL desconhecida deve ser `404` — status real, porque nenhum segmento casou e não houve streaming.

Confirme também que o HTML traz `<meta name="robots" content="noindex">`.

### Risco a observar no build

```bash
npm run build
```

`app/not-found.tsx` lê cookies, e Cache Components está habilitado. Se o build reclamar de dado não cacheado sem fronteira de Suspense, aplique o contorno de [research.md](./research.md) D3 — isolar a leitura de sessão sob `<Suspense>`, mantendo texto e botão imediatos.

---

## Nível 7 — Acessibilidade e responsividade (SC-007)

- **Teclado**: `Tab` alcança o botão de retorno com foco visível; com shell, a ordem topbar → menu → conteúdo permanece previsível; sem armadilha de foco.
- **360px**: conteúdo legível, sem rolagem horizontal, botão com alvo ≥44px.
- **Tema**: alternar claro/escuro na barra superior aplica à página; deslogado, a página respeita o tema em vigor (FR-005).
- **Leitor de tela**: a condição é anunciada por texto, não apenas por ilustração ou cor.

---

## Critérios de conclusão

| # | Critério | Nível |
|---|----------|-------|
| SC-001 | 100% dos endereços inexistentes com sessão exibem shell | 2 |
| SC-002 | 0% das exibições sem sessão mostram shell ou dado interno | 3 |
| SC-003 | Home em 1 clique; qualquer destino do perfil em ≤2 | 2 |
| SC-004 | 0% dos retornos geram nova negativa — 5 perfis e deslogado | 1, 2, 3 |
| SC-005 | A tela genérica em inglês não aparece mais | 2, 3, 4 |
| SC-006 | Endereço restrito continua produzindo acesso negado | 5 |
| SC-007 | Operável por teclado e legível em 360px | 7 |
| SC-008 | Sem atraso perceptível | 2, 6 |
