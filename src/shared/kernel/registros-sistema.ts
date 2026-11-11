/**
 * Registros padrão do sistema (026-danger-zone-admin, research D4, FR-012a).
 *
 * Quando a Danger Zone apaga um registro **preservando** os dependentes, um
 * vínculo obrigatório de histórico não pode ficar vazio: uma entrada de estoque
 * precisa de item, uma atividade precisa de categoria e de autor. Esses
 * vínculos passam a apontar para um destes registros — "Usuário removido",
 * "Item removido", "Categoria removida".
 *
 * Os ids são **fixos** e literais na migração que os cria. Ficam no kernel, e
 * não no módulo `manutencao`, porque as listagens de outros módulos precisam
 * excluí-los das listas de escolha (research D15) sem depender da Danger Zone.
 *
 * Só existem três porque só `user`, `item` e `atividade_categoria` são destino
 * de vínculo histórico obrigatório (research D3). Um quarto exige migração e
 * entrada aqui — e o teste do catálogo quebra se faltar.
 */
export const REGISTROS_SISTEMA = {
    usuario: 'sistema-usuario-removido',
    item: '00000000-0000-4000-8000-000000000001',
    categoriaAtividade: '00000000-0000-4000-8000-000000000002'
} as const

/** Tabela física → id do registro padrão que ela abriga. */
export const REGISTRO_SISTEMA_POR_TABELA: Readonly<Record<string, string>> = {
    user: REGISTROS_SISTEMA.usuario,
    item: REGISTROS_SISTEMA.item,
    atividade_categoria: REGISTROS_SISTEMA.categoriaAtividade
}

/** Rótulo pt-BR de cada registro padrão, igual ao `nome` gravado pela migração. */
export const ROTULO_REGISTRO_SISTEMA: Readonly<Record<string, string>> = {
    user: 'Usuário removido',
    item: 'Item removido',
    atividade_categoria: 'Categoria removida'
}

/** `true` quando `chave` é o registro padrão de `tabela`. */
export function ehRegistroSistema(tabela: string, chave: string): boolean {
    return REGISTRO_SISTEMA_POR_TABELA[tabela] === chave
}
