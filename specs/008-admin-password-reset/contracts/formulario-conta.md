# Contrato de UI: formulário de conta (`UsuarioFormDialog`)

**Feature**: 008-admin-password-reset

Um único componente serve cadastro e edição (decisão de 006, preservada). Componentes vêm do barrel `@/src/shared/ui` — nenhum componente novo é criado.

---

## U-01 — Campo de e-mail

| Modo         | Comportamento                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Edição**   | `Input` com `disabled`, valor vindo de `usuario.email`, **fora** do `register` do react-hook-form (FR-001, FR-002) |
| **Cadastro** | inalterado: editável, obrigatório, validado (FR-003)                                                               |

- **U-01.1**: por estar desabilitado e não registrado, o e-mail não entra no payload da Server Action. O schema do servidor, que não aceita `email`, é a segunda barreira (defesa em profundidade).
- **U-01.2**: o rótulo "E-mail" continua associado ao campo, para que o leitor de tela anuncie valor e estado desabilitado.

## U-02 — Ação "Trocar Senha" no rodapé

Entra no slot `acoes` do `Dialog`, que já é o rodapé onde vivem Cancelar e Salvar.

- **U-02.1**: exibida **somente** em modo edição **e** quando `usuario.podeTrocarSenha` for `true` (FR-004, FR-005, FR-006).
- **U-02.2**: rótulo exato: **"Trocar Senha"**.
- **U-02.3**: com a troca ativa, a mesma posição oferece a ação inversa (cancelar a troca), que recolhe e limpa o campo (FR-012).
- **U-02.4**: é `type="button"` — nunca submete o formulário.
- **U-02.5**: visualmente subordinada a Salvar (variante secundária/ghost), à esquerda de Cancelar/Salvar, para não competir com a ação primária.

## U-03 — Campo de senha revelável

- **U-03.1**: oculto por padrão; revelado apenas ao acionar "Trocar Senha" (FR-007).
- **U-03.2**: `type="password"`, valor mascarado, inicialmente vazio (FR-007, FR-018).
- **U-03.3**: texto de apoio idêntico ao do cadastro ("Mínimo de 8 caracteres"), e a mesma validação (FR-010).
- **U-03.4**: com o campo revelado e vazio, o envio é bloqueado com mensagem no campo (FR-011).
- **U-03.5**: com o campo oculto, `novaSenha` **não** é enviada — o envio é o de hoje, só nome e papel (FR-008).
- **U-03.6**: ao receber foco, o campo é anunciado como campo de senha e associado ao seu rótulo.

## U-04 — Ciclo de vida do estado

- **U-04.1**: abrir o diálogo recolhe a troca e limpa o campo — o `useEffect` de `reset` já existente é o ponto único de reinicialização (FR-020).
- **U-04.2**: alternar da conta A para a conta B sem fechar o diálogo reavalia `podeTrocarSenha` e recolhe a troca; a senha digitada para A nunca alcança B (edge case do spec).
- **U-04.3**: após salvar com sucesso, o diálogo fecha e a confirmação é exibida por `avisar.sucesso`, como nas demais operações (FR-017).
- **U-04.4**: a confirmação menciona que a senha foi redefinida, sem exibir o valor (FR-018).

## U-05 — Erros

- **U-05.1**: erros por campo devolvidos pelo servidor continuam sendo aplicados via `camposComErro` + `setError`, inclusive para `novaSenha`.
- **U-05.2**: `senha_nao_aplicavel` é exibido como erro geral (`avisar.erro`) — não pertence a nenhum campo, e é um estado que a tela não deveria ter permitido chegar.
- **U-05.3**: em qualquer falha, o diálogo permanece aberto com o que foi digitado, exceto a senha, que é sempre reapresentada vazia.

## U-06 — Não-objetivos

- Não há campo de confirmação de senha.
- Não há medidor de força de senha nem política nova de complexidade.
- Não há alteração de e-mail, vínculo de provedores, nem "exigir troca no próximo acesso".
