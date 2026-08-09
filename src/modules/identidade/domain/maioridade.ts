/**
 * Regra de maioridade do voluntariado (BRD §3.1, DESIGN.md §10.1): só maiores
 * de 18 anos podem se candidatar.
 */
export const IDADE_MINIMA_VOLUNTARIO = 18

/**
 * Idade completa em anos na data de referência. `dataNascimento` aceita
 * `Date` ou `YYYY-MM-DD` (o formato da coluna `date` do Postgres).
 */
export function calcularIdade(dataNascimento: Date | string, referencia: Date = new Date()): number {
    const nascimento = paraData(dataNascimento)
    let idade = referencia.getFullYear() - nascimento.getFullYear()
    const mesesAntes = referencia.getMonth() - nascimento.getMonth()
    const aindaNaoFezAniversario = mesesAntes < 0 || (mesesAntes === 0 && referencia.getDate() < nascimento.getDate())
    if (aindaNaoFezAniversario) idade--
    return idade
}

export function ehMaiorDeIdade(dataNascimento: Date | string, referencia: Date = new Date()): boolean {
    return calcularIdade(dataNascimento, referencia) >= IDADE_MINIMA_VOLUNTARIO
}

/**
 * `YYYY-MM-DD` é interpretado como data **local**, não UTC — `new Date('2000-01-01')`
 * seria meia-noite UTC e cairia no dia anterior em fusos negativos como o do Brasil.
 */
function paraData(valor: Date | string): Date {
    if (valor instanceof Date) return valor
    const [ano, mes, dia] = valor.slice(0, 10).split('-').map(Number)
    return new Date(ano, (mes ?? 1) - 1, dia ?? 1)
}
