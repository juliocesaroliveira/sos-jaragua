# Data Model: Notificações também pelo WhatsApp

**Feature**: 024-notificacoes-whatsapp | **Date**: 2026-10-14

Todas as mudanças ficam em `db/schema/notificacoes.ts` (módulo Notificações). Uma migração
gerada por `npm run db:generate`. Nenhuma tabela de outro módulo muda.

---

## 1. Enums alterados

| Enum              | Antes                          | Depois                                                                  |
| ----------------- | ------------------------------ | ----------------------------------------------------------------------- |
| `canal_envio`     | `email, plataforma`            | `email, plataforma, whatsapp`                                           |
| `status_envio`    | `pendente, enviado, falhou`    | `pendente, enviado, entregue, lido, falhou, nao_enviado`                |

`ALTER TYPE ... ADD VALUE` é aditivo; linhas existentes não mudam. `entregue`/`lido` só são
usados pelo canal `whatsapp` nesta feature (o Resend não reporta entrega ao sistema hoje).

### Novo enum `motivo_nao_entrega`

`canal_desativado, sem_celular, usuario_inativo, nao_configurado, numero_sem_whatsapp,
limite_envio, modelo_indisponivel, falha`

| Motivo                | Origem                                 | Situação gravada |
| --------------------- | -------------------------------------- | ---------------- |
| `canal_desativado`    | elegibilidade (sem opt-in / revogado)  | `nao_enviado`    |
| `sem_celular`         | elegibilidade (sem perfil, fixo)       | `nao_enviado`    |
| `usuario_inativo`     | elegibilidade                          | `nao_enviado`    |
| `nao_configurado`     | credenciais ausentes / token inválido  | `nao_enviado`    |
| `numero_sem_whatsapp` | resposta ou webhook da Meta            | `falhou`         |
| `limite_envio`        | resposta ou webhook da Meta            | `falhou`         |
| `modelo_indisponivel` | resposta ou webhook da Meta            | `falhou`         |
| `falha`               | qualquer outro erro                    | `falhou`         |

Rótulos pt-BR para relatório ficam numa constante ao lado de `ROTULO_CANAL` (consolidados.ts).

---

## 2. `notificacao_envio` (alterada)

| Campo           | Tipo                                   | Regras                                                                   |
| --------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| _existentes_    | `id, notificacaoId, canal, status, enviadoEm, erro` | sem mudança                                                 |
| `motivo`        | `motivo_nao_entrega`, nullable         | Preenchido quando `status ∈ {falhou, nao_enviado}` no canal `whatsapp`   |
| `destino`       | text, nullable                         | Número E.164 sem `+` usado no envio (`5547999998888`). Só canal whatsapp |
| `idExterno`     | text, nullable                         | `wamid` devolvido pela Meta; chave para casar os webhooks de situação    |
| `atualizadoEm`  | timestamptz, nullable                  | Última transição de situação (webhook)                                   |

**Índices novos**

- `notificacao_envio_notificacao_canal_unico` — **único** em `(notificacao_id, canal)`: um
  registro por canal por notificação (idempotência, research D4). Substitui
  `notificacao_envio_notificacao_idx`, que tinha a mesma coluna à esquerda. Não é parcial — ver
  research D4b.
- `notificacao_envio_id_externo_idx` — único parcial em `(id_externo) WHERE id_externo IS NOT
  NULL` (lookup do webhook).

**Transições de situação (canal whatsapp)** — função pura `proximaSituacao` (research D14):

```text
            ┌──────────── nao_enviado (terminal; só na inserção)
inserção ──►│
            └─► pendente ──► enviado ──► entregue ──► lido
                   │            │
                   └────────────┴──► falhou (terminal)
```

- Uma confirmação "anterior" à situação atual é ignorada (não regride).
- `falhou` não é aceito depois de `entregue`/`lido`.
- `enviadoEm` é gravado na transição para `enviado`; `atualizadoEm` em toda transição.

**Mascaramento (FR-025)**: `destino` é exibido como `(47) 9****-8888` para quem não é
`administrador` — aplicado na formatação da linha do relatório, no servidor.

---

## 3. `preferencia_whatsapp` (nova)

Estado atual do consentimento. Ausência de linha = desabilitado (FR-013).

| Campo          | Tipo                              | Regras                         |
| -------------- | --------------------------------- | ------------------------------ |
| `userId`       | text, pk, fk → `user.id` cascade  | 1:1 com `user`                 |
| `ativo`        | boolean                           | Obrigatório                    |
| `atualizadoEm` | timestamptz                       | default now                    |

## 4. `consentimento_whatsapp` (nova, append-only)

