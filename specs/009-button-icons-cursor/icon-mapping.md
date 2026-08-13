# Button Action → Icon Mapping Reference

**Feature**: Unified Button Icons and Cursor Feedback

**Last Updated**: 2026-08-13

**Source**: Lucide React icon library

---

## Standard Action Icon Mappings

All icons imported from `lucide-react`. Use these mappings when adding icons to buttons across the application.

| Action | Icon Name | Import | Typical Use Cases |
|--------|-----------|--------|-------------------|
| Create / Add | `Plus` | `import { Plus } from 'lucide-react'` | "Criar Usuário", "Adicionar Item", "Nova Entrada" |
| Edit / Modify | `Pencil` | `import { Pencil } from 'lucide-react'` | "Editar Perfil", "Alterar Dados", "Modificar" |
| Delete / Remove | `Trash2` | `import { Trash2 } from 'lucide-react'` | "Remover", "Deletar", "Excluir" |
| Save | `Save` | `import { Save } from 'lucide-react'` | "Salvar Alterações", "Gravar" |
| Submit / Confirm | `Check` or `CheckCircle` | `import { Check } from 'lucide-react'` | "Enviar Formulário", "Confirmar", "Aceitar" |
| Cancel / Close | `X` or `XCircle` | `import { X } from 'lucide-react'` | "Cancelar", "Fechar", "Descartar" |
| Download / Export | `Download` | `import { Download } from 'lucide-react'` | "Exportar", "Baixar Relatório", "Salvar Como" |
| Upload / Import | `Upload` | `import { Upload } from 'lucide-react'` | "Importar", "Enviar Arquivo", "Carregar Dados" |
| Print | `Printer` | `import { Printer } from 'lucide-react'` | "Imprimir", "Gerar PDF" |
| Search | `Search` | `import { Search } from 'lucide-react'` | "Buscar", "Filtrar", "Pesquisar" |
| Settings / Configuration | `Settings` or `Gear` | `import { Settings } from 'lucide-react'` | "Configurações", "Preferências", "Opções Avançadas" |
| Logout / Exit | `LogOut` | `import { LogOut } from 'lucide-react'` | "Sair", "Desconectar", "Encerrar Sessão" |
| Menu / More Options | `Menu` or `MoreVertical` | `import { Menu } from 'lucide-react'` | "Opções", "Mais", "Ações" |
| Refresh / Reload | `RotateCcw` | `import { RotateCcw } from 'lucide-react'` | "Atualizar", "Recarregar", "Sincronizar" |
| Back / Previous | `ArrowLeft` or `ChevronLeft` | `import { ArrowLeft } from 'lucide-react'` | "Voltar", "Página Anterior", "Retornar" |
| Next / Forward | `ArrowRight` or `ChevronRight` | `import { ArrowRight } from 'lucide-react'` | "Próximo", "Página Seguinte", "Avançar" |
| Help / Info | `HelpCircle` or `Info` | `import { HelpCircle } from 'lucide-react'` | "Ajuda", "Informações", "Documentação" |
| Copy | `Copy` | `import { Copy } from 'lucide-react'` | "Copiar", "Duplicar" |
| Archive | `Archive` | `import { Archive } from 'lucide-react'` | "Arquivar", "Guardar" |
| Eye / View | `Eye` | `import { Eye } from 'lucide-react'` | "Visualizar", "Ver Detalhes", "Expandir" |
| Eye Off / Hide | `EyeOff` | `import { EyeOff } from 'lucide-react'` | "Ocultar", "Minimizar" |
| Trash / Recycle | `Trash` | `import { Trash } from 'lucide-react'` | "Ir para Lixeira", "Soft Delete" |
| Check All | `CheckSquare` | `import { CheckSquare } from 'lucide-react'` | "Selecionar Todos", "Marcar Todos" |
| Uncheck All | `Square` | `import { Square } from 'lucide-react'` | "Desselecionar Todos", "Desmarcar Todos" |

---

## Component Usage Examples

### Basic Button with Icon (Left-Aligned)

```tsx
import { Button } from '@/shared/ui/button'
import { Plus } from 'lucide-react'

export function CreateUserButton() {
  return (
    <Button iconeInicio={<Plus className="size-4" />}>
      Criar Usuário
    </Button>
  )
}
```

### All Variants with Icons

```tsx
import { Button } from '@/shared/ui/button'
import { Save, X, Pencil, Trash2 } from 'lucide-react'

export function FormActions() {
  return (
    <>
      {/* Primary */}
      <Button variant="primary" iconeInicio={<Save className="size-4" />}>
        Salvar
      </Button>
      
      {/* Secondary */}
      <Button variant="secondary" iconeInicio={<X className="size-4" />}>
        Cancelar
      </Button>
      
      {/* Ghost */}
      <Button variant="ghost" iconeInicio={<Pencil className="size-4" />}>
        Editar
      </Button>
      
      {/* Danger */}
      <Button variant="danger" iconeInicio={<Trash2 className="size-4" />}>
        Deletar
      </Button>
    </>
  )
}
```

### Icon Sizing

- **For size `sm`**: Use `className="size-4"` on icon (16px)
- **For size `md`** (default): Use `className="size-4"` on icon (16px)
- **For size `lg`**: Use `className="size-5"` on icon (20px)

This maintains visual balance with button text size.

---

## Cursor Feedback Behavior

**Automatically Applied** (no configuration needed):

- **Enabled Buttons**: Cursor changes to `pointer` on hover (CSS class: `hover:cursor-pointer`)
- **Disabled Buttons**: Cursor shows "not-allowed" (CSS class: `disabled:cursor-not-allowed`)
- **Loading Buttons**: Cursor shows "not-allowed" (treated as disabled state)

No additional work needed - the Button component handles this automatically.

---

## Accessibility Considerations

1. **Icon as Decorative**: Icons in buttons are decorative; button text provides the semantic meaning
   - Screen readers announce button text, not icon
   - Icon serves visual affordance only

2. **Icon-Only Buttons**: Not recommended by this design
   - Always include readable button text
   - If icon-only is necessary, add `aria-label` to button

3. **Focus Management**: Built-in via `ANEL_FOCO` class
   - Focus ring visible on all buttons for keyboard navigation
   - No additional accessibility work needed

---

## Guidelines for Implementation

1. **Select Semantically Appropriate Icon**: Match icon to button action
2. **Consistent Sizing**: Use size-4 for sm/md buttons, size-5 for lg buttons
3. **Left-Positioned**: Always use `iconeInicio` prop (never `iconeFim` for primary action icons)
4. **Cursor Feedback**: Automatically applied; no manual CSS needed
5. **Test Across Variants**: Verify icon visibility in all variant backgrounds

---

## Audit Findings

### Current Button Usage (2026-08-13)

| File | Buttons | Actions | Icon Status |
|------|---------|---------|-------------|
| `src/shared/ui/dialog/dialog.tsx` | 2 | Close, Primary Action | To be updated |
| `src/shared/ui/icon-button/icon-button.tsx` | 1 | Icon-only button | N/A - Icon button component |
| `src/shared/ui/shell/topbar.tsx` | 2-3 | Menu, Actions | To be updated |

**Total Estimated Buttons**: ~5-10 in current implementation (early development stage)

**Note**: As the application grows with more pages and modules, this reference will guide consistent icon selection for new buttons.
