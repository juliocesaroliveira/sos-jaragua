/**
 * Base de entidade de domínio (DESIGN.md §5): identidade por `id`, não por
 * valor. Deliberadamente mínima — o domínio deste projeto é majoritariamente
 * regras puras sobre dados, não hierarquias de objetos.
 */
export abstract class Entity<TProps extends { id: string }> {
    protected readonly props: TProps

    protected constructor(props: TProps) {
        this.props = props
    }

    get id(): string {
        return this.props.id
    }

    equals(outra?: Entity<TProps>): boolean {
        if (!outra) return false
        if (this === outra) return true
        return this.id === outra.id
    }
}
