/**
 * Padrão de formulário da aplicação (016-formularios-rhf-zod).
 *
 * Três peças: a configuração única de validação (`useFormulario`), os
 * construtores de campo compartilhados (`campos`) e o mapeamento da recusa do
 * servidor para o campo certo (`aplicarErrosDoServidor`). O `<form>` em si vive
 * em `src/shared/ui/formulario`, por ter JSX.
 */
export { useFormulario } from './use-formulario'
export {
    aplicarErrosDoServidor,
    type AplicarErrosDoServidorParams,
    type ErrosDoServidorAplicados
} from './erros-servidor'
export { email, listaNaoVazia, quantidadePositiva, selecaoObrigatoria, senha, textoObrigatorio } from './campos'
