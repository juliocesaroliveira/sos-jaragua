import { podeAcessar } from '@/src/shared/auth/rotas'
import type { Role } from '@/src/shared/auth/roles'

/**
 * Catálogo da central de relatórios (specs/023-central-relatorios,
 * data-model.md §1).
 *
 * Estrutura de dados pura — o que **é** cada relatório, não como ele lê os
 * dados. As consultas e colunas ficam nas definições de `application/`; este
 * arquivo é o que o catálogo, a navegação e os testes de acesso enxergam.
 *
 * **A autorização de um relatório é a regra de rota da sua página**
 * (research D3): `rota` é a chave que a página, a Server Action e o download
 * passam a `podeAcessar`. Não existe uma segunda lista de perfis por relatório
 * que possa divergir de `REGRAS_DE_ROTA`.
 */

export const SLUGS_RELATORIO = [
    'inventario',
    'saidas',
    'entradas',
    'descartes',
    'estoque-critico',
    'validades',
    'movimentacao',
    'entregas-por-destino',
    'voluntarios',
    'triagem',
    'capacidade-habilidades',
    'ocupacao-turnos',
    'participacao',
    'evolucao-crise',
    'demanda-kits',
    'notificacoes',
    'auditoria'
] as const

export type SlugRelatorio = (typeof SLUGS_RELATORIO)[number]

export type IdGrupoRelatorio = 'estoque' | 'voluntariado' | 'crise' | 'comunicacao' | 'auditoria'

export type GrupoRelatorio = { readonly id: IdGrupoRelatorio; readonly rotulo: string; readonly ordem: number }

export const GRUPOS_RELATORIO: Readonly<Record<IdGrupoRelatorio, GrupoRelatorio>> = {
    estoque: { id: 'estoque', rotulo: 'Estoque', ordem: 0 },
    voluntariado: { id: 'voluntariado', rotulo: 'Voluntariado', ordem: 1 },
    crise: { id: 'crise', rotulo: 'Crise', ordem: 2 },
    comunicacao: { id: 'comunicacao', rotulo: 'Comunicação', ordem: 3 },
    auditoria: { id: 'auditoria', rotulo: 'Auditoria', ordem: 4 }
}

export type DescricaoRelatorio = {
    readonly slug: SlugRelatorio
    readonly nome: string
    readonly grupo: IdGrupoRelatorio
    /** A pergunta que o relatório responde, em uma frase (FR-003). */
    readonly pergunta: string
    /** `/relatorios/<slug>` — fonte da autorização (research D3). */
    readonly rota: string
    /** Habilita o filtro de período (FR-005). */
    readonly usaPeriodo: boolean
    /** Exibe o aviso de LGPD junto da exportação (FR-014, research D10). */
    readonly contemDadosSensiveis: boolean
    /** Ressalvas exibidas acima da prévia, para não ler o relatório errado. */
    readonly avisos: readonly string[]
}

/** Campo do formulário de filtros — gerado a partir da definição do relatório. */
export type CampoFiltro = {
    readonly nome: string
    readonly rotulo: string
    readonly tipo: 'select' | 'texto' | 'numero' | 'booleano'
    /** Opções fixas; as dinâmicas (habilidades, autores…) vêm de `opcoesFiltros`. */
    readonly opcoes?: readonly OpcaoFiltro[]
    readonly apoio?: string
    readonly placeholder?: string
    readonly min?: number
    readonly max?: number
}

export type OpcaoFiltro = { readonly valor: string; readonly rotulo: string }

type SemRota = Omit<DescricaoRelatorio, 'slug' | 'rota' | 'avisos' | 'usaPeriodo' | 'contemDadosSensiveis'> &
    Partial<Pick<DescricaoRelatorio, 'avisos' | 'usaPeriodo' | 'contemDadosSensiveis'>>

const AVISO_DESCARTES = 'Descartes não entram neste relatório: ele mostra só o que foi entregue à população.'

