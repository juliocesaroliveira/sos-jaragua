# Button Component Contract

**Feature**: Unified Button Icons and Cursor Feedback

**Component Path**: `src/shared/ui/button/button.tsx`

**Status**: Design specification (pre-implementation)

---

## Component Public API

### TypeScript Interface

```typescript
interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
    /**
     * Button visual style variant
     * @default 'primary'
     */
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'

    /**
     * Button size (sm only in dense desktop contexts; never as sole action on mobile)
     * @default 'md'
     */
    size?: 'sm' | 'md' | 'lg'

    /**
     * Shows loading spinner; disables interaction
     * @default false
     */
    loading?: boolean

    /**
     * Expands button to fill container width (default primary action on mobile)
     * @default false
     */
    fullWidth?: boolean

    /**
     * Icon rendered on the left side of button text (FEATURE: icons are left-positioned)
     * Supported source: lucide-react icons
     * @example <Plus /> from 'lucide-react'
     * @optional
     */
    iconeInicio?: ReactNode

    /**
     * Icon rendered on the right side of button text
     * Supported source: lucide-react icons
     * @optional
     */
    iconeFim?: ReactNode

    /**
     * Disables all interactions; shows not-allowed cursor
     * @default false
     */
    disabled?: boolean
}
```

### Component Output

**Render Target**: Native HTML `<button>` element with composed Tailwind CSS classes

**Props Passed to Native Button**:

- All HTMLButtonElement attributes except `className` (composed internally)
- `type` defaults to `'button'` if not specified
- `disabled` attribute set based on `disabled` or `loading` props

---

## Styling Contract

### CSS Classes Applied

**Base Classes** (always applied):

```
inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors
```

**Variant Classes** (one of):

```
primary: 'bg-primary-600 dark:bg-primary-500 text-primary-foreground hover:bg-primary-700 dark:hover:bg-primary-600'
secondary: 'bg-surface text-foreground border border-border hover:bg-surface-muted'
ghost: 'text-foreground hover:bg-surface-muted'
danger: 'bg-danger-600 text-white hover:bg-danger-700'
```

**Cursor Feedback** (NEW):

- Enabled buttons: `hover:cursor-pointer` (implicit on `:hover` state)
- Disabled buttons: `disabled:cursor-not-allowed` (existing, maintained)

**Size Classes** (one of):

```
sm: 'px-3 text-sm'
md: 'px-4 text-base'
lg: 'px-6 text-base'
```

**Height Classes**:

```
All sizes: ALTURA_POR_TAMANHO (e.g., 'h-8' for sm, 'h-10' for md, 'h-12' for lg)
```

**Accessibility Classes**:

```
ANEL_FOCO (focus ring styling for keyboard navigation)
```

**State Classes**:

```
fullWidth: 'w-full'
disabled/loading: 'disabled:cursor-not-allowed disabled:opacity-50'
```

### Dark Mode Support

- All color variants include `dark:` prefixes
- Cursor behavior is theme-independent (platform-level feature)

---

## Content Layout Contract

### Render Order

```
[Loading Spinner OR iconeInicio] + [children] + [!loading ? iconeFim]
```

**Details**:

1. **Loading State**: Shows `Loader2` spinner (animated, size-5, aria-hidden) when `loading=true`
    - Spinner replaces `iconeInicio`; children text is retained (prevents layout collapse)
    - `iconeFim` is hidden during loading

2. **Normal State**:
    - `iconeInicio` is rendered (if provided)
    - Button text is rendered (children)
    - `iconeFim` is rendered (if provided)

### Spacing

- Flex gap between children: `gap-2` (Tailwind 0.5rem)
- Icon sizing: Handled by icon component; no resizing in Button
- Text alignment: center (via `justify-center`)

---

## Accessibility Contract

### ARIA Attributes

- `aria-busy={loading || undefined}`: Set to true when loading for screen reader announcements
- Focus management: Keyboard navigation via native `<button>` element
- Focus indicator: Visual focus ring via `ANEL_FOCO` class

