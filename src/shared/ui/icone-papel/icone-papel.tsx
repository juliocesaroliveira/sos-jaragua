'use client'

import { ClipboardCheck, Shield, ShieldCheck, type LucideIcon } from 'lucide-react'
import { ROTULO_ROLE, type Role } from '../../auth/roles'
import { Tooltip } from '../tooltip/tooltip'

/**
 * Ícone do papel interno ao lado do nome de quem está numa escala
 * (018-inscricao-atividades, FR-024/FR-025).
 *
 * Toda listagem de participantes de atividade usa este componente — é o que
 * mantém o mesmo ícone para o mesmo papel em qualquer tela. Voluntários e
 * usuários comuns não recebem ícone.
 */
const ICONE_POR_PAPEL: Partial<Record<Role, LucideIcon>> = {
    membro_defesa_civil: Shield,
    coordenador: ClipboardCheck,
    administrador: ShieldCheck
}

export function IconePapel({ role }: { role: Role }) {
    const Icone = ICONE_POR_PAPEL[role]
    if (!Icone) return null

    const rotulo = ROTULO_ROLE[role]
    return (
        <Tooltip conteudo={rotulo}>
            <span
                role="img"
                aria-label={rotulo}
                className="inline-flex shrink-0 text-primary-600 dark:text-primary-400"
            >
                <Icone aria-hidden className="size-4" />
            </span>
        </Tooltip>
    )
}