Histórico para FR-011 / evidência LGPD. Nunca atualizado nem apagado pela aplicação.

| Campo      | Tipo                                                     | Regras                                   |
| ---------- | -------------------------------------------------------- | ---------------------------------------- |
| `id`       | uuid, pk                                                 |                                          |
| `userId`   | text, fk → `user.id` cascade                             |                                          |
| `acao`     | enum `acao_consentimento` (`concedido, revogado`)        |                                          |
| `origem`   | enum `origem_consentimento` (`cadastro, perfil, resposta_whatsapp`) |                               |
| `telefone` | text, nullable                                           | Número E.164 vigente no momento da ação  |
| `criadoEm` | timestamptz                                              | default now                              |

Índice: `(user_id, criado_em)`.

**Regra de gravação** (caso de uso `alterarPreferenciaWhatsapp`): numa transação, faz upsert em
`preferencia_whatsapp` e insere em `consentimento_whatsapp` **apenas se o estado mudou** (ativar o
que já está ativo não gera histórico).

## 5. `whatsapp_resposta_automatica` (nova)

Limite de uma resposta automática por número a cada 24 h (research D15).

| Campo         | Tipo          | Regras                  |
| ------------- | ------------- | ----------------------- |
| `telefone`    | text, pk      | `wa_id` como recebido   |
| `ultimaEm`    | timestamptz   |                         |

Upsert condicional: `INSERT ... ON CONFLICT (telefone) DO UPDATE SET ultima_em = now() WHERE
whatsapp_resposta_automatica.ultima_em < now() - interval '24 hours' RETURNING telefone` — se
nada voltar, não responde.

---

## 6. Tipos de domínio (sem banco)

Em `src/modules/notificacoes/domain/whatsapp.ts` (puro, TDD):

| Tipo / função                                      | Responsabilidade                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `EVENTOS_COM_WHATSAPP` / `eventoVaiPorWhatsapp`    | Matriz: `triagem_concluida, atividade_atribuida, alteracao_atividade, broadcast_urgencia, lembrete_turno` |
| `destinoWhatsapp(digitos)` → `string \| null`      | 11 dígitos com 9 no 3º → `55…`; senão `null`                                  |
| `variantesDeWaId(waId)` → `string[]`               | Forma recebida + forma com/sem o 9º dígito, convertidas para 11 dígitos locais|
| `avaliarElegibilidade({ativo, optIn, telefone})`   | `{ elegivel: true, destino } \| { elegivel: false, motivo }`                  |
| `parametrosDoModelo(titulo, mensagem)`             | Normaliza quebras/espaços; limita mensagem a 700 com sufixo "… (continua no SOS Jaraguá)" |
| `LIMITE_MENSAGEM_WHATSAPP = 700`                   | Exportado para o contador do formulário de convocação                         |
| `proximaSituacao(atual, recebida)`                 | Transição monotônica (§2)                                                     |
| `classificarErroMeta(codigo)` → `MotivoNaoEntrega` | Tabela de códigos (research D17)                                              |
| `ehPedidoDeDescadastro(texto)`                     | Palavras de descadastro normalizadas (research D15)                           |
| `mascararTelefone(e164)`                           | `(47) 9****-8888`                                                             |

## 7. Ports

Em `src/modules/notificacoes/application/ports/`:

```ts
// contatos-whatsapp.ts — implementado por voluntariado/infrastructure (research D10)
interface ContatosWhatsapp {
    telefonesDe(userIds: string[]): Promise<Map<string, string>>      // userId → dígitos locais
    usuariosPorTelefone(digitosLocais: string[]): Promise<string[]>   // userIds
}

// consentimento-whatsapp.ts — implementado por notificacoes/infrastructure, consumido pela candidatura (D11)
interface ConsentimentoWhatsappPort {
    registrar(userId: string, ativo: boolean, origem: OrigemConsentimento): Promise<void>
}

// mensageria-whatsapp.ts — adapter HTTP da Cloud API
interface MensageriaWhatsapp {
    configurado(): boolean
    enviarModelo(destino: string, modelo: NomeModelo, parametros: [string, string]):
        Promise<{ ok: true; idExterno: string } | { ok: false; codigo: number | null; erro: string }>
    enviarTexto(destino: string, texto: string): Promise<void>
}
```

## 8. Relações com entidades existentes

```text
user ──1:1── preferencia_whatsapp
user ──1:N── consentimento_whatsapp
notificacao ──1:N── notificacao_envio   (0..1 linha com canal = 'whatsapp' por notificação)
voluntario_perfil.telefone  ──(lido via port ContatosWhatsapp)──► destino
```
