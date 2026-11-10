# Contrato: modelos de mensagem do WhatsApp

**Feature**: 024-notificacoes-whatsapp

Modelos a cadastrar e aprovar no WhatsApp Manager **antes** de ativar o canal em produção.
Todos: categoria **Utility**, idioma **pt_BR** (`WHATSAPP_TEMPLATE_LANG`), 2 variáveis no corpo,
1 botão de URL **estática**. `{{1}}` = título da notificação, `{{2}}` = mensagem da notificação,
ambos já normalizados por `parametrosDoModelo` (sem quebra de linha; mensagem ≤ 700).

O nome do modelo é a chave usada pelo código (`NomeModelo`); mudar um nome exige mudar o código.
`<BASE>` = valor de `BETTER_AUTH_URL` do ambiente — o botão é cadastrado com a URL de produção.

| Evento                | Modelo (`NomeModelo`)         | Corpo                                                                                                                              | Botão "Abrir no SOS Jaraguá" |
| --------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `triagem_concluida`   | `sos_triagem_concluida`       | `Atualização do seu cadastro de voluntário no SOS Jaraguá.`⏎`*{{1}}*`⏎`{{2}}`⏎`Defesa Civil de Jaraguá do Sul`                  | `<BASE>/`                    |
| `atividade_atribuida` | `sos_atividade_atribuida`     | `Você foi escalado para uma atividade do SOS Jaraguá.`⏎`*{{1}}*`⏎`{{2}}`⏎`Confira local e horário no sistema.`                    | `<BASE>/voluntariado/minhas-atividades` |
| `alteracao_atividade` | `sos_alteracao_atividade`     | `Houve uma mudança em uma atividade sua no SOS Jaraguá.`⏎`*{{1}}*`⏎`{{2}}`⏎`Confira os detalhes no sistema.`                      | `<BASE>/voluntariado/minhas-atividades` |
| `lembrete_turno`      | `sos_lembrete_turno`          | `Lembrete do SOS Jaraguá: você tem turno em breve.`⏎`*{{1}}*`⏎`{{2}}`                                                             | `<BASE>/voluntariado/minhas-atividades` |
| `broadcast_urgencia`  | `sos_convocacao_urgente`      | `⚠️ Convocação urgente da Defesa Civil de Jaraguá do Sul.`⏎`*{{1}}*`⏎`{{2}}`⏎`Veja a convocação completa no sistema.`             | `<BASE>/`                    |

Rodapé de todos (campo footer do modelo): `Para não receber mais, responda SAIR.`

## Mensagens livres (não são modelos)

Enviadas só como **resposta** a uma mensagem recebida (janela de atendimento de 24 h, gratuita):

| Uso                         | Texto                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmação de descadastro  | `Pronto, você não vai mais receber avisos do SOS Jaraguá pelo WhatsApp. Para voltar a receber, ative em Minha conta → Notificações: <BASE>/conta/notificacoes` |
| Resposta automática         | `Este número do SOS Jaraguá só envia avisos e não é lido por ninguém. Para falar com a Defesa Civil, use os canais oficiais. Para parar de receber, responda SAIR.` |

## Chamada de envio (forma)

`POST https://graph.facebook.com/{WHATSAPP_GRAPH_VERSION}/{WHATSAPP_PHONE_NUMBER_ID}/messages`
com `Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}`:

```json
{
  "messaging_product": "whatsapp",
  "to": "5547999998888",
  "type": "template",
  "template": {
    "name": "sos_atividade_atribuida",
    "language": { "code": "pt_BR" },
    "components": [
      { "type": "body", "parameters": [ { "type": "text", "text": "<titulo>" }, { "type": "text", "text": "<mensagem>" } ] }
    ]
  }
}
```

Sucesso → `messages[0].id` vira `idExterno`. Erro → `error.code` passa por
`classificarErroMeta`; `error.message` vai para `erro`.
