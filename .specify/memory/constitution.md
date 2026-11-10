<!--
Sync Impact Report
- Version change: 1.0.2 → 1.1.0 (MINOR)
- Rationale: expansão material de dois princípios existentes, sem remover princípio nem renomear
  seção. Motivada pela feature 025-criptografia-dados-sensiveis (conformidade com a LGPD).

  Sobre o bump ser MINOR e não MAJOR — a chamada é discutível e fica registrada:
  o Princípio IV dizia "não introduzir criptografia a nível de campo **sem decisão
  documentada**". A cláusula de escape era parte do princípio, e esta emenda é justamente a
  decisão documentada que ele previa — usar o escape é cumprir o princípio, não revertê-lo.
  O Princípio V é o caso mais próximo de MAJOR, porque abre exceção a uma invariante declarada
  (imutabilidade da trilha); classificada como MINOR por ser **única**, limitada aos registros
  já gravados, documentada no próprio princípio, e por a regra passar a ser mais estrita daqui
  para frente (a trilha não recebe mais texto plano sensível). Se o responsável ler essa
  exceção como redefinição incompatível, o bump correto é 2.0.0 e esta emenda deve ser
  reemitida.

- Modified principles (conteúdo, não títulos):
  - "IV. Segurança e Defesa em Profundidade": a cláusula que proibia criptografia a nível de
    campo foi substituída pela política adotada — cifra de `cpf`/`cep`/`dataNascimento`, chave
    por variável de ambiente, recusa de boot sem chave, mascaramento por padrão, visibilidade
    por campo e por role, proibição de texto plano em cache/log/erro/notificação, e eliminação
    a pedido do titular por anonimização no lugar. Registra o gap aceito de `restricoesSaude` e
    `telefone`.
  - "V. Auditoria Não Bloqueante": acrescenta a redação de campo sensível na trilha, a exceção
    única à imutabilidade para os snapshots já gravados, e as ações `read` e `anonimizar`.
- Modified sections:
  - "Stack e Convenções Técnicas": acrescenta `node:crypto` (AES-256-GCM, HKDF, HMAC) como a
    escolha de criptografia, explicitando que não há dependência externa.
- Added sections: none
- Removed sections: none
- Deferred/TODO placeholders: none
- Templates requiring follow-up: none — plan/spec/tasks templates leem este arquivo em runtime.

Previous report (1.0.2, 2026-10-14): registro de provedor de integração na stack, sem mudança
de princípio. Feature 024-notificacoes-whatsapp: o WhatsApp entra como canal de notificação
adicional ao e-mail, pela WhatsApp Cloud API oficial da Meta, via HTTP (`fetch`) sem pacote npm
novo; desvio do Princípio VI justificado em `specs/024-notificacoes-whatsapp/plan.md` (Complexity
Tracking) e registrado em `spec/DESIGN.md` §12 e §19. Seção "Stack e Convenções Técnicas"
acrescida de "**Mensageria**".

Previous report (1.0.1, 2026-10-01): troca de `xlsx` por `exceljs` por CVE de severidade alta
sem correção publicada (feature 020, decisão Q1).

Previous report (1.0.0, 2026-08-12): initial ratification — six Core Principles, Stack e
Convenções Técnicas, Fluxo de Desenvolvimento and Governance added from the placeholder template.
-->

# SOS Jaraguá Constitution

## Core Principles

### I. Clean Architecture por Módulo (DDD)

O sistema é um monolito modular organizado em _bounded contexts_ (Identidade, Voluntariado,
Estoque/Doações, Logística/Inteligência, Notificações, Auditoria, Contingência/Relatórios),
cada um estruturado em quatro camadas sob `src/modules/<modulo>/`: `domain/`, `application/`,
`infrastructure/`, `presentation/`.

- A dependência é sempre unidirecional e para dentro: `domain` ← `application` ←
  `infrastructure`/`presentation`. Nunca o inverso.
- `domain/` NÃO PODE importar Next.js, Drizzle ou Mongo — regras de negócio puras e
  testáveis sem infraestrutura.
- `presentation/` (Server Actions, Route Handlers) é a camada mais fina: parse com Zod,
  checagem de sessão/role, chamada a exatamente um caso de uso, invalidação de cache. Nenhuma
  regra de negócio nessa camada.
- Um módulo não acessa tabelas ou repositórios internos de outro módulo diretamente — apenas
  via _ports_ (interfaces) expostos pelo módulo dono dos dados.

