import 'server-only'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { ROTULO_ROLE, ehRole } from '@/src/shared/auth/roles'
import { opcoesUsuarios } from '@/src/modules/identidade/presentation/queries/relatorios'
import {
    ACOES_AUDITADAS,
    ENTIDADES_AUDITADAS,
    ROTULO_ACAO_AUDITADA,
    ROTULO_ENTIDADE_AUDITADA,
    contarTrilhaAuditoria,
    trilhaAuditoria,
    type RegistroTrilha
} from '@/src/modules/auditoria/presentation/queries/trilha'
import { diferencaAuditoria, resumoAlteracoes } from '../../domain/diff-auditoria'
import { definirRelatorio, registrar, rotuloDaOpcao, type ConsultaRelatorio } from '../definicao-relatorio'
import { formatarDataHora } from '../formatacao'
import { enumOpcional, idOpcional, opcoesDe, resolverNomes } from './comum'

/**
 * Trilha de auditoria — R-17 (specs/023-central-relatorios, US4, FR-020 a
 * FR-023).
 *
 * Só o administrador chega aqui: a regra `/relatorios/auditoria` de
 * `REGRAS_DE_ROTA` barra o membro da Defesa Civil na página, na consulta e no
 * download (Clarification Q2). Os snapshots podem conter CPF e restrições de
 * saúde — aparecem completos (Clarification Q1), com o aviso de LGPD.
 */

/** Ator sem usuário autenticado (cron, seed) — `withAudit` grava `sistema`. */
const ATOR_SISTEMA = 'sistema'

type LinhaTrilha = RegistroTrilha & { autor: string | null }

type FiltrosR17 = {
    entidade?: (typeof ENTIDADES_AUDITADAS)[number]
    acao?: (typeof ACOES_AUDITADAS)[number]
    autorId?: string
}

function filtrosDaTrilha(c: ConsultaRelatorio<FiltrosR17>) {
    if (!c.intervalo) throw new Error('Trilha de auditoria consultada sem período.')
    return { intervalo: c.intervalo, entidade: c.filtros.entidade, acao: c.filtros.acao, userId: c.filtros.autorId }
}

function papel(userRole: string): string {
    if (userRole === ATOR_SISTEMA) return 'Sistema'
    return ehRole(userRole) ? ROTULO_ROLE[userRole] : userRole
}

function alteracoes(l: RegistroTrilha) {
    return diferencaAuditoria(l.acao, l.dadosAnteriores, l.dadosNovos)
}

const auditoria = definirRelatorio({
    slug: 'auditoria',
    camposFiltro: [
        {
            nome: 'entidade',
            rotulo: 'Assunto',
            tipo: 'select',
            opcoes: opcoesDe(ENTIDADES_AUDITADAS, ROTULO_ENTIDADE_AUDITADA)
        },
        { nome: 'acao', rotulo: 'Ação', tipo: 'select', opcoes: opcoesDe(ACOES_AUDITADAS, ROTULO_ACAO_AUDITADA) },
        { nome: 'autorId', rotulo: 'Autor', tipo: 'select' }
    ],
    esquemaFiltros: z.object({
        entidade: enumOpcional(ENTIDADES_AUDITADAS),
        acao: enumOpcional(ACOES_AUDITADAS),
        autorId: idOpcional
    }),
    colunas: [
        { cabecalho: 'Data/hora', valor: (l: LinhaTrilha) => formatarDataHora(l.timestamp), largura: 18 },
        { cabecalho: 'Assunto', valor: (l) => ROTULO_ENTIDADE_AUDITADA[l.entidade] ?? l.entidade, largura: 14 },
        { cabecalho: 'Tabela', valor: (l) => l.tabela ?? null, largura: 18 },
        { cabecalho: 'Registro', valor: (l) => l.entidadeId, largura: 38 },
        { cabecalho: 'Ação', valor: (l) => ROTULO_ACAO_AUDITADA[l.acao] ?? l.acao, largura: 12 },
        { cabecalho: 'Autor', valor: (l) => l.autor, largura: 28 },
        { cabecalho: 'Papel do autor', valor: (l) => papel(l.userRole), largura: 24 },
        { cabecalho: 'Alterações', valor: (l) => resumoAlteracoes(alteracoes(l)) || null, largura: 80 }
    ],
    contar: (c) => contarTrilhaAuditoria(filtrosDaTrilha(c)),
    async carregar(c, janela) {
        const registros = await trilhaAuditoria(filtrosDaTrilha(c), janela)
        const nome = await resolverNomes(registros, (r) => (r.userId === ATOR_SISTEMA ? null : r.userId))
        return registros.map((r) => ({ ...r, autor: r.userId === ATOR_SISTEMA ? 'Sistema' : nome(r) }))
    },
    detalhe: alteracoes,
    descreverFiltros: (f, o) => [
        ...(f.entidade ? [{ rotulo: 'Assunto', valor: ROTULO_ENTIDADE_AUDITADA[f.entidade] }] : []),
        ...(f.acao ? [{ rotulo: 'Ação', valor: ROTULO_ACAO_AUDITADA[f.acao] }] : []),
        ...(f.autorId ? [{ rotulo: 'Autor', valor: rotuloDaOpcao(o, 'autorId', f.autorId) }] : [])
    ],
    opcoesFiltros: async () => ({ autorId: await opcoesUsuarios() })
})

export const RELATORIOS_AUDITORIA = [registrar(auditoria)]
