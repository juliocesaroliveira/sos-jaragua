import { describe, expect, it } from 'vitest'
import { AREA_PADRAO, ROTA_PUBLICA, destinoDeRetorno, ehRotaPublica, podeAcessar, rolesExigidas } from './rotas'
import { ROLES } from './roles'

/** Classificação de rota — modelo deny-by-default (specs/001-unified-login-flow/contracts/routing-gate.md). */

describe('ehRotaPublica', () => {
    it('só /login é pública', () => {
        expect(ehRotaPublica('/login')).toBe(true)
    })

    it('rejeita toda outra rota, incluindo as que hoje eram públicas por omissão', () => {
        for (const pathname of [
            '/',
            '/voluntariado/candidatura',
            '/design-system',
            '/sem-permissao',
            '/dashboard',
            '/estoque',
            '/login-falso',
            '/loginx'
        ]) {
            expect(ehRotaPublica(pathname), pathname).toBe(false)
        }
    })
})

describe('rolesExigidas', () => {
    it('rotas sem entrada em REGRAS_DE_ROTA exigem apenas sessão válida (null)', () => {
        for (const pathname of ['/', '/voluntariado/candidatura', '/design-system', '/sem-permissao']) {
            expect(rolesExigidas(pathname), pathname).toBeNull()
        }
    })

    it('rotas de estoque restrito exigem coordenador ou administrador', () => {
        expect(rolesExigidas('/estoque/descarte')).toEqual(['coordenador', 'administrador'])
        expect(rolesExigidas('/estoque/kits')).toEqual(['coordenador', 'administrador'])
    })

    it('relatórios pertencem à Defesa Civil — coordenação não tem acesso', () => {
        expect(rolesExigidas('/relatorios')).toEqual(['membro_defesa_civil', 'administrador'])
    })

    it('a API de download de relatórios acompanha a tela', () => {
        // Se divergirem, ou a tela abre com os botões em 403, ou os dados ficam
        // alcançáveis por URL direta para quem já não pode abrir a tela.
        expect(rolesExigidas('/api/relatorios/export')).toEqual(rolesExigidas('/relatorios'))
    })

    it('o pacote de contingência acompanha a tela que o gera', () => {
        // Ele só é alcançável pela tela de relatórios; regras diferentes
        // deixariam ou um botão em 403, ou a permissão órfã para quem já não
        // abre a tela.
        expect(rolesExigidas('/api/contingencia/export')).toEqual(['membro_defesa_civil', 'administrador'])
        expect(rolesExigidas('/api/contingencia/export')).toEqual(rolesExigidas('/relatorios'))
    })

    it('variáveis da crise pertencem à Defesa Civil — coordenação não tem acesso', () => {
        // As Server Actions de `logistica.ts` derivam desta regra. Separá-las
        // deixaria a coordenação alterando os números da crise sem poder abrir
        // a tela — permissão de escrita sem tela é pior que nenhuma.
        expect(rolesExigidas('/crise')).toEqual(['membro_defesa_civil', 'administrador'])
    })

    it('coordenador não alcança crise, relatórios nem os downloads da tela', () => {
        for (const rota of ['/crise', '/relatorios', '/api/relatorios/export', '/api/contingencia/export']) {
            expect(podeAcessar(rota, 'coordenador'), rota).toBe(false)
        }
    })

    it('membro_defesa_civil e administrador alcançam crise, a tela e os dois downloads', () => {
        for (const role of ['membro_defesa_civil', 'administrador'] as const) {
            for (const rota of ['/crise', '/relatorios', '/api/relatorios/export', '/api/contingencia/export']) {
                expect(podeAcessar(rota, role), `${role} → ${rota}`).toBe(true)
            }
        }
    })

    it('o painel segue visível a toda a staff, mesmo a quem não edita a crise', () => {
        // `/dashboard` continua com STAFF: o coordenador acompanha os números,
        // só não os altera. É por isso que os atalhos para `/crise` no painel
        // são renderizados condicionalmente.
        for (const role of ['membro_defesa_civil', 'coordenador', 'administrador'] as const) {
            expect(podeAcessar('/dashboard', role), role).toBe(true)
        }
    })

    it('prefixo mais específico vence sobre o mais genérico', () => {
        expect(rolesExigidas('/estoque/entrada')).toEqual(['membro_defesa_civil', 'coordenador', 'administrador'])
        expect(rolesExigidas('/estoque/descarte')).toEqual(['coordenador', 'administrador'])
    })

    it('área do voluntário aceita voluntário e acima', () => {
        expect(rolesExigidas('/voluntariado/minhas-atividades')).toEqual([
            'voluntario',
            'membro_defesa_civil',
            'coordenador',
            'administrador'
        ])
    })
})

describe('podeAcessar', () => {
    it('qualquer role autenticada acessa rota sem exigência específica', () => {
        expect(podeAcessar('/', 'usuario')).toBe(true)
    })

    it('nega quando a role não está na lista exigida', () => {
        expect(podeAcessar('/estoque/descarte', 'membro_defesa_civil')).toBe(false)
        expect(podeAcessar('/estoque/descarte', undefined)).toBe(false)
    })

    it('permite quando a role está na lista exigida', () => {
        expect(podeAcessar('/estoque/descarte', 'coordenador')).toBe(true)
    })
})

describe('AREA_PADRAO — destino pós-login', () => {
    it('é a home', () => {
        expect(AREA_PADRAO).toBe('/')
    })

    /**
     * A trava que faltava. O destino padrão era `/dashboard`, rota de staff:
     * `usuario` e `voluntario` autenticavam e caíam em `/sem-permissao`.
     * `/sem-permissao` só deve aparecer para quem pede uma página sem ter
     * direito a ela — nunca como consequência de simplesmente entrar.
     */
    it('é alcançável por TODOS os papéis — nenhum cai em /sem-permissao ao entrar', () => {
        for (const role of ROLES) {
            expect(podeAcessar(AREA_PADRAO, role), `${role} não alcança ${AREA_PADRAO}`).toBe(true)
        }
    })

    it('não é uma rota restrita a algum papel', () => {
        expect(rolesExigidas(AREA_PADRAO)).toBeNull()
    })
})

describe('destinoDeRetorno — botão da página de endereço não encontrado', () => {
    /** Invariantes de specs/003-not-found-page/contracts/nao-encontrado.md. */

    it('INV-01 — com sessão, o destino é alcançável por TODOS os papéis', () => {
        // Trava de SC-004: um botão de saída que leva a /sem-permissao é pior
        // que não ter botão. É a mesma classe de defeito que a feature 002
        // corrigiu no login.
        const destino = destinoDeRetorno(true)
        for (const role of ROLES) {
            expect(podeAcessar(destino, role), `${role} não alcança ${destino}`).toBe(true)
        }
    })

    it('INV-02 — sem sessão, o destino dispensa sessão', () => {
        // Apontar para `/` funcionaria por acidente (o proxy redirigiria para
        // /login), com um salto a mais e dependendo do gate para corrigir.
        expect(ehRotaPublica(destinoDeRetorno(false))).toBe(true)
    })

    it('INV-03 — os dois destinos são distintos', () => {
        expect(destinoDeRetorno(true)).not.toBe(destinoDeRetorno(false))
    })

    it('reaproveita as constantes já estabelecidas, não literais soltos', () => {
        expect(destinoDeRetorno(true)).toBe(AREA_PADRAO)
        expect(destinoDeRetorno(false)).toBe(ROTA_PUBLICA)
    })
})