**Rationale**: o domínio (voluntariado e assistência humanitária em cenário de emergência)
exige que a lógica de negócio permaneça legível, testável e estável mesmo quando a
infraestrutura (ORM, provedor de auth, banco) muda. O isolamento por _ports_ preserva essa
propriedade mesmo com todas as tabelas no mesmo Postgres.

### II. Tipagem Estrita e Qualidade de Código

TypeScript estrito é obrigatório em toda a base (frontend e backend). Todo código novo
respeita a configuração de lint (`eslint.config.*`) e formatação (`prettier` do
`package.json`) já estabelecidas no repositório, sem exceções ad-hoc.

- `any` implícito ou explícito exige justificativa comentada; não é o padrão.
- Commits seguem Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
  `test:`) para rastreabilidade e automação futura de changelog.
- Textos de interface e mensagens de sistema são estritamente em Português Brasileiro
  (pt-BR); nomes de domínio (`Candidatura`, `Turno`, `Kit`, `Saldo`) seguem a linguagem
  ubíqua definida em `spec/DESIGN.md`, não traduções ad-hoc em inglês.

**Rationale**: a equipe é pequena e o sistema opera decisões sensíveis (aprovação de
voluntários, saída de estoque em crise); tipagem estrita e convenções uniformes reduzem a
classe de erros que só apareceriam em produção durante uma emergência real.

### III. Testes Focados em Regras de Negócio

TDD é obrigatório para `domain/` e `application/`: essas são as camadas de maior valor de
teste, por concentrarem as regras de negócio puras e os casos de uso.

- Testes unitários (Vitest, `npm test`) cobrem `domain/` e `application/`, sem rede — devem
  permanecer rápidos (milissegundos) para rodar a cada save.
- Testes de integração (`npm run test:integracao`) cobrem fluxos transacionais críticos que
  tocam o Neon real (ex.: aprovação de candidatura com troca de role, saída de kit com
  dedução atômica de saldo).
- `infrastructure/` e `presentation/` são finas por design (Princípio I) e não exigem a
  mesma cobertura exaustiva — validação de contrato e dos casos de erro mais prováveis basta.
- Nenhuma mudança em regra de negócio (`domain`/`application`) é aceita sem teste que a
  exercite; testes que dependem de rede não podem ser adicionados ao conjunto padrão
  (`npm test`) sem mover para o config de integração.

**Rationale**: a separação em dois comandos (`test` vs. `test:integracao`) é intencional — o
laço rápido de feedback do desenvolvedor não pode depender da latência/disponibilidade do
Neon, mas os fluxos financeiros/de estoque exigem confirmação contra o banco real antes de ir
a produção.

### IV. Segurança e Defesa em Profundidade

A aplicação usa autenticação e controle de acesso em múltiplas camadas, nunca confiando em
uma única checagem.

- `proxy.ts` é a barreira rápida (checagem de cookie de sessão + mapa rota→roles); a fonte
  de verdade é a revalidação de sessão/role em cada `(staff)/layout.tsx` via
  `auth.api.getSession` no servidor.
- Rotas sob `(staff)` exigem role explícita da matriz de atores; nenhuma rota nova é
  adicionada a `(staff)` sem entrada correspondente no mapa de roles.
- Cookies são httpOnly, secure, sameSite=lax; HTTPS/TLS 1.2+ é obrigatório em todos os
  ambientes que não sejam localhost.
- Timeout de inatividade para `coordenador`/`membro_defesa_civil` é aplicado no fluxo de
  autenticação (não é opcional nem contornável por essas roles).
- Os campos pessoais classificados como sensíveis — hoje `cpf`, `cep` e `dataNascimento` —
  são criptografados **a nível de campo**, com a chave fornecida exclusivamente por variável
  de ambiente, nunca versionada nem armazenada no banco. A aplicação RECUSA inicializar sem a
  chave: não existe modo degradado que grave dado desprotegido. TLS em trânsito e a
  criptografia at-rest do provedor continuam valendo como camadas adicionais, não como
  substitutas.
- Dado sensível é apresentado MASCARADO por padrão em toda superfície — tela, tooltip,
  totalizador e arquivo exportado. O acesso ao valor completo é concedido **campo a campo e
  role a role**, por uma matriz declarada em um único módulo, avaliada no servidor e
  registrada em auditoria. O mascaramento acontece no servidor: o valor completo não é
  entregue a quem não pode vê-lo, para que a máscara não seja contornável inspecionando a
  resposta.
