/**
 * Validação de CPF (DESIGN.md §10.1) — regra de domínio pura, sem dependência
 * de Next.js/Drizzle/Mongo.
 */

/** Remove tudo que não é dígito. */
export function normalizarCpf(valor: string): string {
    return valor.replace(/\D/g, '')
}

/** `123.456.789-09` a partir de 11 dígitos; devolve a entrada se não tiver 11. */
export function formatarCpf(valor: string): string {
    const digitos = normalizarCpf(valor)
    if (digitos.length !== 11) return valor
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`
}

/**
 * Verifica os dois dígitos verificadores. Sequências de dígitos repetidos
 * (`111.111.111-11`) passam no cálculo do DV mas não são CPFs válidos —
 * rejeitadas explicitamente.
 */
export function cpfEhValido(valor: string): boolean {
    const cpf = normalizarCpf(valor)
    if (cpf.length !== 11) return false
    if (/^(\d)\1{10}$/.test(cpf)) return false

    const digitoVerificador = (ateIndice: number): number => {
        let soma = 0
        let peso = ateIndice + 1
        for (let i = 0; i < ateIndice; i++) {
            soma += Number(cpf[i]) * peso
            peso--
        }
        const resto = (soma * 10) % 11
        return resto === 10 || resto === 11 ? 0 : resto
    }

    return digitoVerificador(9) === Number(cpf[9]) && digitoVerificador(10) === Number(cpf[10])
}
