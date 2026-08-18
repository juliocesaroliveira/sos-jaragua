'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import {
    Accordion,
    Alert,
    Avatar,
    Badge,
    Button,
    CheckboxGroup,
    Combobox,
    DatePicker,
    Dialog,
    Drawer,
    IconButton,
    Input,
    KanbanCard,
    KanbanColumn,
    Menu,
    NumberInput,
    Pagination,
    Password,
    Popover,
    Progress,
    ProgressCircle,
    RadioGroup,
    Select,
    Skeleton,
    StatCard,
    Switch,
    Table,
    Tabs,
    Textarea,
    Tooltip,
    avisar
} from '@/src/shared/ui'

/**
 * Galeria de validação do design system (DS-19). Serve para conferir cada
 * componente em claro/escuro e em duas larguras (~375px e ~1280px) antes de
 * integrá-lo a uma tela de negócio (DESIGN_SYSTEM.md §6, §7).
 */
type LinhaExemplo = { nome: string; categoria: string; saldo: number }

const LINHAS: LinhaExemplo[] = [
    { nome: 'Água mineral 1,5L', categoria: 'Água', saldo: 340 },
    { nome: 'Cesta básica', categoria: 'Alimentação', saldo: 58 },
    { nome: 'Cobertor casal', categoria: 'Acomodação', saldo: 12 }
]

const COLUNAS = [
    { accessorKey: 'nome', header: 'Item' },
    { accessorKey: 'categoria', header: 'Categoria' },
    { accessorKey: 'saldo', header: 'Saldo' }
]

