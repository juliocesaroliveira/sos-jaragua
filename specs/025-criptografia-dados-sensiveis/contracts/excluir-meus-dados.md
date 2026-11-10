# Contrato — Excluir meus dados (Server Action)

**Arquivo**: `src/modules/voluntariado/presentation/actions/dados-sensiveis.ts`
**Caso de uso**: `application/use-cases/anonimizar-titular.ts`
**Requisitos**: FR-020 a FR-025, FR-028 a FR-031

## Entrada

```text
{ confirmacao: true }
```

O titular vem **da sessão**, nunca do payload: ninguém exclui a conta de outra pessoa por este
caminho. A confirmação explícita é exigida pelo contrato (FR-021) e a UI precisa tê-la obtido antes.

## Saída

| Resultado | Quando |
| --------- | ------ |
| `{ ok: true, jaAnonimizado: false }` | Anonimização concluída |
| `{ ok: true, jaAnonimizado: true }` | Já estava anonimizado — idempotente, sem erro (FR-025, FR-030) |
| `{ ok: false, erro: 'nao_autenticado' }` | Sem sessão válida |
| `{ ok: false, erro: 'ator_insubstituivel' }` | O titular é o último ator de registros que exigem responsável (FR-031) |

## Pré-visualização do impacto (FR-021)

Antes de confirmar, a tela precisa informar o que será perdido. A consulta que alimenta esse texto
devolve:

```text
{ turnosFuturosConfirmados: number, turnosPassados: number, temPerfilVoluntario: boolean }
```

`turnosFuturosConfirmados` é o número que a confirmação precisa mostrar, porque essas alocações serão
canceladas e as vagas liberadas.

## Comportamento obrigatório — ordem importa

Tudo em **uma transação** no Postgres, exceto a auditoria, que vem depois e não desfaz nada:

1. Cancelar as alocações futuras confirmadas, liberando vaga (FR-025).
2. `UPDATE` em `voluntario_perfil`: campos pessoais a nulo, `anonimizado_em = now()`.
3. `UPDATE` em `user`: `name` e `email` para valores neutros irrepetíveis, `data_nascimento` a nulo,
   `ativo = false`.
4. `DELETE` em `voluntario_habilidade`, `notificacao`, `account` e `session` do titular.
5. Commit.
6. `withAudit` com ação `'anonimizar'`, **sem** reproduzir na trilha os dados que acabaram de ser
   eliminados (FR-029).

## Proibições explícitas

- **Nunca `DELETE FROM user`.** Falharia para quem tem histórico operacional e, quando passasse,
  destruiria o histórico de turnos por cascade (D7). A linha é sobrescrita, não removida.
- **Nunca apagar linhas de `alocacao`.** Elas são o registro operacional que FR-024 manda preservar.
- **Nunca alterar registros de auditoria neste fluxo.** A trilha já está livre de texto plano por
  FR-026 e pela remediação única de FR-027; a exclusão não abre nova exceção à imutabilidade.

## Invalidação de cache

Após o commit, invalidar as tags que exibem dados do titular — `voluntariado:pendentes`,
`voluntariado:listagem` e as de atividade afetadas — para que nenhuma tela sirva da entrada velha
(FR-022).
