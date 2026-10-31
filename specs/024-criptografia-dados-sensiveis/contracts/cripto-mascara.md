# Contrato — Cripto e Máscara (`src/shared/cripto`, `src/shared/mascara`)

Interfaces internas consumidas pelas camadas `infrastructure` e `presentation`. Não são expostas por
HTTP. Descritas em termos de comportamento observável, não de implementação.

## `src/shared/cripto`

### `cifrar(valor: string): string`
Devolve o envelope `v1.<iv>.<ct>.<tag>`. **Não determinística**: duas chamadas com o mesmo valor
produzem saídas diferentes (IV aleatório). Lança se a chave não estiver configurada.

### `decifrar(envelope: string): string`
Devolve o valor original. **Lança `ValorIlegivelError`** quando o envelope é malformado, a versão é
desconhecida, ou a tag de autenticação não valida — nunca devolve string vazia nem valor parcial.

### `indiceCego(valor: string): string`
Devolve `base64url(HMAC-SHA256(subchave_indice, <somente dígitos de valor>))`. **Determinística** por
contrato: é o que sustenta unicidade e busca exata. A normalização para dígitos é parte do contrato —
`123.456.789-01` e `12345678901` produzem o mesmo índice.

### `validarChave(): void`
Lança com mensagem em pt-BR nomeando a variável ausente ou malformada. Chamada por
`instrumentation.ts#register` e, em defesa em profundidade, na primeira utilização do módulo.

**Invariante de chave**: `DADOS_SENSIVEIS_CHAVE` é base64 de exatamente 32 bytes. Subchaves derivadas
por HKDF-SHA256 com `info` distinto para cifra e para índice — a mesma chave nunca serve a dois
propósitos.

## `src/shared/mascara`

Funções **puras**: sem I/O, sem import de Next, Drizzle ou Mongo. Testáveis em milissegundos
(Princípio III).

### `mascararCpf(cpf: string): string`
Preserva os 2 primeiros e os 2 últimos dígitos. `12345678901` → `12•••••••01`.

### `mascararCep(cep: string): string`
Mesma regra. `89250000` → `89••••00`.

### `mascararData(iso: string): string`
Oculta dia e mês, preserva o ano. `1990-03-15` → `••/••/1990`.

### Regra de exposição mínima
Para as máscaras de 2+2: se o valor tiver **5 caracteres ou menos**, mascarar por inteiro — expor 2 no
início e 2 no fim revelaria praticamente o valor completo (FR-008). Vale para qualquer campo que venha
a entrar na classificação, não só os três atuais.

### `campoVisivelPara(campo: CampoSensivel, role: Role, ehTitular: boolean): boolean`
Única leitura autorizada da Matriz de Visibilidade. Pura. **Nunca chamada dentro de escopo
`'use cache'`** — a role vem da sessão, e `'use cache'` não admite `cookies()`/`headers()` (D4).

## Contrato de apresentação

Toda query que hoje devolve um campo sensível passa a devolver a forma de apresentação, nunca o valor
completo:

```text
{ estado: 'mascarado', exibicao: '12•••••••01' }
{ estado: 'ausente' }
{ estado: 'ilegivel' }
```

Isso é o que torna FR-012 estrutural em vez de uma lembrança por tela: uma tela nova que consuma a
query recebe o mascarado por construção, sem precisar saber que o campo é sensível.