export function Galeria() {
    const [pagina, setPagina] = useState(1)
    const [tamanhoPagina, setTamanhoPagina] = useState(10)
    const [dialogAberto, setDialogAberto] = useState(false)
    const [drawerAberto, setDrawerAberto] = useState(false)
    const [temVeiculo, setTemVeiculo] = useState(false)
    const [nascimento, setNascimento] = useState<string | undefined>()
    const [termo, setTermo] = useState('')

    const itensCombobox = ['Água mineral 1,5L', 'Água sanitária', 'Arroz 5kg', 'Cobertor casal']
        .filter((n) => n.toLowerCase().includes(termo.toLowerCase()))
        .map((n) => ({ value: n, label: n }))

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 p-4">
            <Secao titulo="Botões">
                <div className="flex flex-wrap items-center gap-3">
                    <Button variant="primary">Primário</Button>
                    <Button variant="secondary">Secundário</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="danger">Perigo</Button>
                    <Button loading>Salvando</Button>
                    <Button disabled>Desabilitado</Button>
                    <Button size="sm">Pequeno</Button>
                    <Button size="lg">Grande</Button>
                    <IconButton aria-label="Editar" icone={<Pencil aria-hidden className="size-5" />} />
                    <IconButton
                        aria-label="Excluir"
                        variant="danger"
                        icone={<Trash2 aria-hidden className="size-5" />}
                    />
                </div>
            </Secao>

            <Secao titulo="Campos de formulário">
                <div className="grid gap-4 md:grid-cols-2">
                    <Input id="g-nome" label="Nome completo" obrigatorio placeholder="Maria da Silva" />
                    <Input id="g-erro" label="CPF" erro="CPF inválido." defaultValue="123.456.789-00" />
                    {/*
                      Os quatro estados do Password (§4.2). O gatilho de
                      visibilidade precisa ser conferido **por teclado** aqui:
                      o Ark o entrega com `tabIndex: -1`, e o componente corrige
                      isso — se a correção se perder, o mouse continua
                      funcionando e a falha passa despercebida.
                    */}
                    <Password id="g-senha" label="Senha" autoComplete="new-password" obrigatorio />
                    <Password
                        id="g-senha-erro"
                        label="Senha"
                        autoComplete="new-password"
                        erro="A senha precisa ter ao menos 8 caracteres."
                    />
                    <Password
                        id="g-senha-apoio"
                        label="Nova senha"
                        autoComplete="new-password"
                        apoio="Mínimo de 8 caracteres."
                    />
                    <Password id="g-senha-off" label="Senha" autoComplete="current-password" disabled />
                    <Textarea id="g-obs" label="Restrições de saúde" apoio="Alergias, limitações físicas." />
                    <NumberInput id="g-qtd" label="Quantidade" defaultValue="10" min={0} />
                    <Select
                        id="g-cat"
                        label="Categoria do item"
                        obrigatorio
                        opcoes={[
                            { value: 'agua', label: 'Água' },
                            { value: 'alimentacao', label: 'Alimentação' },
                            { value: 'higiene', label: 'Higiene' }
                        ]}
                    />
                    <Combobox
                        id="g-item"
                        label="Nome do item"
                        apoio="Busca com debounce — evita cadastro duplicado."
                        opcoes={itensCombobox}
                        onBuscar={setTermo}
                    />
                    <DatePicker
                        id="g-nasc"
                        label="Data de nascimento"
                        value={nascimento}
                        onValueChange={setNascimento}
                    />
                    <div className="flex flex-col gap-4">
                        <Switch
                            id="g-veiculo"
                            label="Possui veículo próprio"
                            checked={temVeiculo}
                            onCheckedChange={setTemVeiculo}
                        />
                        <RadioGroup
                            id="g-tipo"
                            label="Tipo de veículo"
                            orientacao="horizontal"
                            opcoes={[
                                { value: 'carro', label: 'Carro' },
                                { value: 'moto', label: 'Moto' },
                                { value: 'barco', label: 'Barco' }
                            ]}
                        />
                    </div>
                    <CheckboxGroup
                        id="g-hab"
                        label="Habilidades"
                        opcoes={[
                            { value: '1', label: 'Motosserra' },
                            { value: '2', label: 'CNH D/E' },
                            { value: '3', label: 'Embarcação' },
                            { value: '4', label: 'Primeiros Socorros' }
                        ]}
                    />
                </div>
            </Secao>

            <Secao titulo="Sobreposições">
                <div className="flex flex-wrap gap-3">
                    <Button onClick={() => setDialogAberto(true)}>Abrir diálogo</Button>
                    <Button variant="secondary" onClick={() => setDrawerAberto(true)}>
                        Abrir gaveta
                    </Button>
                    <Button variant="secondary" onClick={() => avisar.sucesso('Saída registrada com sucesso')}>
                        Toast de sucesso
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => avisar.erro('Saída bloqueada', 'Faltam 12 unidades de Cobertor casal.')}
                    >
                        Toast de erro
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => avisar.atencao('Saldo baixo', 'Restam 3 unidades de Cesta básica em estoque.')}
                    >
                        Toast de atenção
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => avisar.info('Turno encerrado', 'A escala do turno da tarde foi fechada.')}
                    >
                        Toast de informação
                    </Button>
                    <Popover gatilho={<Button variant="secondary">Popover</Button>} titulo="Saldo do item">
                        <p className="text-sm text-neutral-600 dark:text-neutral-300">340 unidades disponíveis.</p>
                    </Popover>
                    <Menu
                        gatilho={<Button variant="secondary">Ações</Button>}
                        itens={[
                            { value: 'aprovar', label: 'Aprovar' },
                            { value: 'rejeitar', label: 'Rejeitar', destrutivo: true }
                        ]}
                    />
                </div>

                <Dialog
                    open={dialogAberto}
                    onOpenChange={setDialogAberto}
                    titulo="Rejeitar candidatura"
                    descricao="Esta ação notifica o candidato."
                    acoes={
                        <>
                            <Button variant="secondary" onClick={() => setDialogAberto(false)}>
                                Cancelar
                            </Button>
                            <Button variant="danger" onClick={() => setDialogAberto(false)}>
                                Rejeitar
                            </Button>
                        </>
                    }
                >
                    <Textarea id="g-motivo" label="Motivo da rejeição" obrigatorio />
                </Dialog>

                <Drawer open={drawerAberto} onOpenChange={setDrawerAberto} titulo="Filtros">
                    <Select
                        id="g-filtro"
                        label="Status"
                        opcoes={[
                            { value: 'pendente', label: 'Pendente' },
                            { value: 'aprovado', label: 'Aprovado' }
                        ]}
                    />
                </Drawer>
            </Secao>

            <Secao titulo="Tooltip">
                {/*
                  Vitrine do tooltip (015-tooltip-acoes-icone, US5). Aponte e
                  navegue por Tab: os dois meios de entrada abrem a dica, e Esc
                  a dispensa. Em toque, nenhuma delas aparece — por isso todo
                  gatilho aqui tem nome acessível próprio.
                */}
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Apoio visual para controles sem texto à vista. Nunca é o único meio de transmitir informação: não
                    existe apontar sem tocar em tela sensível ao toque.
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    A cobertura inclui os controles internos dos próprios primitivos — fechar diálogo, gaveta, popover e
                    aviso; setas de paginação; aumentar e diminuir do campo numérico; abrir calendário e navegar meses;
                    revelar senha; limpar seleção. Confira apontando os exemplos das outras seções desta página.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                    <Tooltip conteudo="Dica acima" posicao="top">
                        <IconButton aria-label="Dica acima" icone={<Pencil aria-hidden className="size-5" />} />
                    </Tooltip>
                    <Tooltip conteudo="Dica abaixo" posicao="bottom">
                        <IconButton aria-label="Dica abaixo" icone={<Pencil aria-hidden className="size-5" />} />
                    </Tooltip>
                    <Tooltip conteudo="Dica à esquerda" posicao="left">
                        <IconButton aria-label="Dica à esquerda" icone={<Pencil aria-hidden className="size-5" />} />
                    </Tooltip>
                    <Tooltip conteudo="Dica à direita" posicao="right">
                        <IconButton aria-label="Dica à direita" icone={<Pencil aria-hidden className="size-5" />} />
                    </Tooltip>
                </div>

                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    <strong className="font-semibold text-foreground">Repetição visual</strong> (padrão): a dica repete
                    na tela o nome que o controle já tem, e por isso não é anunciada de novo pelo leitor de tela.
                    <br />
                    <strong className="font-semibold text-foreground">Descrição</strong> (<code>descricao</code>): a
                    dica diz algo que o nome não diz — o motivo de a ação estar indisponível — e aí ser anunciada é o
                    objetivo.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                    <Tooltip conteudo="Remover componente">
                        <IconButton aria-label="Remover componente" icone={<Trash2 aria-hidden className="size-5" />} />
                    </Tooltip>
                    {/*
                      `inativo`, não `disabled`: um `<button disabled>` não
                      dispara evento de ponteiro nem recebe foco, então não teria
                      como explicar por que está indisponível. Aponte e alcance
                      por Tab — a dica aparece, e o clique não faz nada.
                    */}
                    <Tooltip conteudo="O kit precisa de ao menos um componente" descricao>
                        <IconButton
                            aria-label="Remover componente"
                            icone={<Trash2 aria-hidden className="size-5" />}
                            inativo
                            onClick={() =>
                                avisar.erro('Isto não deveria acontecer', 'O clique em `inativo` é ignorado.')
                            }
                        />
                    </Tooltip>
                </div>

                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Texto longo quebra em várias linhas dentro de uma largura máxima, e dentro de linha de tabela a dica
                    vira de lado sozinha quando não cabe.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                    <Tooltip conteudo="Remover João Pedro de Souza Albuquerque do turno da tarde">
                        <IconButton
                            aria-label="Remover João Pedro de Souza Albuquerque do turno da tarde"
                            icone={<Trash2 aria-hidden className="size-5" />}
                        />
                    </Tooltip>
                </div>

                <Table
                    titulo="Dica em linha de tabela"
                    colunas={[
                        ...COLUNAS,
                        {
                            id: 'acoes',
                            header: 'Ações',
                            cell: ({ row }: { row: { original: LinhaExemplo } }) => {
                                const rotulo = `Editar ${row.original.nome}`
                                return (
                                    <Tooltip conteudo={rotulo}>
                                        <IconButton
                                            aria-label={rotulo}
                                            icone={<Pencil aria-hidden className="size-5" />}
                                        />
                                    </Tooltip>
                                )
                            }
                        }
                    ]}
                    dados={LINHAS}
                />
            </Secao>

            <Secao titulo="Navegação">
                <Tabs
                    aria-label="Exemplo de abas"
                    abas={[
                        { value: 'inv', label: 'Inventário atual', conteudo: <p>Conteúdo do inventário.</p> },
                        { value: 'sai', label: 'Histórico de saídas', conteudo: <p>Conteúdo do histórico.</p> }
                    ]}
                />
                <Accordion
                    itens={[
                        { value: 't1', titulo: 'Turno 08:00 – 12:00', conteudo: <p>3 de 5 vagas preenchidas.</p> },
                        { value: 't2', titulo: 'Turno 12:00 – 16:00', conteudo: <p>5 de 5 vagas preenchidas.</p> }
                    ]}
                />
            </Secao>

            <Secao titulo="Exibição de dados">
                <div className="flex flex-wrap items-center gap-3">
                    <Avatar nome="Maria da Silva" />
                    <Badge cor="warning">Pendente</Badge>
                    <Badge cor="success">Aprovado</Badge>
                    <Badge cor="danger">Rejeitado</Badge>
                    <Badge cor="info">Aberta</Badge>
                    <Badge cor="primary">Kit</Badge>
                    <Badge cor="neutral">Avulso</Badge>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <StatCard label="Kits necessários" valor={1240} unidade="kits" apoio="620 famílias × 2" />
                    <StatCard
                        label="Kits possíveis"
                        valor={318}
                        unidade="kits"
                        tom="danger"
                        apoio="Limitado por Arroz 5kg"
                    >
                        <Progress label="Capacidade atendida" value={26} tom="danger" />
                    </StatCard>
                    <div className="flex items-center justify-center rounded-xl border border-border bg-surface p-4">
                        <ProgressCircle label="Cobertura" value={26} tom="warning" />
                    </div>
                </div>

                {/* Com `paginacao`, o rodapé (totais, página, registros por
                    página e navegação) vem junto do próprio Table. */}
                <Table
                    titulo="Itens em estoque"
                    colunas={COLUNAS}
                    dados={LINHAS}
                    paginacao={{
                        page: pagina,
                        pageSize: tamanhoPagina,
                        totalCount: 57,
                        onPageChange: setPagina,
                        onPageSizeChange: (tamanho) => {
                            setTamanhoPagina(tamanho)
                            setPagina(1)
                        }
                    }}
                />

                {/* Sem `paginacao`: o Table renderiza só a tabela. */}
                <Table titulo="Itens em estoque (sem rodapé)" colunas={COLUNAS} dados={LINHAS} />

                {/* O Pagination continua utilizável avulso, fora de uma tabela. */}
                <Pagination totalCount={57} pageSize={tamanhoPagina} page={pagina} onPageChange={setPagina} />

                <div className="flex flex-col gap-2">
                    <Skeleton altura="h-12" />
                    <Skeleton altura="h-12" largura="w-2/3" />
                </div>
            </Secao>

            <Secao titulo="Alertas">
                <Alert tom="info" titulo="Cadastros acumulados">
                    12 candidaturas aguardam triagem.
                </Alert>
                <Alert tom="warning" titulo="Estoque crítico">
                    Arroz 5kg abaixo do mínimo de segurança.
                </Alert>
                <Alert tom="danger" titulo="Déficit de atendimento">
                    A capacidade de montagem de kits está abaixo da demanda estimada.
                </Alert>
            </Secao>

            <Secao titulo="Kanban de turnos">
                <div className="flex flex-col gap-3 md:flex-row md:overflow-x-auto">
                    <KanbanColumn titulo="Separação de itens" subtitulo="Ginásio Arthur Müller" contagem="2 turnos">
                        <KanbanCard horario="08:00 – 12:00" preenchidas={3} vagas={5} />
                        <KanbanCard horario="12:00 – 16:00" preenchidas={5} vagas={5} />
                    </KanbanColumn>
                    <KanbanColumn titulo="Montagem de kits" subtitulo="Centro de operações" contagem="1 turno">
                        <KanbanCard horario="08:00 – 12:00" preenchidas={1} vagas={8} />
                    </KanbanColumn>
                </div>
            </Secao>
        </div>
    )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{titulo}</h2>
            {children}
        </section>
    )
}
