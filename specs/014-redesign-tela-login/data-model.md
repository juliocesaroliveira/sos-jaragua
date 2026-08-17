# Phase 1 — Data Model: Redesign da Tela de Login

**Feature**: `014-redesign-tela-login` | **Data**: 2026-08-16

## Escopo

**Esta feature não introduz, altera nem remove nenhuma entidade de dados.** Não há tabela nova,
coluna nova, migração, índice ou documento de auditoria. Não toca `domain/`, `application/` nem
`infrastructure/` de módulo algum.

O documento existe porque a ausência de dados novos é informação relevante ao planejamento — e
porque há estado, ainda que apenas de interface, com transições que valem registrar.

## Estado de interface

### `ModoLogin` — já existe, preservado

Estado da tela, em `login-form.tsx`. Definido em `001-unified-login-flow` (FR-006, FR-007,
FR-011) e **não alterado** por esta feature.

| Valor | Significado |
| --- | --- |
| `'opcoes'` | Estado inicial: Google, Facebook e "Usar usuário e senha" |
| `'credenciais'` | Formulário de e-mail e senha, com "Voltar" e "Acessar" |

**Transições**:

```text
'opcoes' --[clicar "Usar usuário e senha"]--> 'credenciais'
'credenciais' --[clicar "Voltar"]--> 'opcoes'   (descarta os valores dos campos)
```

Sem navegação de URL entre os dois (FR-022). A montagem inicial é sempre `'opcoes'`.

**Restrição nova imposta por esta feature**: a troca entre os dois estados não pode deslocar o
bloco de acesso na tela (FR-020). Ver `contracts/tela-login.md`.

### `visivel` — novo, interno ao componente `Password`

Estado de visibilidade do texto da senha, gerenciado pela máquina do Ark UI. Não é elevado ao
formulário nem persistido em lugar algum.

| Valor | `type` do input | Rótulo acessível do gatilho |
| --- | --- | --- |
| `false` (inicial) | `password` | "Mostrar senha" |
| `true` | `text` | "Ocultar senha" |

**Transições**:

```text
false --[acionar gatilho: ponteiro ou Enter/Espaço]--> true
true  --[acionar gatilho: ponteiro ou Enter/Espaço]--> false
```

**Invariantes**:

- Inicia sempre em `false`, em qualquer montagem (FR-031). Isso cobre o retorno via "Voltar":
  o componente é desmontado com o formulário e remonta oculto.
- Alternar **não** altera o valor do campo nem a posição do cursor (FR-034).
- Não persiste em `localStorage`, cookie, sessão ou URL. Nunca sai do navegador.

### Estados derivados, sem armazenamento

Já existentes em `login-form.tsx`, preservados:

| Estado | Origem | Uso na composição nova |
| --- | --- | --- |
| `erroServidor` | Retorno de `signIn.email` / `signIn.social` | Aviso na faixa reservada (FR-017) |
| `carregandoSocial` | Provedor em andamento | Estado de carregamento do botão (FR-019) |
| `isSubmitting` | React Hook Form | Estado de carregamento de "Acessar" (FR-019) |
| `errors` | Resolver Zod | Faixa de mensagem de cada campo (§4.2.1 do design system) |

## Entradas consumidas da URL

Já em uso; a feature preserva o comportamento e apenas garante lugar visível para o que
produzem (FR-017, FR-026, FR-027).

| Parâmetro | Valores | Efeito |
| --- | --- | --- |
| `redirecionar` | Caminho interno | Destino após autenticar; padrão `AREA_PADRAO` |
| `motivo` | `expirado` | Exibe o aviso de sessão encerrada por inatividade |
| `error` | `account_not_linked`, `email_not_found`, `unable_to_link_account`, ou qualquer outro | Exibe a recusa do provedor traduzida; código não mapeado cai na mensagem genérica |

## Esquema de validação

`login-form.tsx` já valida com Zod (`z.email`, senha com mínimo de 8 caracteres), em pt-BR via
`@/src/shared/validacao/zod-ptbr`. **Sem alteração** — o `Password` substitui a apresentação do
campo, não sua validação: continua registrado no mesmo formulário, sob o mesmo nome `senha`,
pelo mesmo resolver.

## Ativo estático pendente

Não é entidade de dados, mas é o único insumo que a feature ainda não tem no repositório.

| Caminho | Estado | Consumido por |
| --- | --- | --- |
| `public/login/fundo-login.jpg` | **Pendente** — ver D2 em `research.md` | `fundo-login.tsx`, via import estático |
| `public/login/PROCEDENCIA.md` | **Pendente** — exigido pela FR-006g | Ninguém em tempo de execução; é registro de licença |
| `public/sos-logo.png` | Já existe | `src/shared/ui/logo/logo.tsx` |
