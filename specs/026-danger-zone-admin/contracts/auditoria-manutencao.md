# Contrato: porta de auditoria bloqueante para manutenção de dados

Módulo dono: **Auditoria** (`src/modules/auditoria/`). Consumidor único: `manutencao`.
Coexiste com `withAudit`, que continua sendo o caminho de toda escrita de negócio com a política
de degradação graciosa do Princípio V. Esta porta é a exceção restrita da decisão Q4.

```ts
// src/modules/auditoria/index.ts (export novo)
export interface RegistroExecucaoManutencao {
    /** Lança `AuditoriaIndisponivelError` se o Mongo não responder. */
    verificarDisponibilidade(): Promise<void>

    /** Evento de fase + snapshots, numa chamada. Lança em qualquer falha — nunca engole. */
    registrarInicio(evento: EventoExecucao, snapshots: AsyncIterable<SnapshotLinha>): Promise<void>

    /** Desfecho. Lança em falha; o chamador decide o que fazer (D8 passo 5). */
    registrarDesfecho(evento: EventoExecucao): Promise<void>
}

export type EventoExecucao = {
    execucaoId: string
    fase: 'iniciada' | 'concluida' | 'falhou' | 'recusada' | 'cancelada'
    ator: Ator
    resumo: ResumoExecucao // data-model §3
}

export type SnapshotLinha = {
    tabela: string
    chave: string           // pk serializada; composta → 'a|b'
    acao: 'delete' | 'update'
    antes: Record<string, unknown>
    depois: Record<string, unknown> | null // só a coluna redirecionada
}
```

## Garantias

- **AM-01** Todo snapshot passa por `redigirCamposSensiveis` **e** pela remoção das colunas de
  credencial recebidas do catálogo, antes de sair do processo (research D9). Snapshots nunca vão
  para `console.*`, nem em falha — diferente de `registrarAuditoria`, que loga o registro
  completo para reconciliação: aqui a reconciliação é a própria recusa.
- **AM-02** `registrarInicio` grava o evento primeiro e os snapshots depois, em lotes de 500;
  sucesso parcial é falha (o chamador faz rollback do Postgres).
- **AM-03** Nenhum documento é atualizado ou apagado; o estado de uma execução é o evento de maior
  `timestamp` do seu `execucaoId`.
- **AM-04** Documentos gravados: `entidade = 'ManutencaoDados'`; evento → `entidadeId =
  execucaoId`, `acao = 'delete'`; snapshot → `entidadeId = chave`, `tabela`, `acao` do snapshot,
  `manutencao.fase = 'snapshot'`.
- **AM-05** Leitura do histórico (`listarExecucoesManutencao`) é exposta pelo módulo Auditoria;
  `manutencao` não acessa a coleção diretamente (Princípio I preservado no lado do Mongo).
