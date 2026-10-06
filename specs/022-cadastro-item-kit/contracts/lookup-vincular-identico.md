# Contrato: `Lookup` — prop `vincularIdentico` (extensão da 021)

Arquivo: `src/shared/ui/lookup/lookup.tsx` · Base: `specs/021-componente-lookup/contracts/lookup-componente.md`
· Spec: FR-009, US2-AS3

```ts
/**
 * Só com `permitirValorLivre`. Ao sair do campo sem seleção, se exatamente um
 * registro das sugestões carregadas para o texto atual for "idêntico" a ele,
 * seleciona esse registro.
 */
vincularIdentico?: (texto: string, registro: T) => boolean
```

- **V-01**: a prop é ignorada sem `permitirValorLivre` ou quando já há `value`.
- **V-02**: só considera sugestões cuja consulta foi feita para o texto atual, ou seja, termo da
  query igual ao texto depois do `trim`. Sugestões de um termo antigo (debounce em andamento) não
  vinculam. Nesse caso, o servidor resolve no salvamento.
- **V-03**: registros com `motivoIndisponivel` não são vinculados.
- **V-04**: com 0 ou mais de 1 registro idêntico, nada acontece no blur. O servidor recusa o caso
  ambíguo ao salvar.
- **V-05**: o vínculo chama `onSelecionar(registro)`, igual a escolher a sugestão. O texto passa
  a ser `descricaoDe(registro)` (grafia do cadastro).
- **V-06**: ir para a lista de sugestões, para o botão de pesquisa ou para o diálogo não conta
  como sair do campo. É a mesma regra do `aoPerderFoco` atual.
- **V-07**: os usos atuais (Entrada, Descarte, Saída, kit de destino) não passam a prop, então o
  comportamento deles não muda.
