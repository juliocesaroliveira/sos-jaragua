# Contrato — Registro de Navegação

**Módulo**: `src/shared/auth/navegacao.ts`
**Consumidores**: `src/shared/ui/shell/sidebar-nav.tsx`, `src/shared/auth/navegacao.test.ts`

Este é o contrato interno mais importante da feature: é onde "quem vê o quê" fica escrito, e é o único ponto que precisa mudar quando um destino é adicionado.

---

## Superfície pública

```ts
export type IdGrupo = 'pessoal' | 'voluntariado' | 'operacao' | 'estoque' | 'coordenacao' | 'administracao'

/** Identificador de ícone — NÃO um componente React. Mantém o registro
 *  serializável e importável por teste de nó, sem renderizar React (D7). */
export type NomeIcone = string

export type ItemNavegacao = {
    readonly href: string
    readonly rotulo: string
    readonly icone: NomeIcone
    readonly grupo: IdGrupo
    readonly roles: readonly Role[]
}

export type GrupoNavegacao = {
    readonly id: IdGrupo
    readonly rotulo: string
    readonly ordem: number
}

export const GRUPOS: Readonly<Record<IdGrupo, GrupoNavegacao>>
export const NAVEGACAO: readonly ItemNavegacao[]

export function itensDeNavegacao(role: Role): readonly ItemNavegacao[]
export function gruposVisiveis(itens: readonly ItemNavegacao[]): readonly SecaoNavegacao[]
export function itemAtivo(pathname: string, itens: readonly ItemNavegacao[]): ItemNavegacao | undefined

export type SecaoNavegacao = {
    readonly grupo: GrupoNavegacao
    readonly itens: readonly ItemNavegacao[]
}
```

**Restrição de importação**: este módulo NÃO importa React, Next.js, Drizzle nem nada de `src/modules/`. É uma estrutura de dados e três funções puras. Essa restrição é o que permite testá-lo em `npm test` sem ambiente de DOM e o que impede que ele acumule responsabilidade de UI.

---

## Garantias comportamentais

### `itensDeNavegacao(role)`

| Garantia | Descrição |
|----------|-----------|
| G-01 | Retorna exatamente os itens cujo `roles` contém `role`. |
| G-02 | Preserva a ordem de declaração de `NAVEGACAO`. |
| G-03 | Pode retornar `[]`. Não lança. |
| G-04 | Pura e referencialmente transparente — mesma `role`, mesmo resultado. |

### `gruposVisiveis(itens)`

| Garantia | Descrição |
|----------|-----------|
| G-05 | Nenhuma seção retornada tem `itens` vazio (FR-026). |
| G-06 | Seções ordenadas por `GrupoNavegacao.ordem` crescente. |
| G-07 | A união dos itens das seções é igual ao conjunto de entrada — nada é perdido nem duplicado. |

### `itemAtivo(pathname, itens)`

| Garantia | Descrição |
|----------|-----------|
| G-08 | Casa por igualdade exata ou por prefixo de segmento (`/estoque` casa `/estoque/entrada`, mas **não** `/estoquex`). |
| G-09 | Havendo múltiplas correspondências, retorna a de `href` **mais longo**. `/estoque/kits` → "Kits", nunca "Estoque". |
| G-10 | Retorna `undefined` quando nenhum item corresponde — legítimo, ex.: `/sem-permissao`. |

G-09 corrige um defeito latente do shell atual, que usa a primeira correspondência e marcaria dois itens de estoque como ativos ao mesmo tempo.

---

## Invariantes travadas por teste

Estes são os testes que impedem a feature de apodrecer. Cada um MUST existir em `navegacao.test.ts`.

### INV-01 — Consistência com a autorização de rota (FR-011)

> Para todo item de `NAVEGACAO` cujo `href` case com uma regra de `REGRAS_DE_ROTA`, o conjunto `item.roles` MUST ser **idêntico** ao conjunto da regra.

Igualdade, não subconjunto: um subconjunto passaria despercebido escondendo um destino de quem tem direito a ele, violando FR-013. Falha aqui = menu e gate divergiram.

### INV-02 — Declaração explícita e não-vazia (FR-021)

> Todo item MUST declarar `roles` com pelo menos um elemento.

Garantido em parte pelo tipo; o teste cobre o array vazio, que o tipo não impede.

### INV-03 — Destino existente (FR-013, SC-004)

> Todo `href` MUST corresponder a uma página existente sob `app/`.

Implementável varrendo `app/` por `page.tsx` e normalizando os route groups (`(publico)`, `(interno)`, `(staff)` não aparecem na URL). Evita reintroduzir um item para uma rota planejada e não construída — o caso `/admin` de research.md D4.

### INV-04 — Cobertura da matriz por perfil (FR-016 … FR-020)

> Para cada um dos cinco perfis, `itensDeNavegacao(role)` MUST produzir exatamente o conjunto de `href` da matriz em `data-model.md`.

Teste tabelado, um caso por perfil, com a lista de `href` esperada escrita literalmente. É o teste que falha quando alguém adiciona um destino sem pensar em quem deveria vê-lo.

### INV-05 — Unicidade de `href`

> Nenhum `href` aparece duas vezes em `NAVEGACAO`.

### INV-06 — Rótulos em pt-BR não vazios (FR-025)

> Todo `rotulo` de item e de grupo MUST ser não vazio.

O idioma em si não é verificável por teste automatizado; a checagem cobre o esquecimento estrutural (rótulo vazio), e a revisão cobre o resto.

---

## Contrato de extensão — adicionando um destino

Quem adiciona uma página autenticada nova faz **exatamente** isto:

1. Cria a página sob `app/(interno)/` (ou `app/(interno)/(staff)/` se exigir role de staff).
2. Se a rota exigir role específica, adiciona a entrada em `REGRAS_DE_ROTA` — inalterado, é o processo que já existe.
3. Adiciona uma linha a `NAVEGACAO` com `roles` **idêntico** ao da regra do passo 2 (ou declarado por decisão de produto, se não houver regra).
4. Atualiza a lista esperada de INV-04 para os perfis afetados.

Pular o passo 3 não quebra nada automaticamente — o destino simplesmente não aparece no menu, o que é seguro por omissão. Pular o passo 4 quebra o teste, que é o efeito desejado: a matriz é a documentação executável de quem vê o quê.
