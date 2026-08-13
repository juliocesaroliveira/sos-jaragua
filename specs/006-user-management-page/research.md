# Research: Gestão de Usuários

**Feature**: [spec.md](./spec.md)

## D1 — Onde a rota já é esperada: `/admin`, restrito a `administrador`

**Decisão**: a página vive em `app/(interno)/(staff)/admin/page.tsx`.

**Por quê**: `src/shared/auth/rotas.ts` (`REGRAS_DE_ROTA`) já tem a entrada `{ prefixo: '/admin', roles: ['administrador'] }`, com o comentário `// Gestão de usuários/permissões` — a rota e a restrição a `administrador` já foram antecipadas antes desta feature existir. Isso confirma a resposta do Q1 da spec (reaproveitar `administrador`) como a leitura correta do que o código já esperava, não uma decisão nova isolada.

`(staff)/layout.tsx` garante sessão + `ROLES_STAFF` (`membro_defesa_civil`, `coordenador`, `administrador`) como primeira camada. Para restringir só a `administrador`, a página chama `exigirAcessoA('/admin')` (`src/shared/auth/sessao.ts`) — o mesmo padrão já usado por `/crise`, `/relatorios`, `/estoque/kits` e `/estoque/descarte`: páginas dentro de `(staff)` cuja regra em `REGRAS_DE_ROTA` é mais estreita que `ROLES_STAFF`. **Nenhuma mudança em `rotas.ts`/`proxy.ts` é necessária** — a regra já existe.

**Alternativas consideradas**: criar um papel `desenvolvedor` novo ou um route group `(admin)` separado de `(staff)`. Rejeitado pela resposta do usuário ao Q1 da spec e por duplicar um gate que `REGRAS_DE_ROTA` já resolve.

## D2 — Navegação: primeiro item do grupo `administracao`

**Decisão**: acrescentar um `ItemNavegacao` em `src/shared/auth/navegacao.ts` — `{ href: '/admin', rotulo: 'Usuários', icone: 'Users', grupo: 'administracao', roles: ['administrador'] }`.

**Por quê**: o grupo `administracao` já existe em `GRUPOS`, com o comentário "ainda sem itens: a área de administração não foi construída — basta acrescentar a linha quando a página existir". Esta feature é exatamente esse momento.

## D3 — Formulário responsivo: reaproveitar `Dialog`, sem um segundo componente `Drawer`

**Decisão**: usar o `Dialog` já existente (`src/shared/ui/dialog/dialog.tsx`) para o formulário de cadastro/edição, sem introduzir uma alternância JS entre `Dialog` e `Drawer`.

**Por quê**: `Dialog` já é responsivo por CSS — em mobile ocupa a base da tela como uma folha (`rounded-t-xl`, `items-end`), em `sm+` vira modal centralizado (`sm:rounded-xl`, `sm:items-center`), conforme o próprio comentário do componente ("mobile-first, §1.7"). Isso **já é** o comportamento "diálogo em telas maiores, painel em mobile" que a spec pede (FR-005) — sem precisar de um hook `useMediaQuery`/`matchMedia` para escolher entre dois componentes de portal diferentes (o projeto não tem esse hook hoje; introduzi-lo só para isto seria complexidade nova sem necessidade comprovada, Princípio VI).

**Alternativas consideradas**: montar `Dialog` em `lg+` e `Drawer` (`lado="bottom"`) abaixo disso, escolhidos via `matchMedia`. Rejeitado — os dois componentes já convergem visualmente no mobile (ambos: folha ancorada na base, `rounded-t-xl`, largura cheia), então a duplicação de estado/portal não compraria nenhuma diferença perceptível ao usuário.

## D4 — Um formulário, dois modos, reaproveitando `react-hook-form` + Zod já em uso

**Decisão**: um único componente `UsuarioFormDialog` (client), com um modo `criar` (nome, e-mail, senha, papel) e um modo `editar` (nome, papel; e-mail e senha exibidos como somente leitura ou omitidos), usando `useForm` + `zodResolver`, seguindo exatamente o padrão de `app/(interno)/voluntariado/candidatura/candidatura-form.tsx` — o único formulário do projeto até hoje: `register` para campos de texto nativos (`Input`), `Controller` para o campo de papel (`Select`, primitivo Ark controlado).

**Por quê**: é o único precedente de `react-hook-form` no repositório; `@hookform/resolvers` e `react-hook-form` já são dependências instaladas, mas usadas em um único lugar — não há motivo para inventar uma convenção diferente aqui.

**Esquemas diferentes por modo**: `esquemaCriar` exige `email`+`senha`; `esquemaEditar` não os tem (não há campo para omitir). Dois esquemas Zod, não um esquema único com campos condicionalmente opcionais — mais simples de ler e de validar do que uma união condicional.

## D5 — Criar conta com senha: `auth.api.signUpEmail` no servidor, não hash manual

**Decisão**: o caso de uso de cadastro chama `auth.api.signUpEmail({ body: { email, password, name } })` (server-side, dentro da Server Action) para criar a linha em `user`+`account` com a senha já hasheada pelo próprio better-auth, e só depois atualiza `role` via `UsuarioRepository.atualizarRole` (Drizzle), pois `role` é `additionalField` com `input: false` em `auth.ts` — não é aceito no corpo do `signUpEmail`.

