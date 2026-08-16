# Quickstart — Validação da feature 012

**Feature**: `012-notificacoes-tempo-real`

Roteiro para provar que a feature funciona ponta a ponta. Sem código de implementação — os
contratos estão em [contracts/](./contracts/) e as regras em [data-model.md](./data-model.md).

## Pré-requisitos

- `.env.local` com `DATABASE_URL` e `BETTER_AUTH_SECRET` — o mesmo ambiente já usado pelo resto
  do projeto. **Nenhuma variável nova**, nenhum serviço novo, nenhuma migração.
- Duas contas de teste, ou uma conta com perfil de coordenação para disparar broadcast.
- Dois navegadores (ou um normal e um anônimo) para simular duas sessões simultâneas.
- Ferramentas de desenvolvedor abertas na aba Rede — várias validações abaixo se verificam
  **pela ausência de requisições**, não por algo visível na tela.

## Setup

```bash
npm install
npm run dev
```

Não há passo de banco. Se você acabou de vir da feature 011, confirme que a migração dela já foi
aplicada; esta feature não adiciona nenhuma.

## Testes automatizados

```bash
npm test                # inclui a política de intervalo (função pura)
npm run test:integracao
npm run lint
```

Cobertura esperada, alinhada ao Princípio III (esta feature não adiciona regra de negócio em
`domain`/`application`, então o foco é contrato e casos de erro):

- **Política de intervalo** (`refetchInterval`): sem falhas → 30s; falhas consecutivas →
  intervalo crescente até o teto; após `401` → `false`; após sucesso → volta a 30s.
- **Contrato do Route Handler**: sem sessão → `401` sem corpo; com sessão → só notificações do
  próprio usuário; `naoLidas` contando além das 30 listadas.

## Validações manuais

### V1 — O aviso chega sozinho (FR-001, FR-002, SC-001)

1. Navegador A: entre com o usuário 1 e **fique parado** numa tela qualquer.
2. Navegador B: entre com um coordenador e dispare um broadcast que alcance o usuário 1.
3. No navegador A, **não toque em nada** e observe o sino.

**Esperado**: em até 30 segundos o contador aumenta e o item aparece na lista, sem recarregar.

### V2 — Chega com o painel aberto (FR-003)

Repita V1 com o `Drawer` do sino **aberto** no navegador A, rolado até o meio da lista.

**Esperado**: o item novo entra no topo; o painel não fecha e a posição de rolagem não muda.

### V3 — Nada vaza para quem não é destinatário (FR-005, SC-003)

Com duas sessões de usuários diferentes abertas, gere uma notificação para apenas um.

**Esperado**: só a tela do destinatário muda. Confirme também no endpoint: abrir
`/api/notificacoes` numa aba autenticada devolve apenas as notificações daquela sessão, e **não
existe** parâmetro algum que permita pedir as de outro usuário.

### V4 — Aba oculta não consulta (FR-007, SC-004)

1. Deixe a aba do sistema aberta com a aba Rede visível, filtrando por `notificacoes`.
2. Mude para outra **aba** do navegador (não outra janela) e espere 2 minutos.
3. Volte.

**Esperado**: **nenhuma** requisição durante os 2 minutos, e **uma** requisição imediata ao
voltar. Este é o teste que prova a economia de bateria e dados em campo.

**Falha esperada se algo estiver errado**: requisições continuando em segundo plano significam
que `refetchIntervalInBackground` foi definido como `true` em algum lugar — o padrão `false` é
que faz isso funcionar.

### V5 — Volta ao foco é imediata (FR-004, SC-002)

Com a aba oculta, gere uma notificação para o usuário. Volte à aba.

**Esperado**: o estado fica correto em menos de 2 segundos, sem esperar o ciclo de 30s.

### V6 — Marcar como lida não é desfeito (FR-016)

O teste mais sutil do roteiro. Marque uma notificação como lida **no instante** em que um ciclo
periódico está em voo — repita algumas vezes perto do fim de um intervalo de 30s para pegar a
sobreposição.

**Esperado**: o item permanece lido. Se ele voltar a aparecer como não-lido por um instante, o
`cancelQueries` do passo 1 da sequência de mutação está faltando.

### V7 — Duas abas convergem (FR-006, SC-006)

Mesma conta em duas abas **visíveis** (duas janelas lado a lado). Marque uma notificação como
lida em uma delas.

**Esperado**: a aba onde a ação ocorreu atualiza na hora; a outra converge em até 30 segundos.

### V8 — Sem rede, sem erro e sem martelar (FR-009, FR-013, SC-005)

1. Desligue a rede pelas ferramentas de desenvolvedor (modo offline).
2. Observe a aba Rede por alguns minutos.
3. Religue.

**Esperado**: nenhum erro visível na interface; as tentativas se **espaçam** progressivamente em
vez de manterem o ritmo de 30s; ao religar, o estado volta a bater com o banco. Todos os fluxos
do sistema continuam executáveis durante o período offline.

### V9 — Fim de sessão encerra o ciclo (FR-010, R3)

1. Com a aba aberta e consultando, faça logout em outra aba (ou desative a conta pelo `/admin`).
2. Observe a aba Rede da primeira aba.

**Esperado**: a primeira requisição seguinte devolve `401` e **nenhuma nova requisição é
agendada**. Uma aba que continua batendo em `401` a cada 30 segundos indefinidamente é falha.

### V10 — Nada duplica ao longo do tempo (FR-014, SC-007)

Deixe a aba aberta e visível por cerca de uma hora, gerando notificações esporádicas.

**Esperado**: nenhuma entrada repetida na lista, nenhum contador inflado. A substituição integral
do cache a cada ciclo (R1) é o que garante isso — não há código de deduplicação a inspecionar.

### V11 — Rajada não trava (FR-015, SC-008)

Dispare um broadcast para o maior conjunto de voluntários aprovados disponível no ambiente.

**Esperado**: a lista absorve o volume, a interface continua responsiva, e as telas de operação
de campo mantêm o tempo de resposta habitual.

## Checklist de conclusão

- [ ] `npm test`, `npm run test:integracao` e `npm run lint` verdes
- [ ] V1–V11 conferidos manualmente
- [ ] Aba Rede confirma zero requisições com a aba oculta (V4)
- [ ] Nenhuma dependência adicionada ao `package.json`
- [ ] Nenhuma migração em `db/migrations/`
- [ ] `router.refresh()` removido do fluxo de marcar como lida
- [ ] Nenhum listener próprio de `visibilitychange` no código
- [ ] Interface 100% pt-BR, textos e rótulos de evento inalterados
