# Especificação de Arquitetura e Requisitos Não Funcionais (NFR)

## Projeto: SOS Jaraguá - Gestão e Mobilização em Situações de Emergência

## 1. Padrão Arquitetural

- **Monolito Modular com DDD e Clean Architecture:** O sistema será estruturado como um monolito modular, unificando frontend e backend em uma única aplicação. A organização interna do código seguirá estritamente os princípios de _Domain-Driven Design (DDD)_ e _Clean Architecture_, isolando os domínios críticos (Voluntariado e Assistência Humanitária) em módulos independentes para garantir alta manutenibilidade e clareza.

---

## 2. Stack Tecnológica e Infraestrutura (Front-end & Back-end)

### 2.1. Arquitetura Fullstack, Roteamento e Estado

- **Framework:** **Next.js (última versão)** com o sistema de rotas nativo (**App Router**).
- **Gerenciamento de Dados e Cache:** Utilização de **TanStack Query** em conjunto com as **Server Functions (Server Actions)** nativas do Next.js para manipulação de dados e cache assíncrono do lado do cliente.
- **Tabelas de Alta Performance:** **TanStack Table** para renderização otimizada das listagens de estoque e voluntários, implementando obrigatoriamente **paginação no lado do servidor** (_server-side pagination_).

### 2.2. Design System, Componentizacão e Usabilidade

- **Biblioteca de Componentes:** Criação de componentes React reutilizáveis com base em **Ark-UI + Tailwind CSS v4** (botões, inputs, data tables, dropdowns, etc.).
- **Temas e Idioma:** Suporte nativo alternável entre os modos **Dark** e **Light**. A interface e as mensagens do sistema deverão estar estritamente em **Português Brasileiro (pt-BR)**.
- **Ergonomia e Responsividade de Crise:** Aplicação 100% responsiva e compatível com dispositivos móveis (smartphones e tablets). Os componentes, formulários e fluxos de navegação devem ser desenhados para oferecer extrema clareza e facilidade de operação sob alta pressão e estresse durante cenários de desastre, tanto em desktop quanto em campo via mobile.

### 2.3. Persistência de Dados e ORM

- **Banco de Dados Relacional Principal:** **Neon Postgres** (responsável pelas transações, inventário, kits, usuários e entidades relacionais).
- **Banco de Dados de Auditoria (NoSQL):** **MongoDB Atlas** (responsável pelo armazenamento dedicado de logs imutáveis de rastreabilidade e auditoria).
- **ORM:** Utilização de um ORM moderno compatível com Next.js, Vercel, Neon Postgres e MongoDB Atlas (ex: Prisma ORM).
- **Exclusões de Infraestrutura:** Fica explicitamente definido que **não** haverá uso de banco de dados de cache dedicado (como Valkey/Redis) e **não** haverá banco de dados ou serviço externo para armazenamento de arquivos.

---

## 3. Segurança, Autenticação e Controle de Sessão

- **Biblioteca de Autenticação:** Uso de bibliotecas modernas para controle de login e gerenciamento de sessões (`better-auth` ou `NextAuth.js`).
- **Provedores Sociais:** Configuração de login integrada com os provedores **Google**, **Facebook** e **Instagram**.
- **Expiração de Sessão por Inatividade (Timeout):** Implementação de mecanismo de segurança para encerramento automático da sessão de gestores (Coordenadores e Membros da Defesa Civil) após períodos de inatividade, mitigando riscos em computadores compartilhados da central de operações.
- **Proteção de Dados:** Criptografia de dados pessoais sensíveis em repouso e tráfego de dados obrigatoriamente via protocolo HTTPS/TLS 1.2+.

---

## 4. Requisitos Não Funcionais (NFRs) e Qualidade

### 4.1. Performance e Escalabilidade

- **Tempo de Resposta:** Operações de leitura críticas (como o carregamento da lista de itens avulsos na tela de Saída) devem responder em **menos de 300ms**.
- **Otimização de Consultas:** As Server Actions retornarão apenas os dados estritamente necessários, tirando proveito do cache do TanStack Query para evitar requisições redundantes ao Neon Postgres.

### 4.2. Manutenibilidade, Código e Deploy

- **Tipagem Estrita:** Uso rigoroso de **TypeScript** em toda a base de código unificada (frontend e backend).
- **Padronização de Commits:** Aplicação de regras estritas de _Conventional Commits_ (`feat:`, `fix:`, `chore:`) para rastreabilidade de alterações e automação de _changelogs_.
- **Hospedagem e Infraestrutura:** O projeto será otimizado para deploy nativo na plataforma **Vercel**, aproveitando a sinergia com o ecossistema Next.js, Server Actions e conexões serverless com o Neon Postgres e o MongoDB Atlas.
