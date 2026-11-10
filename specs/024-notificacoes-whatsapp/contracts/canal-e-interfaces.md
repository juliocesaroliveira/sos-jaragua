# Contrato: canal WhatsApp no serviço, telas e relatório

**Feature**: 024-notificacoes-whatsapp

## 1. `notificacaoService.enviarEmLote` (comportamento acrescentado)

Assinatura do port inalterada. Por chunk de 50, depois de `gravarNaPlataforma` e
`despacharEmails` (ordem atual preservada):

1. Filtra as notificações cujo evento passa em `eventoVaiPorWhatsapp` (ou cujo `canais` explícito
   inclui `'whatsapp'`). Nenhuma → fim.
2. Lê em lote: `user.ativo`, `preferencia_whatsapp.ativo`, telefone via `ContatosWhatsapp`.
3. `avaliarElegibilidade` por destinatário; sem configuração → todos `nao_configurado`.
4. Insere numa instrução as linhas `notificacao_envio` (`canal = whatsapp`): `pendente` +
   `destino` para elegíveis; `nao_enviado` + `motivo` para os demais. `ON CONFLICT DO NOTHING`.
5. `after(() => enviarPendentes(linhasInseridas))`; fora de escopo de requisição, inline.
6. `enviarPendentes`: concorrência 10; por linha, `enviarModelo`; sucesso → `enviado` +
   `idExterno` + `enviadoEm`; erro → `falhou` + `motivo` + `erro`. `UPDATE ... WHERE status =
   'pendente'`.

Falha em qualquer passo: `console.error('[notificacoes] whatsapp …')` e retorno normal (FR-017).

**Mudança no port**: a assinatura de `enviar`/`enviarEmLote` não muda; o port ganha
`enviarEmLoteComResumo(notificacoes): Promise<{ whatsapp: { elegiveis: number; naoAlcancaveis:
number } }>`, que faz o mesmo que `enviarEmLote` e devolve o resumo somado dos chunks
(`despacharWhatsapp` devolve o resumo de cada um). Usado **apenas** por `enviarBroadcast` (FR-024).

A situação "usuário ativo" vem de `buscarContatos` (já existente); preferência de
`whatsapp-repositorio.lerPreferencias`; telefone de `ContatosWhatsapp.telefonesDe` — nenhuma
leitura nova de tabela de outro módulo (research D10).

## 2. `enviarBroadcast` (Server Action existente)

- Retorno: `ResultadoAction<{ destinatarios: number; whatsapp: { elegiveis: number; naoAlcancaveis: number } }>`.
- Validação: sem mudança (`mensagem` até 2000). O encurtamento para o WhatsApp é do domínio.
- Tela `/convocacao`: contador "WhatsApp: N/700"; acima de 700, `Alert` tom `aviso`: "No WhatsApp,
  a convocação vai encurtada (primeiros ~680 caracteres) com um botão para o texto completo.
  E-mail e sino levam o texto inteiro." Após enviar: toast com "X voluntários convocados —
  Y pelo WhatsApp" e, se `naoAlcancaveis > 0`, "Z sem WhatsApp habilitado".

## 3. Tela `/conta/notificacoes` (nova)

- Server Component; sessão obrigatória (deny-by-default do proxy; sem entrada em `REGRAS_DE_ROTA`).
- Item de navegação: grupo `pessoal`, rótulo "Notificações", ícone `BellRing`, todas as roles
  (`ROLES`) — há equipe com perfil de voluntário —, sem atalho na home.
- Telefone e existência de perfil vêm de `ContatosWhatsapp.telefonesDe([userId])`.
- Estados:

| Situação                                  | Exibe                                                                                     |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| Sem `voluntario_perfil`                   | `Alert info`: o WhatsApp fica disponível depois do cadastro de voluntário (link)          |
| Telefone fixo                             | `Alert aviso`: é preciso um celular; link para atualizar a candidatura                    |
| Celular, desabilitado                     | Número mascarado, lista dos 5 avisos cobertos, botão "Ativar avisos pelo WhatsApp"        |
| Celular, habilitado                       | Número mascarado, "Ativo desde dd/mm/aaaa", botão secundário "Desativar"                  |

- Server Action `alterarPreferenciaWhatsapp({ ativo: boolean })`: sessão obrigatória; userId da
  sessão (nunca do cliente); chama o caso de uso; origem `perfil`; `revalidatePath`.
  Resultado `ResultadoAction<{ ativo: boolean }>`. Toast de sucesso pt-BR.
- Mobile-first: botão com altura ≥ 44 px, texto ≤ 1 coluna (constituição, Fluxo de
  Desenvolvimento).

## 4. Formulário de candidatura (alterado)

- Campo novo `aceitaWhatsapp: boolean` (default `false`), checkbox logo abaixo de "Telefone":
  "Quero receber avisos do SOS Jaraguá pelo WhatsApp neste número" + texto de apoio "Aprovação do
  cadastro, atividades, mudanças, lembretes de turno e convocações urgentes. Você pode desativar
  quando quiser em Minha conta → Notificações ou respondendo SAIR."
- O esquema Zod do formulário e da action aceitam o campo; `SubmeterCandidaturaUseCase` registra a
  concessão (origem `cadastro`) via `ConsentimentoWhatsappPort` só quando `true` e a candidatura é
  aceita. Desmarcado não revoga um opt-in já existente (reenvio da candidatura).

## 5. Relatório R-16 e pacote de contingência

- `CANAIS` e `ROTULO_CANAL` ganham `whatsapp: 'WhatsApp'`.
- Situações do filtro ganham `entregue`, `lido`, `nao_enviado` (rótulos "Entregue", "Lido",
  "Não enviado"); o padrão continua `falhou`.
- Colunas novas na lista: "Motivo" (rótulo pt-BR de `motivo`) e "Destino" (`mascararTelefone`,
  exceto para `administrador`).
- Totais por tipo × canal × situação já agrupam por `canal` — incluem o WhatsApp sem mudança de
  consulta além dos novos valores.