**Por quê**: reimplementar hashing de senha manualmente seria reconstruir, com risco de erro, algo que o better-auth já faz corretamente — e o projeto não tem o plugin `admin` do better-auth instalado (que teria um `createUser` já com suporte a definir role). Instalar esse plugin só para este caso de uso é uma dependência nova para um ganho pequeno (Princípio VI); a chamada direta a `signUpEmail` + atualização de `role` em seguida resolve sem dependência nova.

**Risco aceito, documentado**: as duas escritas (`signUpEmail` e `atualizarRole`) não são a mesma transação Postgres — `signUpEmail` é uma chamada opaca do better-auth. Se `atualizarRole` falhar depois de `signUpEmail` ter sucesso, a conta existe com o papel padrão (`usuario`) em vez do papel escolhido. Mitigação: a Server Action reporta esse caso como um aviso específico ("conta criada, mas não foi possível definir o papel — edite para corrigir"), não como falha total — a tela de edição (US3) já é o caminho de correção, sem precisar de rollback do cadastro (que exigiria desfazer uma escrita do better-auth, mais arriscado que deixar o estado corrigível).

## D6 — Consolidar `UserRepository` duplicado, em vez de criar um terceiro

**Decisão**: mover o port `UserRepository` (renomeado `UsuarioRepository`) e sua implementação Drizzle de `src/modules/voluntariado/{application/ports,infrastructure/drizzle}/voluntario-repository.ts` para `src/modules/identidade/{application/ports,infrastructure/drizzle}/` — o módulo dono da tabela `user`. `voluntariado` passa a importar o port/implementação de `identidade` em vez de manter uma cópia local.

**Por quê**: `atualizarRole`/`buscarRole` já existem, criados para `AprovarCandidaturaUseCase`, mas vivem dentro de `voluntariado` — um módulo que, pelo Princípio I, não deveria ser o dono da regra "como ler/escrever `user`". Esta feature precisa exatamente da mesma capacidade (mais listagem paginada e criação). Criar uma terceira cópia em `identidade` duplicaria a lógica; mover a existente para `identidade` e apontar `voluntariado` para lá remove a duplicação em vez de aumentá-la — consistente com o próprio comentário do código-fonte atual ("por ser a raiz de Identidade da qual o perfil é extensão 1:1").

**Risco**: `aprovar-candidatura.integracao.test.ts` (teste de integração existente) referencia o caminho atual — o teste precisa continuar passando após o import mudar de módulo, não seu comportamento.

**Alternativas consideradas**: deixar a cópia de `voluntariado` como está e criar uma implementação nova e independente em `identidade` só para esta feature. Rejeitado — duas implementações da mesma leitura/escrita em `user.role` são exatamente o tipo de divergência silenciosa que o Princípio I existe para evitar.

## D7 — Listagem paginada: mesmo contrato de `listarVoluntarios`

**Decisão**: `listarUsuarios({ page, pageSize }): Promise<{ rows: LinhaUsuario[]; totalCount: number }>` em `identidade/presentation/queries/usuarios.ts`, espelhando `voluntariado/presentation/queries/candidaturas.ts` (`'use cache'`, `cacheTag`, `Promise.all` de linhas + `count()`, `limit`/`offset`). Nova tag `identidade:listagem` em `src/shared/cache/tags.ts`.

**Por quê**: é o único padrão de paginação server-side do projeto (NFR §2.1 / Stack do Princípio VI) — reaproveitá-lo integralmente evita inventar uma segunda convenção de paginação.

## D8 — Teste

**Decisão**: TDD nos casos de uso novos (`CriarUsuarioUseCase`, `EditarUsuarioUseCase`) e na função pura de mapeamento de erro do better-auth (e-mail duplicado → erro de campo), via Vitest (`npm test`) — cobertura de `application`, conforme Princípio III. Sem teste de componente para o formulário/diálogo (mesmo carve-out de apresentação fina já usado em `004`/`005`; o projeto não tem `@testing-library/react`). Teste de integração (`npm run test:integracao`) para o fluxo real de `signUpEmail` + `atualizarRole` contra o Neon de teste, análogo a `aprovar-candidatura.integracao.test.ts`.

## Resumo das decisões

| #   | Decisão                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------ |
| D1  | Rota `/admin`, já prevista em `REGRAS_DE_ROTA`; gate por `(staff)/layout.tsx` + `exigirAcessoA('/admin')`    |
| D2  | Primeiro item do grupo de navegação `administracao`                                                          |
| D3  | Reaproveitar `Dialog` (já responsivo), sem alternância `Dialog`/`Drawer` via JS                              |
| D4  | Um `UsuarioFormDialog`, dois modos, `react-hook-form` + Zod (padrão de `candidatura-form.tsx`)               |
| D5  | `auth.api.signUpEmail` para criar com senha; `atualizarRole` em seguida; falha parcial é aviso, não rollback |
| D6  | Consolidar `UserRepository` duplicado em `identidade`, `voluntariado` passa a importar de lá                 |
| D7  | `listarUsuarios` espelha `listarVoluntarios` (paginação server-side, `'use cache'`)                          |
| D8  | TDD em `application`; sem teste de componente; integração para o fluxo de criação                            |
