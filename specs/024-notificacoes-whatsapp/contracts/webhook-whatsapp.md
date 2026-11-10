# Contrato: webhook do WhatsApp

**Feature**: 024-notificacoes-whatsapp | **Rota**: `app/api/webhooks/whatsapp/route.ts`

Rota pública (isenta do `proxy.ts`, research D13). Autenticação = assinatura da Meta.

## `GET` — verificação do endpoint

| Entrada (query)                                   | Saída                                 |
| ------------------------------------------------- | ------------------------------------- |
| `hub.mode=subscribe` e `hub.verify_token` = `WHATSAPP_VERIFY_TOKEN` | `200`, corpo = `hub.challenge` em texto puro |
| qualquer outra combinação, ou variável ausente    | `403`, sem corpo                      |

## `POST` — eventos

1. Lê o corpo como texto bruto (`await request.text()`), **antes** de qualquer parse.
2. Sem `WHATSAPP_APP_SECRET`, ou `X-Hub-Signature-256` ausente/diferente de
   `sha256=` + HMAC-SHA256(corpo, segredo) (comparação `timingSafeEqual`) → `401`, sem efeito.
3. Corpo assinado mas não reconhecido (outro `field`, JSON inválido) → `200`, ignorado.
4. Para cada `entry[].changes[]` com `field = "messages"`:
   - `value.statuses[]`: `{ id: wamid, status: sent|delivered|read|failed, errors?: [{code, title}] }`
     → mapeia `sent→enviado`, `delivered→entregue`, `read→lido`, `failed→falhou` (+ motivo via
     `classificarErroMeta`); aplica `proximaSituacao`; atualiza `notificacao_envio` por
     `idExterno`. `wamid` desconhecido → ignorado.
   - `value.messages[]` (`type = text`, `from = wa_id`): ver tabela abaixo. Outros tipos (áudio,
     imagem, figurinha) seguem a regra de "qualquer outra mensagem".
5. Resposta `200` com corpo vazio. Exceção interna depois de a assinatura ser validada (ex.: banco
   indisponível) → loga e responde `500`, para que a Meta reenvie. Reenviar é seguro porque o
   processamento é idempotente (situação monotônica; revogação repetida não gera histórico;
   resposta automática limitada).

### Mensagens recebidas

| Texto (normalizado)                                     | Usuários com o número (`variantesDeWaId`) | Efeito                                                                       |
| ------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| `sair`, `parar`, `stop`, `cancelar`, `descadastrar`      | ≥ 1                                       | Revoga preferência de todos (origem `resposta_whatsapp`); envia confirmação  |
| idem                                                    | 0                                         | Nada além da resposta automática (limitada)                                  |
| qualquer outra                                          | qualquer                                  | Resposta automática, no máximo 1 por número / 24 h. Nenhuma ação de negócio  |

## Invariantes

- Nenhum efeito sem assinatura válida (FR-016).
- O webhook **nunca** marca notificação como lida no sino (FR-027) — `lido` é só do envio.
- Reentrega do mesmo evento pela Meta não muda o resultado (idempotência).

## Testes de contrato (unitário, sem rede)

- `GET` com token certo devolve o challenge; errado → 403.
- `POST` sem assinatura / assinatura de outro corpo → 401 e nenhum repositório chamado.
- `POST` assinado com `statuses` → chama a atualização com a situação mapeada.
- `POST` assinado com "Sair" → revogação chamada com origem `resposta_whatsapp`.
