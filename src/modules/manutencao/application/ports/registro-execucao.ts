/**
 * A auditoria da Danger Zone é do módulo Auditoria (contracts/auditoria-manutencao.md);
 * o `manutencao` só consome a porta pública dele (Princípio I do lado do Mongo).
 */
export type { EventoExecucao, FaseEvento, RegistroExecucaoManutencao, SnapshotLinha } from '@/src/modules/auditoria'
