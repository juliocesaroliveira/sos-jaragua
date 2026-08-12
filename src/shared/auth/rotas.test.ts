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