const DECLARACOES: Record<SlugRelatorio, SemRota> = {
    inventario: {
        nome: 'Inventário atual',
        grupo: 'estoque',
        pergunta: 'O que temos agora, e o que está abaixo do mínimo?'
    },
    saidas: {
        nome: 'Histórico de saídas',
        grupo: 'estoque',
        pergunta: 'O que foi entregue à população, quando e para onde?',
        usaPeriodo: true,
        avisos: [AVISO_DESCARTES]
    },
    entradas: {
        nome: 'Doações recebidas',
        grupo: 'estoque',
        pergunta: 'O que entrou, em que condição, com que validade e registrado por quem?',
        usaPeriodo: true
    },
    descartes: {
        nome: 'Descartes',
        grupo: 'estoque',
        pergunta: 'O que foi baixado sem chegar à população, e por quê?',
        usaPeriodo: true
    },
    'estoque-critico': {
        nome: 'Estoque crítico',
        grupo: 'estoque',
        pergunta: 'Quais itens estão no mínimo ou abaixo dele?',
        avisos: ['Itens com estoque mínimo 0 têm o alerta desligado e não aparecem aqui.']
    },
    validades: {
        nome: 'Validades',
        grupo: 'estoque',
        pergunta: 'Que doações perecíveis venceram ou vão vencer em breve?',
        avisos: ['A validade é da doação recebida e não garante que essa quantidade ainda esteja no estoque.']
    },
    movimentacao: {
        nome: 'Movimentação por item',
        grupo: 'estoque',
        pergunta: 'Qual o saldo inicial, as entradas, saídas, descartes e o saldo final de cada item no período?',
        usaPeriodo: true
    },
    'entregas-por-destino': {
        nome: 'Entregas por destino',
        grupo: 'estoque',
        pergunta: 'Quanto cada bairro ou abrigo recebeu, por categoria?',
        usaPeriodo: true,
        avisos: ['Destinos que diferem só em maiúsculas, minúsculas ou espaços são somados juntos.', AVISO_DESCARTES]
    },
    voluntarios: {
        nome: 'Voluntários cadastrados',
        grupo: 'voluntariado',
        pergunta: 'Quem são, onde moram, o que sabem fazer e com que veículo?',
        contemDadosSensiveis: true
    },
    triagem: {
        nome: 'Triagem de candidaturas',
        grupo: 'voluntariado',
        pergunta: 'Quantas candidaturas chegaram, quantas foram decididas e quanto tempo levou?',
        usaPeriodo: true,
        avisos: [
            'Um reenvio substitui a candidatura anterior: o relatório mostra a situação atual; o histórico de decisões está na trilha de auditoria.'
        ]
    },
    'capacidade-habilidades': {
        nome: 'Capacidade por habilidade',
        grupo: 'voluntariado',
        pergunta: 'Quantos voluntários aprovados há por habilidade, veículo e disponibilidade?'
    },
    'ocupacao-turnos': {
        nome: 'Ocupação de turnos',
        grupo: 'voluntariado',
        pergunta: 'Que turnos estão cheios e quais ainda precisam de gente?',
        usaPeriodo: true,
        avisos: ['Considera os turnos que começam no período. Inscrições canceladas não contam como confirmadas.']
    },
    participacao: {
        nome: 'Participação por pessoa',
        grupo: 'voluntariado',
        pergunta: 'Quantos turnos e horas cada pessoa teve escalados no período?',
        usaPeriodo: true,
        contemDadosSensiveis: true,
        avisos: ['Horas escaladas não confirmam presença: o sistema registra quem foi escalado, não quem compareceu.']
    },
    'evolucao-crise': {
        nome: 'Evolução da crise',
        grupo: 'crise',
        pergunta: 'Como o número de famílias e pessoas afetadas mudou ao longo do tempo?',
        usaPeriodo: true
    },
    'demanda-kits': {
        nome: 'Demanda × capacidade de kits',
        grupo: 'crise',
        pergunta: 'Quantos kits a crise exige e quantos o estoque atual permite montar?',
        avisos: ['Mesmo cálculo do Painel, com o saldo deste momento.']
    },
    notificacoes: {
        nome: 'Envio de notificações',
        grupo: 'comunicacao',
        pergunta: 'As mensagens chegaram? Quais falharam e por quê?',
        usaPeriodo: true
    },
    auditoria: {
        nome: 'Trilha de auditoria',
        grupo: 'auditoria',
        pergunta: 'Quem alterou o quê, quando, e qual era o valor antes?',
        usaPeriodo: true,
        contemDadosSensiveis: true
    }
}

export const DESCRICOES_RELATORIO: Readonly<Record<SlugRelatorio, DescricaoRelatorio>> = Object.fromEntries(
    SLUGS_RELATORIO.map((slug) => {
        const declaracao = DECLARACOES[slug]
        const descricao: DescricaoRelatorio = {
            slug,
            rota: `/relatorios/${slug}`,
            usaPeriodo: false,
            contemDadosSensiveis: false,
            avisos: [],
            ...declaracao
        }
        return [slug, descricao]
    })
) as Record<SlugRelatorio, DescricaoRelatorio>

export function ehSlugRelatorio(valor: unknown): valor is SlugRelatorio {
    return typeof valor === 'string' && (SLUGS_RELATORIO as readonly string[]).includes(valor)
}

/**
 * Relatórios que o perfil pode abrir, na ordem do catálogo, restritos aos
 * `disponiveis` — os que têm definição registrada. Um relatório catalogado mas
 * ainda não implementado não aparece: um card que leva a 404 é pior que nenhum.
 */
export function relatoriosVisiveis(role: Role, disponiveis: readonly SlugRelatorio[]): DescricaoRelatorio[] {
    return SLUGS_RELATORIO.filter((slug) => disponiveis.includes(slug))
        .map((slug) => DESCRICOES_RELATORIO[slug])
        .filter((descricao) => podeAcessar(descricao.rota, role))
}

export type SecaoCatalogo = { grupo: GrupoRelatorio; relatorios: DescricaoRelatorio[] }

/**
 * Agrupa os relatórios visíveis. Derivado da lista já filtrada — grupo sem
 * relatório sobrevivente nunca é criado (mesma regra de `gruposVisiveis` da
 * navegação). É assim que "Auditoria" some para o membro da Defesa Civil.
 */
export function gruposVisiveisRelatorios(role: Role, disponiveis: readonly SlugRelatorio[]): SecaoCatalogo[] {
    const porGrupo = new Map<IdGrupoRelatorio, DescricaoRelatorio[]>()
    for (const descricao of relatoriosVisiveis(role, disponiveis)) {
        const lista = porGrupo.get(descricao.grupo)
        if (lista) lista.push(descricao)
        else porGrupo.set(descricao.grupo, [descricao])
    }
    return [...porGrupo.entries()]
        .map(([id, relatorios]) => ({ grupo: GRUPOS_RELATORIO[id], relatorios }))
        .sort((a, b) => a.grupo.ordem - b.grupo.ordem)
}