- Nenhum valor sensível em texto plano entra em cache, log de aplicação, mensagem de erro,
  trilha de depuração ou payload de notificação. Como `'use cache'` não admite leitura de
  sessão, a consequência prática é que função cacheada só trafega a forma mascarada.
- O titular acessa os próprios dados completos e pode pedir a eliminação. A eliminação
  **anonimiza no lugar**, nunca apaga a linha de `user`: as chaves estrangeiras de `alocacao`,
  `atividade` e estoque fariam um `DELETE` falhar para quem tem histórico operacional ou,
  pior, destruir em silêncio o histórico de turnos. O histórico sobrevive à exclusão sem
  identificar a pessoa.
- **Gap conhecido e aceito**: `restricoesSaude` e `telefone` permanecem fora do conjunto
  criptografado, por decisão do responsável registrada em
  `specs/025-criptografia-dados-sensiveis/spec.md` (Q1). Fica registrado que a LGPD classifica
  dado referente à saúde como dado pessoal **sensível** (art. 5º, II) — categoria mais estrita
  que `cpf` e `cep`, que são dados pessoais comuns. Incluí-los exige nova decisão explícita,
  não ajuste incidental durante outra tarefa.

**Rationale**: o sistema coordena resposta a desastres e dados de voluntários/beneficiários;
uma falha de autorização tem custo humano real, não apenas técnico. Defesa em profundidade
(proxy + layout) cobre o caso de cookies forjados/expirados entre as duas checagens.

A criptografia a nível de campo foi adotada porque a proteção nativa do provedor não cobre os
cenários que de fato ameaçam estes dados: dump autorizado, backup extraviado, base compartilhada
para depuração. Em todos eles o conteúdo chega legível a quem não deveria lê-lo. A LGPD exige
medidas de segurança aptas a proteger dados pessoais (art. 46), e a chave fora do banco é o que
torna o conteúdo do banco inútil sem a organização. O custo de key management que a versão
anterior deste princípio queria evitar foi contido a uma única variável de ambiente, sem
dependência externa nova.

### V. Auditoria Não Bloqueante

Toda escrita em Voluntariado, Estoque e Atividade passa pelo wrapper centralizado de
auditoria (`withAudit`) — nunca chamadas de log ad-hoc espalhadas pelas Server Actions.

- A identidade do ator é obtida da sessão e propagada de forma implícita (ex.:
  `AsyncLocalStorage`), sem exigir que cada função repasse `actor` manualmente.
- Falha na escrita de auditoria degrada graciosamente: a operação de negócio original
  prossegue; a falha é registrada em log estruturado separado para reconciliação manual.
  Disponibilidade das operações críticas de campo durante um desastre pesa mais que uma
  lacuna pontual no log de auditoria.
- Essa política de degradação é uma decisão final documentada — revertê-la (tornar a
  auditoria bloqueante) exige nova decisão explícita, não um ajuste incidental durante outra
  tarefa.
- A trilha NÃO registra o **valor** de campo sensível: `withAudit` redige esses campos antes
  de gravar, de modo que a auditoria não seja uma segunda cópia legível do que o Postgres
  cifra. A trilha diz que o campo mudou, e qual campo foi revelado — nunca o conteúdo.
- **Exceção única à imutabilidade**: os snapshots gravados antes da feature 025 contêm `cpf`,
  `cep` e `dataNascimento` em texto plano, porque `withAudit` grava o registro inteiro. Uma
  remediação **única**, executada junto da migração de proteção e registrada como evento
  próprio, redige esses campos. Essa é a ÚNICA alteração admitida em registro já gravado;
  qualquer outra exige nova emenda desta constituição. Redigir a cada pedido de exclusão foi
  rejeitado justamente por abrir uma exceção recorrente — a brecha menor que resolve o
  problema é preferível à brecha permanente.
- O vocabulário de ações da trilha inclui `read` (revelação de dado sensível) e `anonimizar`
  (eliminação a pedido do titular), além de `create`, `update` e `delete`. Toda revelação de
  dado completo e todo pedido de eliminação são registrados.

**Rationale**: auditoria imutável é um requisito de negócio (BR-AUD-01), mas não pode se
tornar um ponto único de falha que impeça aprovar um voluntário ou registrar saída de
estoque no meio de uma emergência.

