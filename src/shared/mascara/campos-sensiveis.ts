import type { Role } from '@/src/shared/auth/roles'
import { mascararCep, mascararCpf, mascararData } from './index'

/**
 * Fonte **única** de verdade sobre quais campos são sensíveis, como cada um é
 * mascarado e quem pode ver seu valor completo (feature 025, decisões Q1 e Q2).
 *
 * Existe um módulo só para isso porque três consumidores precisam concordar:
 * a apresentação (FR-012), a exportação de relatórios (FR-018) e a redação da
 * trilha de auditoria (FR-026). Se cada um mantivesse sua própria lista, bastaria
 * um esquecimento para um campo voltar a aparecer em claro em uma das pontas.
 */

/** Os três campos classificados em Q1. A ordem é a da spec. */
export const CAMPOS_SENSIVEIS = ['cpf', 'dataNascimento', 'cep'] as const

export type CampoSensivel = (typeof CAMPOS_SENSIVEIS)[number]

/**
 * Matriz de Visibilidade (Q2) — quem vê o valor completo, campo a campo.
 *
 * `coordenador` precisa do CPF para conferir documento na triagem de candidatura;
 * `membro_defesa_civil` precisa do CEP para logística de atendimento, e só dele.
 * O titular é tratado fora desta tabela, em `campoVisivelPara`.
 */
const VISIBILIDADE: Record<CampoSensivel, readonly Role[]> = {
    cpf: ['coordenador', 'administrador'],
    dataNascimento: ['coordenador', 'administrador'],
    cep: ['membro_defesa_civil', 'coordenador', 'administrador']
}

/** Máscara de cada campo, para que a apresentação não precise escolher. */
export const MASCARA_DO_CAMPO: Record<CampoSensivel, (valor: string) => string> = {
    cpf: mascararCpf,
    dataNascimento: mascararData,
    cep: mascararCep
}

/** Rótulos pt-BR — usados na UI e no registro de auditoria da revelação. */
export const ROTULO_CAMPO_SENSIVEL: Record<CampoSensivel, string> = {
    cpf: 'CPF',
    dataNascimento: 'Data de nascimento',
    cep: 'CEP'
}

export function ehCampoSensivel(valor: unknown): valor is CampoSensivel {
    return typeof valor === 'string' && (CAMPOS_SENSIVEIS as readonly string[]).includes(valor)
}

/**
 * Única leitura autorizada da Matriz de Visibilidade.
 *
 * **Nunca** deve ser chamada dentro de escopo `'use cache'`: a role vem da
 * sessão, e `'use cache'` não admite `cookies()`/`headers()` no Next 16 — além
 * de que a entrada de cache de uma role serviria a outra (research.md D4).
 *
 * `ehTitular` vem antes da matriz porque o direito de acesso do titular aos
 * próprios dados (LGPD art. 18, II) não depende da role que ele tem.
 */
export function campoVisivelPara(campo: CampoSensivel, role: Role | undefined, ehTitular: boolean): boolean {
    if (ehTitular) return true
    if (!role) return false

    return VISIBILIDADE[campo].includes(role)
}
