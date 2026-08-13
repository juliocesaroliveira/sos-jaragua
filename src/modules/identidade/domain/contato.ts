/**
 * Validação de formato de e-mail e telefone (DESIGN.md §10.1).
 * Deliberadamente permissiva no e-mail (a verificação real é o envio) e
 * específica no telefone: o BRD trata o campo como WhatsApp brasileiro.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function emailEhValido(valor: string): boolean {
    return EMAIL_REGEX.test(valor.trim())
}

export function normalizarTelefone(valor: string): string {
    return valor.replace(/\D/g, '')
}

/**
 * Aceita 10 dígitos (fixo, DDD + 8) ou 11 (celular, DDD + 9 + 8). O nono
 * dígito de celular precisa ser `9`, e o DDD válido no Brasil vai de 11 a 99.
 */
export function telefoneEhValido(valor: string): boolean {
    const digitos = normalizarTelefone(valor)
    if (digitos.length !== 10 && digitos.length !== 11) return false
    const ddd = Number(digitos.slice(0, 2))
    if (ddd < 11 || ddd > 99) return false
    if (digitos.length === 11 && digitos[2] !== '9') return false
    return true
}

export function formatarTelefone(valor: string): string {
    const d = normalizarTelefone(valor)
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return valor
}

export function normalizarCep(valor: string): string {
    return valor.replace(/\D/g, '')
}

export function cepEhValido(valor: string): boolean {
    return normalizarCep(valor).length === 8
}

export function formatarCep(valor: string): string {
    const d = normalizarCep(valor)
    return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : valor
}
