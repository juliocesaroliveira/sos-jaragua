import { describe, expect, it } from 'vitest'
import { apresentar, mascararCep, mascararCpf, mascararData } from './index'

describe('mascararCpf', () => {
    it('preserva os 2 primeiros e os 2 últimos dígitos (FR-010)', () => {
        expect(mascararCpf('12345678901')).toBe('12•••••••01')
    })

    it('normaliza entrada formatada antes de mascarar', () => {
        expect(mascararCpf('123.456.789-01')).toBe('12•••••••01')
    })
})

describe('mascararCep', () => {
    it('preserva os 2 primeiros e os 2 últimos dígitos (FR-010)', () => {
        expect(mascararCep('89250000')).toBe('89••••00')
    })

    it('normaliza entrada formatada', () => {
        expect(mascararCep('89250-000')).toBe('89••••00')
    })
})

describe('mascararData', () => {
    it('oculta dia e mês e mantém o ano legível (FR-011)', () => {
        expect(mascararData('1990-03-15')).toBe('••/••/1990')
    })

    it('devolve inteiramente mascarado quando a data não tem o formato esperado', () => {
        expect(mascararData('1990')).toBe('••/••/••••')
        expect(mascararData('qualquer-coisa')).toBe('••/••/••••')
    })
})

describe('regra de exposição mínima (FR-010)', () => {
    it('mascara por inteiro valores com 5 caracteres ou menos — 2+2 revelaria quase tudo', () => {
        expect(mascararCpf('1234')).toBe('••••')
        expect(mascararCpf('12345')).toBe('•••••')
        expect(mascararCep('1234')).toBe('••••')
    })

    it('a partir de 6 caracteres aplica a regra 2+2', () => {
        expect(mascararCpf('123456')).toBe('12••56')
    })

    it('não revela nenhum caractere original no caso curto', () => {
        expect(mascararCpf('1234')).not.toMatch(/\d/)
    })
})

describe('apresentar', () => {
    it('devolve estado "ausente" para nulo, indefinido ou vazio (FR-013)', () => {
        expect(apresentar(null, mascararCpf)).toEqual({ estado: 'ausente' })
        expect(apresentar(undefined, mascararCpf)).toEqual({ estado: 'ausente' })
        expect(apresentar('', mascararCpf)).toEqual({ estado: 'ausente' })
    })

    it('devolve estado "mascarado" com a exibição quando há valor', () => {
        expect(apresentar('12345678901', mascararCpf)).toEqual({
            estado: 'mascarado',
            exibicao: '12•••••••01'
        })
    })

    it('nunca devolve o valor completo na forma de apresentação (INV-04)', () => {
        const r = apresentar('12345678901', mascararCpf)
        expect(JSON.stringify(r)).not.toContain('12345678901')
    })
})
