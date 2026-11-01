# Contrato — Revelar dado sensível (Server Action)

**Arquivo**: `src/modules/voluntariado/presentation/actions/dados-sensiveis.ts`
**Caso de uso**: `application/use-cases/revelar-dado-sensivel.ts`
**Requisitos**: FR-015, FR-016, FR-017

## Entrada

```text
{ voluntarioPerfilId: uuid, campo: 'cpf' | 'dataNascimento' | 'cep' }
```

Validada com Zod na Server Action, conforme o Princípio I (a `presentation` faz parse, checa sessão e
chama **um** caso de uso — nenhuma regra de negócio).

## Saída

| Resultado | Quando |
| --------- | ------ |
| `{ ok: true, valor: string }` | A role do solicitante tem o campo na Matriz, ou é o titular |
| `{ ok: false, erro: 'sem_permissao' }` | Fora da Matriz — mensagem em pt-BR, sem revelar o valor |
| `{ ok: false, erro: 'ilegivel' }` | O valor existe mas não pôde ser decifrado (FR-014) |
| `{ ok: false, erro: 'nao_encontrado' }` | Perfil inexistente ou titular anonimizado |

## Comportamento obrigatório

1. **Nunca cacheada.** Lê a sessão, logo nunca entra em escopo `'use cache'` (`DESIGN.md` §7 e D4).
   Este é o único caminho pelo qual texto plano sensível chega ao cliente.
2. **Decide por campo, não por tela.** A permissão é `campoVisivelPara(campo, role, ehTitular)` — um
   `membro_defesa_civil` recebe `cep` e é recusado em `cpf` na mesma tela.
3. **Audita toda revelação bem-sucedida** com `withAudit`, ação `'read'`, entidade `'Voluntario'`,
   registrando ator, perfil e campo. A falha de auditoria **não** impede a revelação (Princípio V), e é
   registrada em log estruturado para reconciliação (FR-017, cenário 4 da US3).
4. **Não audita recusa como revelação.** Uma tentativa negada não produz registro de leitura — não
   houve acesso ao dado.
5. **Não registra o valor revelado na trilha.** A auditoria diz *qual campo* foi revelado, nunca o
   conteúdo — do contrário a própria trilha de FR-017 violaria FR-026.

## Nota de segurança

A autorização é verificada **no servidor, dentro do caso de uso**, não na UI. O botão de revelar pode
estar visível indevidamente sem que isso conceda acesso — o que mantém a defesa em profundidade do
Princípio IV (a tela é a primeira barreira, o caso de uso é a fonte de verdade).