### Icon Accessibility

- Loading spinner: `aria-hidden` (not announced to screen readers; text is read instead)
- User-provided icons: No automatic `aria-hidden`; component assumes icons are decorative
    - If icon conveys meaning distinct from text, button consumer must handle `aria-label` on button

### Button Text Requirements

- Button MUST always have readable text (children) for screen readers
- Icon-only buttons (no children text) are not supported by this contract
    - Recommendation: Use label text or aria-label if icon-only usage is required

---

## Interaction Contract

### Mouse/Pointer Events

**Hover**:

- Cursor changes to `pointer` (CSS `hover:cursor-pointer` — NEW in this feature)
- Background color changes per variant
- Transition is smooth (via `transition-colors` class)

**Click**:

- Triggers native `onclick` event if not disabled
- No custom event handling in component

**Disabled**:

- No interaction possible
- Cursor shows `not-allowed`
- Opacity reduced (50%)

### Keyboard Navigation

- Tab navigation via native `<button>` element
- Enter/Space keys trigger click via native behavior
- Focus indicator visible via `ANEL_FOCO` class

### Touch/Mobile

- Cursor changes may not apply (touch devices don't have cursor)
- Icon remains visible, providing visual affordance
- No touch-specific behavior in component

---

## State Transitions

```
[Enabled] ──hover──> [Hover with pointer cursor]
   │                      │
   │                      └──mouse-leave──> [Enabled]
   │
   ├──disabled──> [Disabled]
   │                 │
   │                 └──enabled──> [Enabled]
   │
   └──loading──> [Loading]
                    │
                    └──loading=false──> [Enabled]
```

---

## Error & Edge Cases

### Unsupported Scenarios

1. **Icon-only buttons** (no children text): Not recommended
    - Icon is decorative; button requires readable text for a11y
    - Workaround: Add aria-label or use text

2. **Multiple icons on same side**: Not supported
    - Component renders one icon per position (`iconeInicio`, `iconeFim`)
    - Workaround: Compose icon elements within a single ReactNode

3. **Changing icon during loading**: Spinner always replaces iconeInicio
    - Loading state prioritizes spinner visibility
    - Workaround: Hide button during loading, show after

### Graceful Handling

- **Null/undefined children**: Button renders but may appear empty
    - Should be validated by component consumer

- **Non-ReactNode iconeInicio/iconeFim**: Treated as passed value; React handles error boundary
    - TypeScript will catch type errors

- **Missing disabled attribute**: Button assumes enabled state
    - CSS classes apply as normal

---

## Version & Compatibility

**Component Version**: Follows SOS Jaraguá versioning (see `package.json`)

**Browser Support**: Modern browsers with CSS Cursor utilities support

- Chrome/Edge/Firefox: Latest (cursor:pointer supported natively)
- Safari: Latest (cursor:pointer supported natively)
- Mobile browsers: Cursor display depends on device (acceptable limitation per Spec Assumption)

**React Version Requirement**: React 19 (project standard)

**TypeScript Requirement**: Strict mode (`tsconfig.json`)

---

## Testing Contract

### Unit Test Scope

**Component Rendering**:

- Button renders with correct variant class
- Icons render when iconeInicio/iconeFim provided
- Loading state shows spinner, hides iconeInicio
- Disabled state applies disabled cursor class

**Cursor Behavior** (NEW):

- `hover:cursor-pointer` class is present in enabled button className
- `disabled:cursor-not-allowed` is present in className (verify existing)
- Cursor class is not duplicated

**Props Validation**:

- All props are passed correctly to button element
- Boolean props default correctly
- undefined props don't break rendering

### Visual Regression Test Scope

- Button appearance with icons in all variants
- Cursor change on hover (may be visual screenshot + CSS inspection)
- Disabled state appearance
- Loading spinner animation

### No Integration Test Required

- This is a pure presentation component
- No API calls, database access, or external dependencies
- Integration testing belongs in consuming page/feature tests
