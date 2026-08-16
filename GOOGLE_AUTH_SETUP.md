# Guia Completo: Configuração de Autenticação Google com Better-Auth

Este documento fornece um guia detalhado e passo a passo para obter as credenciais do Google (Client ID e Client Secret) e configurá-las para funcionar com o Better-Auth.

## Índice
1. [Pré-requisitos](#pré-requisitos)
2. [Passo 1: Acessar Google Cloud Console](#passo-1-acessar-google-cloud-console)
3. [Passo 2: Criar um Novo Projeto](#passo-2-criar-um-novo-projeto)
4. [Passo 3: Habilitar a API do Google](#passo-3-habilitar-a-api-do-google)
5. [Passo 4: Criar Credenciais OAuth 2.0](#passo-4-criar-credenciais-oauth-20)
6. [Passo 5: Configurar a Tela de Consentimento](#passo-5-configurar-a-tela-de-consentimento)
7. [Passo 6: Adicionar URIs de Redirecionamento](#passo-6-adicionar-uris-de-redirecionamento)
8. [Passo 7: Obter e Salvar as Credenciais](#passo-7-obter-e-salvar-as-credenciais)
9. [Passo 8: Configurar no Better-Auth](#passo-8-configurar-no-better-auth)
10. [Passo 9: Testar a Implementação](#passo-9-testar-a-implementação)

---

## Pré-requisitos

Antes de começar, você precisará de:

- ✅ Uma conta Google (Gmail)
- ✅ Acesso à internet
- ✅ Um navegador web atualizado
- ✅ Projeto Next.js com Better-Auth já instalado (`npm install better-auth`)
- ✅ Conhecimento básico de variáveis de ambiente (.env.local)

---

## Passo 1: Acessar Google Cloud Console

1. Abra seu navegador e acesse: **https://console.cloud.google.com/**
2. Faça login com sua conta Google (a mesma que você usa para Gmail)
3. Se for a primeira vez, você verá uma página de boas-vindas
4. Clique no banner de "Aceitar Termos de Serviço" se aparecer

---

## Passo 2: Criar um Novo Projeto

### Método A: Usando o Seletor de Projeto (Recomendado)

1. No canto superior esquerdo, você verá um dropdown com o nome do projeto atual
2. Clique no dropdown que diz **"Selecionar um projeto"** ou **"Meu Primeiro Projeto"**
3. Uma janela modal abrirá mostrando seus projetos
4. Clique no botão **"NOVO PROJETO"** (canto superior direito da modal)
5. Preencha os campos:
   - **Nome do projeto**: `sos-jaragua` ou `SOS Jaragua Auth`
   - **ID do projeto**: Será gerado automaticamente (pode deixar como está)
   - **Organização**: Se tiver, selecione; caso contrário, deixe em branco
6. Clique em **"CRIAR"**
7. Aguarde alguns segundos enquanto o projeto é criado

### Confirmação
- Você verá uma notificação no canto inferior direito dizendo "Projeto criado com sucesso"
- A página redirecionará automaticamente para o novo projeto

---

## Passo 3: Habilitar a API do Google

### 3.1 Habilitar Google Identity API

1. Você será redirecionado para a dashboard do novo projeto
2. No painel lateral esquerdo, clique em **"APIs e Serviços"** (pode estar nomeado como "API e Serviços")
3. Selecione **"Biblioteca"**
4. Na barra de pesquisa no topo, digite: **"Google+ API"**
5. Clique no resultado **"Google+ API"**
6. Clique no botão azul **"ATIVAR"** (pode estar nomeado como "HABILITAR")
7. Aguarde a ativação ser concluída

### 3.2 Confirmar Ativação

- Você verá uma mensagem dizendo "API ativada com sucesso"
- A página mostrará "Gerenciar" em vez de "Ativar"

---

## Passo 4: Criar Credenciais OAuth 2.0

### 4.1 Acessar a Seção de Credenciais

1. No painel lateral, clique em **"Credenciais"** (em "APIs e Serviços")
2. Você verá a página de Credenciais
3. Clique no botão **"+ CRIAR CREDENCIAIS"** (no canto superior)
4. Selecione **"ID do cliente OAuth 2.0"** no menu suspenso

### 4.2 Criar Tela de Consentimento

Se você vir uma mensagem pedindo para configurar a "Tela de consentimento OAuth", você precisa fazer isso primeiro:

1. Clique em **"Ir para a página de consentimento OAuth"** (ou em "Tela de consentimento" no menu lateral)
2. Vá para a seção **[Passo 5](#passo-5-configurar-a-tela-de-consentimento)** agora
3. Depois volte aqui para continuar a criar as credenciais

---

## Passo 5: Configurar a Tela de Consentimento

### 5.1 Acessar Tela de Consentimento

1. No menu lateral, em "APIs e Serviços", clique em **"Tela de consentimento OAuth"**
2. Você verá duas opções:
   - **Externo** (recomendado para aplicações em produção)
   - **Interno** (apenas para contas da mesma organização)
3. Selecione **"Externo"**
4. Clique em **"CRIAR"**

### 5.2 Preenchimento do Formulário

Você verá um formulário com várias seções. Preencha o seguinte:

#### Informações sobre o Aplicativo

- **Nome do aplicativo**: `SOS Jaragua` ou `Defesa Civil SOS`
- **E-mail do usuário para suporte**: `juliocesaroliveiraa@gmail.com`
- **Logo do aplicativo** (opcional): Deixe em branco por enquanto
- **Domínio da aplicação**: 
  - Se estiver em desenvolvimento local: `localhost:3000`
  - Se tiver um domínio: `seu-dominio.com`

#### Informações de Contato do Desenvolvedor

- **E-mail**: `juliocesaroliveiraa@gmail.com`

3. Clique em **"SALVAR E CONTINUAR"**

### 5.3 Seção de Escopos

1. Na página de "Escopos", você pode deixar os escopos padrão (não precisa adicionar nada específico para autenticação básica)
2. Clique em **"SALVAR E CONTINUAR"**

### 5.4 Usuários de Teste (Desenvolvimento)

1. Na página de "Usuários de teste", você pode adicionar contas Google para testar:
   - Clique em **"ADICIONAR USUÁRIOS"**
   - Digite o email que você quer testar (ex: `seu-email@gmail.com`)
   - Clique em **"ADICIONAR"**
2. Clique em **"SALVAR E CONTINUAR"**

### 5.5 Revisão e Resumo

1. Revise as informações que você preencheu
2. Clique em **"VOLTAR PARA O PAINEL"** ou **"CONCLUÍDO"**

---

## Passo 6: Adicionar URIs de Redirecionamento

### 6.1 Acessar Credenciais OAuth

1. No menu lateral, em "APIs e Serviços", clique em **"Credenciais"**
2. Procure por "ID do cliente OAuth 2.0" na seção "Credenciais"
3. Se não vir nenhum ainda, clique em **"+ CRIAR CREDENCIAIS"** > **"ID do cliente OAuth 2.0"**
4. Selecione **"Aplicação web"** como tipo de aplicação

### 6.2 Configurar URIs Autorizados

Na página de criação de credenciais OAuth, você verá campos para:

#### URIs Autorizados do JavaScript

Clique em **"+ ADICIONAR URI"** e adicione:
- `http://localhost:3000`
- `http://127.0.0.1:3000`
- Se tiver domínio: `https://seu-dominio.com`

#### URIs Autorizados para Redirecionamento

Clique em **"+ ADICIONAR URI"** e adicione:

**Para desenvolvimento local:**
- `http://localhost:3000/api/auth/callback/google`

**Para produção (substitua pelo seu domínio):**
- `https://seu-dominio.com/api/auth/callback/google`

**Exemplo completo com vários ambientes:**
```
http://localhost:3000/api/auth/callback/google
http://127.0.0.1:3000/api/auth/callback/google
https://seu-dominio.com/api/auth/callback/google
https://preview-seu-dominio.vercel.app/api/auth/callback/google
```

3. Clique em **"CRIAR"**

---

## Passo 7: Obter e Salvar as Credenciais

### 7.1 Visualizar Credenciais

1. Após criar, você verá uma modal com suas credenciais
2. Você verá dois campos importantes:
   - **ID do cliente**
   - **Senha do cliente** (Client Secret)

### 7.2 Copiar as Credenciais

⚠️ **IMPORTANTE**: Anote ou copie essas credenciais em um lugar seguro!

1. Clique no ícone de cópia ao lado do "ID do cliente"
2. Cole em um editor de texto (Notepad, VS Code, etc.)
3. Clique no ícone de cópia ao lado da "Senha do cliente"
4. Cole também no seu editor de texto

### 7.3 Visualizar Novamente (Se Perdeu)

Se fechou a modal sem copiar:

1. Vá para **Credenciais** no menu lateral
2. Procure por "Aplicação web" na seção "Credenciais OAuth 2.0"
3. Clique no nome da credencial
4. Role para baixo para ver "ID do cliente" e "Senha do cliente"
5. Clique no ícone de cópia para copiar cada um

---

## Passo 8: Configurar no Better-Auth

### 8.1 Criar Arquivo .env.local

Se ainda não tiver, crie um arquivo `.env.local` na raiz do seu projeto:

```bash
# Na raiz do projeto
touch .env.local
```

### 8.2 Adicionar as Variáveis de Ambiente

Abra o arquivo `.env.local` e adicione:

```env
# Google OAuth
GOOGLE_CLIENT_ID=seu_client_id_aqui
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui

# Better Auth
BETTER_AUTH_SECRET=gerar_uma_chave_aleatoria_forte_aqui
```

**Exemplos (NUNCA use em produção):**
```env
# ❌ NÃO USE ISSO - Apenas para entender o formato:
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-1234567890abcdefghijklmno
BETTER_AUTH_SECRET=my-super-secret-key-for-testing
```

### 8.3 Gerar BETTER_AUTH_SECRET

Se não tem um secret gerado, você pode gerar um:

**Opção 1: Usar Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Opção 2: Usar OpenSSL (Linux/Mac)**
```bash
openssl rand -hex 32
```

**Opção 3: Usar um gerador online** (⚠️ Apenas para desenvolvimento)
- https://generate-random.org/encryption-key-generator (copiar resultado de 32 bytes)

### 8.4 Configurar Better-Auth

Crie ou atualize o arquivo `auth.ts` (ou `lib/auth.ts`):

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db"; // seu banco de dados

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "postgresql", // ou 'mysql', 'sqlite' conforme seu banco
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});
```

### 8.5 Criar Rota de Autenticação (API)

Crie o arquivo `app/api/auth/[...auth]/route.ts`:

```typescript
import { auth } from "@/auth";

export const { GET, POST } = auth.toNextApiHandler();
```

### 8.6 Adicionar Botão de Login no Frontend

Em seu componente React, adicione:

```typescript
"use client";

import { useRouter } from "next/navigation";

export function GoogleSignIn() {
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    try {
      const response = await fetch("/api/auth/signin/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          redirect: false,
        }),
      });

      const data = await response.json();
      if (data.url) {
        router.push(data.url);
      }
    } catch (error) {
      console.error("Erro ao fazer login com Google:", error);
    }
  };

  return (
    <button
      onClick={handleGoogleSignIn}
      className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-700 font-medium hover:bg-gray-50"
    >
      Entrar com Google
    </button>
  );
}
```

---

## Passo 9: Testar a Implementação

### 9.1 Iniciar o Servidor de Desenvolvimento

```bash
npm run dev
```

O servidor estará em `http://localhost:3000`

### 9.2 Navegar para a Página de Login

1. Abra `http://localhost:3000` em seu navegador
2. Procure pelo botão "Entrar com Google"
3. Clique no botão

### 9.3 Fluxo de Login

1. Você será redirecionado para a página de login do Google
2. Selecione a conta Google que você quer usar
3. Conceda as permissões solicitadas
4. Você será redirecionado de volta para seu aplicativo
5. Você deverá estar autenticado

### 9.4 Solução de Problemas

#### ❌ Erro: "Credencial inválida"
- ✅ Verifique se copiou corretamente o Client ID e Secret
- ✅ Certifique-se de que as variáveis estão em `.env.local`
- ✅ Reinicie o servidor com `Ctrl+C` e `npm run dev`

#### ❌ Erro: "Redirecionamento não autorizado"
- ✅ Confirme que `http://localhost:3000/api/auth/callback/google` está adicionado nas URIs de redirecionamento
- ✅ Verifique se não há espaços extras nas URIs

#### ❌ Erro: "Tela de consentimento não configurada"
- ✅ Volte ao passo 5 e configure a Tela de Consentimento OAuth
- ✅ Reinicie o servidor após configurar

#### ❌ Página em branco ou erro 500
- ✅ Abra o console do navegador (F12) e veja se há erros
- ✅ Verifique os logs do servidor (terminal onde rodou `npm run dev`)
- ✅ Confirme que a rota `/api/auth/[...auth]/route.ts` existe

---

## Segurança: Boas Práticas

### ✅ DOs (Fazer)

- ✅ Nunca commite `.env.local` no Git (adicione à `.gitignore`)
- ✅ Use variáveis de ambiente para todas as credenciais
- ✅ Regenere o `BETTER_AUTH_SECRET` para cada ambiente (dev, staging, prod)
- ✅ Use URIs HTTPS em produção
- ✅ Rotacionize os secrets regularmente

### ❌ DON'Ts (Não Fazer)

- ❌ Nunca coloque credenciais no código fonte
- ❌ Nunca compartilhe Client ID e Secret em públicos (GitHub, Slack, etc.)
- ❌ Nunca use o mesmo secret em múltiplos ambientes
- ❌ Nunca commit `.env.local` por acidente

---

## Checklist Final

Antes de considerar completo, verifique:

- [ ] Projeto criado no Google Cloud Console
- [ ] Google+ API habilitada
- [ ] Tela de Consentimento OAuth configurada
- [ ] Client ID e Client Secret obtidos
- [ ] URIs de redirecionamento adicionadas (localhost e produção)
- [ ] Variáveis de ambiente adicionadas em `.env.local`
- [ ] Better-Auth configurado corretamente no `auth.ts`
- [ ] Rota de API `/api/auth/[...auth]/route.ts` criada
- [ ] Componente de login implementado
- [ ] Login testado localmente em `http://localhost:3000`
- [ ] `.env.local` está em `.gitignore`
- [ ] Sem erros no console ou terminal

---

## Links Úteis

- 📚 [Documentação do Better-Auth](https://www.better-auth.com/)
- 📚 [Documentação Google OAuth](https://developers.google.com/identity/protocols/oauth2)
- 📚 [Google Cloud Console](https://console.cloud.google.com/)
- 🔐 [Segurança em OAuth 2.0](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)

---

## Suporte

Se encontrar problemas:

1. Verifique o console do navegador (F12) para erros
2. Verifique os logs do terminal onde `npm run dev` está rodando
3. Releia o passo específico onde está o problema
4. Confirme que não tem espaços ou caracteres inválidos nas credenciais

**Criado em:** 16/08/2026
**Versão:** 1.0
**Better-Auth Version:** ^1.6.26
