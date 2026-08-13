import { describe, expect, it } from 'vitest'
import { areaPadraoPorRole, ehRotaPublica, podeAcessar, rolesExigidas } from './rotas'

/** Classificação de rota — modelo deny-by-default (specs/001-unified-login-flow/contracts/routing-gate.md). */

describe('ehRotaPublica', () => {
    it('só /login é pública', () => {
        expect(ehRotaPublica('/login')).toBe(true)
    })

    it('rejeita toda outra rota, incluindo as que hoje eram públicas por omissão', () => {
        for (const pathname of [
            '/',
            '/cadastro',
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
        for (const pathname of ['/', '/cadastro', '/voluntariado/candidatura', '/design-system', '/sem-permissao']) {
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

    it('coordenador não alcança relatórios nem os downloads da tela', () => {
        for (const rota of ['/relatorios', '/api/relatorios/export', '/api/contingencia/export']) {
            expect(podeAcessar(rota, 'coordenador'), rota).toBe(false)
        }
    })

    it('membro_defesa_civil e administrador alcançam a tela e os dois downloads', () => {
        for (const role of ['membro_defesa_civil', 'administrador'] as const) {
            for (const rota of ['/relatorios', '/api/relatorios/export', '/api/contingencia/export']) {
                expect(podeAcessar(rota, role), `${role} → ${rota}`).toBe(true)
            }
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
        expect(podeAcessar('/cadastro', 'voluntario')).toBe(true)
    })

    it('nega quando a role não está na lista exigida', () => {
        expect(podeAcessar('/estoque/descarte', 'membro_defesa_civil')).toBe(false)
        expect(podeAcessar('/estoque/descarte', undefined)).toBe(false)
    })

    it('permite quando a role está na lista exigida', () => {
        expect(podeAcessar('/estoque/descarte', 'coordenador')).toBe(true)
    })
})

describe('areaPadraoPorRole', () => {
    it('staff vai para o dashboard', () => {
        expect(areaPadraoPorRole('coordenador')).toBe('/dashboard')
        expect(areaPadraoPorRole('membro_defesa_civil')).toBe('/dashboard')
        expect(areaPadraoPorRole('administrador')).toBe('/dashboard')
    })

    it('voluntário vai para minhas-atividades', () => {
        expect(areaPadraoPorRole('voluntario')).toBe('/voluntariado/minhas-atividades')
    })

    it('usuário comum vai para a candidatura', () => {
        expect(areaPadraoPorRole('usuario')).toBe('/voluntariado/candidatura')
    })
})
