# Phase 1: Data Model & Domain Entities

**Feature**: Unified Button Icons and Cursor Feedback

---

## Button Component Model

### Core Entity: Button

The Button component is the primary entity for this feature. It is a React component that wraps the native HTML `<button>` element with styling and interactive affordances.

**Component Properties**:

```typescript
interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: VarianteBotao           // 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: TamanhoControle            // 'sm' | 'md' | 'lg'
  loading?: boolean                 // Shows loading spinner, disables button
  fullWidth?: boolean               // Expands to fill container width
  iconeInicio?: ReactNode          // Icon rendered on the left (NEW FEATURE FOCUS)
  iconeFim?: ReactNode             // Icon rendered on the right
  disabled?: boolean                // Disables button interactions
}
```

**States**:

| State | Condition | Cursor | Icon Display | Visual Treatment |
|-------|-----------|--------|--------------|-----------------|
| Enabled (default) | `disabled=false && loading=false` | `pointer` | Display `iconeInicio` + `iconeFim` | Full color, hover effects |
| Hover (enabled) | Enabled + mouse over | `pointer` | Icons visible | Background color shift |
| Focus (enabled) | Enabled + keyboard focus | `pointer` | Icons visible | Focus ring (ANEL_FOCO) |
| Loading | `loading=true` | `not-allowed` | Show spinner, hide `iconeInicio` | Opacity reduced, disabled |
| Disabled | `disabled=true` | `not-allowed` | Show `iconeInicio` + `iconeFim` | Opacity 50%, no hover effects |
| Active | Enabled + pressed | `pointer` | Icons visible | Active state styling |

**Relationships**:

- **Icon Source**: Button icons are sourced from `lucide-react` library
- **Styling System**: Uses Tailwind CSS v4 classes composed via `cn()` utility from `src/shared/ui/cn`
- **Layout**: Flex layout (`inline-flex`) with items center-aligned and justified

---

## Icon Mapping Model

### Entity: ButtonAction

Represents a semantic action that a button performs, mapped to a visual icon.

**Properties**:

```typescript
interface ButtonAction {
  id: string                          // e.g., 'create', 'delete', 'save'
  label: string                       // Human-readable action name (pt-BR)
  icon: LucideIcon                   // Icon component from lucide-react
  description: string                 // Context and usage guidelines
}
```

**Predefined Actions** (Reference from `research.md`):

| ID | Label (pt-BR) | Icon | Category | Usage |
|----|---------------|------|----------|-------|
| `create` | Criar | `Plus` | Content Management | "Criar Usuário", "Adicionar Item" |
| `edit` | Editar | `Pencil` | Content Management | "Editar Perfil", "Alterar" |
| `delete` | Deletar | `Trash2` | Content Management | "Remover", "Deletar" |
| `save` | Salvar | `Save` | Forms | "Salvar Alterações" |
| `submit` | Enviar | `Check` | Forms | "Enviar Formulário" |
| `cancel` | Cancelar | `X` | Forms | "Cancelar" |
| `download` | Baixar | `Download` | File Operations | "Exportar", "Baixar" |
| `upload` | Enviar | `Upload` | File Operations | "Importar", "Enviar Arquivo" |
| `print` | Imprimir | `Printer` | File Operations | "Imprimir" |
| `search` | Buscar | `Search` | Navigation | "Buscar" |
| `settings` | Configurações | `Settings` | Navigation | "Configurações" |
| `logout` | Sair | `LogOut` | Navigation | "Sair da Aplicação" |
| `menu` | Menu | `Menu` | Navigation | "Opções" |
| `refresh` | Atualizar | `RotateCcw` | Navigation | "Atualizar Dados" |
| `back` | Voltar | `ArrowLeft` | Navigation | "Voltar à Página Anterior" |
| `next` | Próximo | `ArrowRight` | Navigation | "Próximo Passo" |

---

## Cursor Feedback Model

### Entity: CursorState

Represents the cursor feedback provided by the button based on its interactive state.

**Properties**:

```typescript
type CursorState = 'pointer' | 'not-allowed' | 'default'

interface CursorFeedback {
  state: CursorState
  appliedBy: string              // CSS class, e.g., 'hover:cursor-pointer'
  triggeredBy: string            // Condition, e.g., 'hover on enabled button'
}
```

**Validation Rules**:

| Button State | Rule | CSS Classes | Exception |
|--------------|------|-------------|-----------|
| Enabled + hover | MUST show pointer cursor | `hover:cursor-pointer` | Touch devices may not show hover |
| Enabled + not hover | MUST revert to default cursor | (no special class) | — |
| Disabled + any | MUST NOT show pointer cursor | `disabled:cursor-not-allowed` | — |
| Loading | Treated as disabled state | `disabled:cursor-not-allowed` | — |

---

## Implementation Scope

### Components Affected

**Primary**:
- `src/shared/ui/button/button.tsx` - Modify className composition to add cursor utilities

**Secondary** (Audit & Icon Addition):
- All pages/modules that render Button components (estimated 50+ instances across 8+ pages)
- Each instance requires audit to determine appropriate `iconeInicio` icon

### No Data Persistence Required

- This feature does not involve database schema changes
- No new entities in domain layer
- No audit trail implications

### Testing Entities

**Unit Tests**:
- Button component rendering with/without icons
- Cursor state verification on hover (CSS class presence)
- Disabled state cursor behavior
- Icon positioning (left vs. right)

**Integration Tests** (if applicable):
- Visual regression testing across browsers
- Accessibility verification (keyboard navigation, screen reader compatibility)
