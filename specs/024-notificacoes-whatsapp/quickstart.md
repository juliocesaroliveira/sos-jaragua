# Quickstart: validar notificações pelo WhatsApp

**Feature**: 024-notificacoes-whatsapp

## Pré-requisitos

1. **Meta** (uma vez, fora do sistema):
   - App do tipo Business no Meta for Developers com o produto WhatsApp; portfólio empresarial.
   - Para desenvolvimento: o **número de teste** da Meta e até 5 números destinatários
     verificados no painel. Para produção: número dedicado e portfólio verificado.
   - Usuário do sistema com token permanente (`whatsapp_business_messaging`,
     `whatsapp_business_management`).
   - Os 5 modelos de [contracts/modelos-whatsapp.md](./contracts/modelos-whatsapp.md) aprovados.
2. **Variáveis** em `.env.local` (e na Vercel): `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
   `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_GRAPH_VERSION`,
   `WHATSAPP_TEMPLATE_LANG=pt_BR`. `BETTER_AUTH_URL` já existe.
3. **Banco**: `npm run db:generate && npm run db:migrate`.
4. **Webhook** (para US3/US4): a Meta precisa alcançar a rota por HTTPS — use um deploy de preview
   ou um túnel para `localhost:3000`, e cadastre `https://<host>/api/webhooks/whatsapp` com o
   verify token, assinando o campo `messages`.

## Testes automatizados

```bash
npm test                 # domínio: elegibilidade, destino/9º dígito, parâmetros, situação, erros, descadastro;
                         # contrato do webhook (assinatura, handshake)
npm run test:integracao  # idempotência do índice único; histórico de consentimento; transições no banco
```

## Roteiro manual

| # | Passo | Resultado esperado |
|---|-------|--------------------|
| 1 | Sem as variáveis `WHATSAPP_*`, aprovar um voluntário | Sino e e-mail normais; R-16 mostra WhatsApp `Não enviado — não configurado`; nenhum erro na tela (FR-018) |
| 2 | Com variáveis; voluntário **sem** opt-in recebe atividade | Nenhuma mensagem; R-16: `Não enviado — canal desativado` (FR-013) |
| 3 | Voluntário abre **Minha conta → Notificações** e ativa | Número mascarado; "Ativo desde…"; linha em `consentimento_whatsapp` origem `perfil` |
| 4 | Atribuir atividade a ele | WhatsApp `sos_atividade_atribuida` chega com título, mensagem e botão; e-mail também chega; ação do coordenador não fica mais lenta |
| 5 | Ler a mensagem no celular | R-16 passa por `Enviado → Entregue → Lido`; o sino **continua** não lido (FR-027) |
| 6 | Rodar o cron: `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/lembrete-turno` com turno nas próximas 26 h | Lembrete chega no WhatsApp; continua sem e-mail |
| 7 | Convocação com 900 caracteres e quebras de linha | Aviso de encurtamento antes de enviar; WhatsApp com texto em linha única + "… (continua no SOS Jaraguá)"; e-mail completo; toast com contagem do WhatsApp |
| 8 | Reexecutar o processamento do mesmo lote (teste de integração) | Nenhuma segunda mensagem (FR-008) |
| 9 | Responder "Sair" no WhatsApp | Preferência desativada; confirmação recebida; próximo evento não gera mensagem (US4) |
| 10 | Responder "oi" duas vezes seguidas | Uma única resposta automática em 24 h |
| 11 | `curl -X POST` no webhook sem assinatura | `401`; nada muda |
| 12 | Voluntário com telefone fixo abre a tela | Aviso de que precisa de celular; ativação indisponível |
| 13 | R-16 logado como membro da Defesa Civil vs. administrador | Destino mascarado para o membro, completo para o admin (FR-025) |
| 14 | Candidatura nova marcando a caixa do WhatsApp | Após envio, preferência ativa com origem `cadastro`; desmarcada no reenvio não desativa |
| 15 | Convocação para todos os voluntários de teste, com o cronômetro da action | A action responde no mesmo tempo de antes da feature; no R-16, nenhuma linha fica em `Pendente` 10 min depois (SC-002) |
