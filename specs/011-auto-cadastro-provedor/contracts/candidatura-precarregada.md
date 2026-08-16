# Contrato — Candidatura pré-preenchida

**Feature**: `011-auto-cadastro-provedor` | Cobre FR-011 a FR-022

## C-10 — Props do formulário

`app/(interno)/voluntariado/candidatura/page.tsx` (Server Component) resolve tudo e passa:

```
CandidaturaFormProps {
  habilidades: { id, nome }[]           // existente
  statusAtual?: 'pendente'|'aprovado'|'rejeitado'  // existente
  motivoRejeicao?: string | null        // existente
  email: string                         // NOVO — da sessão, exibição apenas
  nomeInicial: string                   // NOVO — nome da candidatura anterior, senão da conta
  dataNascimentoDaConta: string | null  // NOVO — 'YYYY-MM-DD' ou null
}
```

O componente cliente **não** consulta sessão nem faz fetch para descobrir esses valores. Sem
estado de carregamento, sem flash de campo editável.

## C-11 — Estado dos campos

| Campo | Condição | Estado | Requisito |
| --- | --- | --- | --- |
| E-mail | sempre | somente leitura | FR-012 |
| Nome completo | sempre | editável, pré-preenchido com `nomeInicial` | FR-013 |
| Data de nascimento | `dataNascimentoDaConta != null` | somente leitura, exibindo o valor | FR-014 |
| Data de nascimento | `dataNascimentoDaConta == null` | editável, vazia, obrigatória | FR-014 |
| Demais campos | — | inalterados | — |

**Somente leitura ≠ `disabled`**: usar `readOnly` + `aria-readonly` para campos de texto, para
que leitores de tela anunciem o campo **com seu valor** (FR-022). Campo `disabled` sai da ordem
de foco e frequentemente não é anunciado.

Para a data bloqueada, renderizar o valor formatado em `dd/mm/aaaa` em vez de montar o
`DatePicker` — o componente Ark só expõe `disabled`, e um calendário que não abre é pior que um
texto legível.

## C-12 — Comunicação da origem (FR-015)

Cada campo somente leitura carrega texto de apoio indicando a procedência. Referência:

> Vem da sua conta.

Não usar apenas esmaecimento como sinal. O tratamento visual MUST manter contraste ≥ 4.5:1 nos
temas claro e escuro — `disabled:opacity-50`, que é o estado atual de
`src/shared/ui/campo/campo.tsx:74`, **não** atende e não deve ser reaproveitado aqui
([research.md](../research.md) D10).

## C-13 — Server Action `submeterCandidatura`

**Assinatura de entrada** (`EntradaFormularioCandidatura`):

| Campo | Mudança |
| --- | --- |
| `email` | **não existe** — nunca aceito do cliente (FR-019) |
| `dataNascimento` | passa a `optional()` — ausente quando a conta já a possui |
| `nomeCompleto` | inalterado, obrigatório |
| demais | inalterados |

**Fluxo obrigatório** (`presentation` continua fina, Princípio I):

1. `obterSessao()` → sem sessão, `erroAction('nao_autenticado', ...)`
2. `esquema.safeParse(entrada)`
3. `useCase.executar({ userId, dados, dataNascimentoDaConta: ator.dataNascimento })`
4. `updateTag`/`revalidateTag` como hoje

**Invariante de segurança (FR-017)**: `dataNascimentoDaConta` vem da **sessão**, nunca do corpo
do POST. Se a conta tem data e o cliente enviar outra, a do cliente é descartada por
`resolverDataNascimento` — não gera erro de validação, é simplesmente ignorada.

## C-14 — Caso de uso `SubmeterCandidaturaUseCase`

**Entrada**: `{ userId, dados, dataNascimentoDaConta }`

**Sequência**:

1. `resolverDataNascimento(dataNascimentoDaConta, dados.dataNascimento)` → `dataFinal`
2. `validarCandidatura({ ...dados, dataNascimento: dataFinal })` — inclui maioridade
3. Regras existentes preservadas: CPF de outra conta → recusa; candidatura já aprovada → recusa
4. Dentro de `unidadeDeTrabalho.executar` e sob `withAudit`:
   - `voluntarios.salvarCandidatura(...)`
   - `usuarios.definirDataNascimentoSeAusente(userId, dataFinal)`

**Erros preservados** (FR-020, FR-021): mensagens e chaves de erro por campo permanecem as
mesmas; nenhum consumidor de `camposComErro` precisa mudar.

**Caso de borda**: `dataFinal === undefined` (conta sem data **e** formulário sem data) →
`validarCandidatura` devolve `'Informe a data de nascimento.'` no campo, como hoje.

## C-15 — Port `UsuarioRepository` (Identidade)

Dois métodos novos:

```
definirDataNascimentoSeAusente(userId: string, data: string): Promise<void>
buscarDataNascimento(userId: string): Promise<string | null>
```

`definirDataNascimentoSeAusente` MUST ser idempotente por construção — a condição "se ausente"
vive no `WHERE ... AND data_nascimento IS NULL` do UPDATE, não em uma leitura anterior. Chamá-lo
duas vezes com valores diferentes deixa o primeiro valor intacto.

`buscarDataNascimento` existe para os testes de integração e para consumidores futuros; não é
usado no caminho de render (a sessão já traz o valor).
