# Phase 0: Research & Clarifications

**Completed**: 2026-08-13

**Feature**: Unified Button Icons and Cursor Feedback

---

## Clarification 1: Icon Library Source

**Question from Technical Context**: Which icon library should supply button action icons?

**Research Finding**: Lucide React is already integrated and in active use throughout the project.

**Decision**: Use Lucide React for all new button icons.

**Rationale**:

- The project already imports from `lucide-react` (confirmed in `src/shared/ui/button/button.tsx` line 1)
- Lucide provides comprehensive semantic icons for common actions (Create, Edit, Delete, Save, Cancel, Submit, etc.)
- Zero additional dependencies needed
- Consistent with existing codebase conventions

**Alternatives Considered**:

- Phosphor Icons: Not currently integrated; would add new dependency
- Custom SVG icons: Would require icon file management; Lucide already solved this

**Implementation Impact**: All button icons will be sourced from `lucide-react` via the `iconeInicio` prop on the Button component.

---

## Clarification 2: Cursor Feedback Implementation

**Question from Specification**: How should pointer cursor be applied to buttons?

**Research Finding**: Tailwind CSS v4 (already in use) provides cursor utilities.

**Decision**: Apply `hover:cursor-pointer` class to enabled buttons; maintain `disabled:cursor-not-allowed` for disabled state.

**Rationale**:

- Tailwind CSS provides native cursor utilities (`cursor-pointer`, `cursor-not-allowed`)
- Already present in button component file (`cn` utility supports class composition)
- No additional dependencies
- Accessible and semantic

**Implementation Impact**: Modify the className composition in `src/shared/ui/button/button.tsx` to add cursor utilities via Tailwind.

---

## Button Action → Icon Mapping Reference

For implementation phase, the following action-to-icon mappings should be used (all from `lucide-react`):

| Action            | Icon                     | Usage Example                     |
| ----------------- | ------------------------ | --------------------------------- |
| Create / Add      | `Plus`                   | "Criar Usuário", "Adicionar Item" |
| Edit / Modify     | `Pencil`                 | "Editar Perfil", "Alterar"        |
| Delete / Remove   | `Trash2`                 | "Remover", "Deletar"              |
| Save / Submit     | `Save` or `Check`        | "Salvar", "Enviar Formulário"     |
| Cancel / Close    | `X` or `XCircle`         | "Cancelar", "Fechar"              |
| Download / Export | `Download`               | "Exportar", "Baixar"              |
| Upload / Import   | `Upload`                 | "Importar", "Enviar Arquivo"      |
| Print             | `Printer`                | "Imprimir"                        |
| Search            | `Search`                 | "Buscar"                          |
| Settings          | `Settings`               | "Configurações"                   |
| Logout            | `LogOut`                 | "Sair"                            |
| Menu / Options    | `Menu` or `MoreVertical` | "Opções", "Mais"                  |
| Refresh / Reload  | `RotateCcw`              | "Atualizar"                       |
| Back / Return     | `ArrowLeft`              | "Voltar"                          |
| Next / Forward    | `ArrowRight`             | "Próximo"                         |

This reference ensures consistent visual language across the application and guides developers when adding new buttons.