A imutabilidade continua sendo a regra, e daqui para frente fica mais forte: como a trilha não
recebe mais texto plano sensível, nenhum pedido futuro de eliminação precisará tocá-la. A
exceção pontual existe porque a alternativa era pior — manter na trilha dado que o restante do
sistema passou a cifrar tornaria a proteção cosmética e deixaria a eliminação a pedido do
titular incompleta na prática.

### VI. Simplicidade Operacional

A arquitetura evita complexidade que não tem valor comprovado no porte atual da equipe e da
operação.

- Monolito modular na Vercel — sem microsserviços, sem banco de cache dedicado (Redis/
  Valkey), sem serviço externo de armazenamento de arquivos, salvo decisão documentada que
  justifique o desvio.
- Decisões arquiteturais relevantes são registradas em `spec/DESIGN.md` (ou documento
  equivalente da feature) antes de virar código — a implementação não é o lugar para decidir
  arquitetura implicitamente.
- Ambiguidades de requisito (BRD/NFR) são resolvidas e documentadas como decisão final antes
  da implementação, não deixadas como comportamento implícito do código.

**Rationale**: a equipe é pequena e o contexto de uso (crise, conectividade instável) pune
duramente qualquer complexidade operacional que não seja estritamente necessária.

## Stack e Convenções Técnicas

- **Framework**: Next.js 16 (App Router, Turbopack), React 19, TypeScript estrito.
- **Dados**: Drizzle ORM sobre Neon Postgres (dados relacionais/transacionais); MongoDB
  Atlas dedicado exclusivamente à auditoria imutável — não usar Mongo para dados de domínio
  que pertencem ao Postgres.
- **Autenticação**: better-auth com adapter Drizzle; roles como `additionalFields` em
  `user`, não em tabela separada.
- **Client-side data**: TanStack Query + Server Actions; TanStack Table com paginação
  obrigatoriamente server-side para listagens.
- **UI**: Ark UI + Tailwind CSS v4; suporte nativo a Dark/Light; interface 100% pt-BR.
- **E-mail**: Resend. **Planilhas**: `exceljs`. **Mensageria**: WhatsApp Cloud API (Meta), via
  HTTP (`fetch`), sem SDK.
- **Criptografia de campo**: `node:crypto` embutido — AES-256-GCM para os valores, HKDF-SHA256
  para derivar subchaves de propósito distinto e HMAC-SHA256 para o índice cego que sustenta
  unicidade e busca exata de CPF. Nenhuma dependência externa de cripto.
- Novas dependências que dupliquem capacidade já coberta pela stack acima (outro ORM, outro
  client de query, outra lib de auth) exigem decisão documentada, não substituição silenciosa.

## Fluxo de Desenvolvimento

- Toda feature relevante passa por spec (`spec.md`), design técnico (quando altera
  arquitetura) e tasks antes da implementação — seguindo o fluxo Spec Kit já adotado no
  repositório (`.specify/`).
- Responsividade mobile e clareza sob estresse são requisitos de aceitação de qualquer tela
  nova de operação de campo (voluntariado, estoque), não um refinamento posterior.
- Operações de leitura críticas (ex.: listagem de itens na tela de Saída) têm meta de
  resposta abaixo de 300ms; regressões de performance nesses caminhos são tratadas como
  defeito, não como débito técnico aceitável.

## Governance

Esta constituição tem precedência sobre convenções informais, preferências individuais de
estilo, ou padrões de PRs anteriores que a contradigam.

- **Emendas**: qualquer alteração de princípio, remoção de seção ou mudança de regra de
  governança exige (1) registro da motivação, (2) atualização deste arquivo via
  `/speckit-constitution`, e (3) bump de versão conforme a política abaixo.
- **Versionamento semântico**:
    - MAJOR: remoção ou redefinição incompatível de um princípio existente.
    - MINOR: novo princípio ou seção, ou expansão material de orientação existente.
    - PATCH: esclarecimentos de texto, correções de redação, sem mudança de regra.
- **Revisão de conformidade**: mudanças de arquitetura (novo módulo, nova dependência de
  infraestrutura, alteração no fluxo de autenticação/autorização) devem ser verificadas
  contra os Princípios I, IV e VI antes do merge. Divergência exige justificativa explícita
  no PR/spec, não silêncio.
- Para orientação de execução no dia a dia (comandos, scripts, convenções de skill), usar os
  arquivos em `.claude/skills/` e `AGENTS.md` — este documento rege princípios, não mecânica
  de tooling.

**Version**: 1.1.0 | **Ratified**: 2026-08-12 | **Last Amended**: 2026-10-31
