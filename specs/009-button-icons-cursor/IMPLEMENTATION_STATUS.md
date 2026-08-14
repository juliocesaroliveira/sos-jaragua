# Button Icons Implementation Status

**Last Updated**: 2026-08-13  
**Status**: ✅ Core implementation complete; icon additions in progress

---

## Summary

The button icon and cursor feedback feature has been fully implemented at the component level. All Button and IconButton components now automatically support icons and provide pointer cursor feedback on hover.

### Completed

✅ **Component Modifications**

- Button component: Added `hover:cursor-pointer` CSS class
- IconButton component: Added `hover:cursor-pointer` CSS class
- Both maintain `disabled:cursor-not-allowed` for disabled states
- Added comprehensive TypeScript documentation for icon props

✅ **Documentation**

- Created icon mapping reference (`icon-mapping.md`)
- Documented 20+ standard button actions with Lucide icons
- Provided usage examples and sizing guidelines

✅ **Critical Pages Updated** (Icons Added)

- `app/(publico)/login/login-form.tsx` - ✅ 3 buttons updated
    - "Usar usuário e senha" → LockOpen
    - "Voltar" → ArrowLeft
    - "Acessar" → LogIn

- `app/(publico)/cadastro/cadastro-form.tsx` - ✅ 1 button updated
    - "Criar conta" → UserPlus

- `app/(interno)/(staff)/admin/tabela-usuarios.tsx` - ✅ 2 buttons updated
    - "Nova conta" → Plus
    - "Tentar novamente" → RotateCcw

- `app/(interno)/(staff)/admin/usuario-form-dialog.tsx` - ✅ 3 buttons updated
    - "Trocar Senha" → Key
    - "Cancelar troca de senha" → X
    - "Cancelar" → X
    - "Salvar" / "Cadastrar" → Check

- `app/(interno)/(staff)/atividades/gestao-atividades.tsx` - ✅ 3 buttons updated
    - "Ações" → MoreVertical
    - "Cancelar" → X
    - "Criar atividade" → Plus

**Total Completed**: 12 buttons across 5 files

### Remaining (47 Button components)

#### Activity Management

- `app/(interno)/(staff)/atividades/[id]/painel-escala.tsx` - 2 buttons
    - "Cancelar" → X
    - "Alocar" → Check or Plus

#### Triage Queue

- `app/(interno)/(staff)/cadastros-pendentes/fila-triagem.tsx` - 5+ buttons
    - "Ver detalhes" → Eye or ChevronRight
    - "Aprovar" → Check
    - "Rejeitar" → X or Trash2
    - "Confirmar rejeição" → Trash2

#### Convocation

- `app/(interno)/(staff)/convocacao/convocacao-form.tsx` - 3+ buttons
    - Button with form trigger → MoreVertical or Menu
    - "Cancelar confirmação" → X
    - "Enviar convocação" → Send or Check

#### Crisis Management

- `app/(interno)/(staff)/crise/gestao-crise.tsx` - 2+ buttons
    - "Salvar crise" → Save or Check
    - Menu/Ações → MoreVertical

#### Stock Management

- `app/(interno)/(staff)/estoque/entrada/entrada-form.tsx` - 2 buttons
    - "Limpar" → RotateCcw or Trash
    - "Salvar" → Save or Check

- `app/(interno)/(staff)/estoque/saida/saida-form.tsx` - 2+ buttons
    - Menu/Ações → MoreVertical
    - "Salvar saída" → Save or Check

- `app/(interno)/(staff)/estoque/descarte/descarte-form.tsx` - 1 button
    - "Descartar" → Trash2

- `app/(interno)/(staff)/estoque/kits/gestao-kits.tsx` - 4+ buttons
    - "Editar" (variant=secondary, size=sm) → Pencil
    - "Cancelar" → X
    - "Salvar" → Save or Check
    - "Ações" → MoreVertical

- `app/(interno)/(staff)/estoque/tabela-estoque.tsx` - 1 button
    - "Tentar novamente" → RotateCcw

#### Voluntary Applications

- `app/(interno)/voluntariado/candidatura/candidatura-form.tsx` - 1 button
    - Submit button → UserPlus or Check

#### Reports

- `app/(interno)/(staff)/relatorios/painel-relatorios.tsx` - 1 button
    - "Tentar novamente" → RotateCcw

#### Volunteers

- `app/(interno)/(staff)/voluntarios/tabela-voluntarios.tsx` - 1 button
    - "Tentar novamente" → RotateCcw

#### Notifications

- `app/(interno)/sino-notificacoes.tsx` - 1 button
    - "Marcar tudo" → Check or CheckSquare

#### Design System (Demo Page)

- `app/(interno)/design-system/galeria.tsx` - Multiple buttons (can skip or demonstrate all icons)

---

## Icon Mapping Reference

Use this reference when adding icons to remaining buttons:

| Action                 | Icon                     | Notes                                    |
| ---------------------- | ------------------------ | ---------------------------------------- |
| Criar / Adicionar      | `Plus`                   | "Nova conta", "Criar atividade"          |
| Editar / Modificar     | `Pencil`                 | "Editar perfil", "Editar kit"            |
| Deletar / Remover      | `Trash2`                 | "Descartar", "Remover"                   |
| Salvar                 | `Save` or `Check`        | "Salvar", "Gravar"                       |
| Enviar                 | `Send` or `Check`        | "Enviar convocação", "Enviar formulário" |
| Cancelar / Fechar      | `X`                      | "Cancelar", "Fechar diálogo"             |
| Voltar / Retornar      | `ArrowLeft`              | "Voltar", "Página anterior"              |
| Atualizar / Recarregar | `RotateCcw`              | "Tentar novamente", "Sincronizar"        |
| Menu / Opções          | `MoreVertical`           | "Ações", "Mais opções"                   |
| Ver / Visualizar       | `Eye`                    | "Ver detalhes", "Expandir"               |
| Aprovar                | `Check` or `CheckCircle` | "Aprovar candidatura"                    |
| Rejeitar               | `X` or `Trash2`          | "Rejeitar", "Recusar"                    |
| Usuário                | `User` or `UserPlus`     | "Criar conta", "Candidatura"             |
| Senha                  | `Key` or `Lock`          | "Trocar Senha", "Redefinir senha"        |

---

## Implementation Pattern

To add icons to a Button component:

### Step 1: Import the icon from lucide-react

```typescript
import { Plus, Check, X } from 'lucide-react'
```

### Step 2: Add iconeInicio prop to the Button

```typescript
<Button iconeInicio={<Plus className="size-4" />} onClick={handleClick}>
  Label
</Button>
```

### Step 3: Icon sizing

- **For size `sm` and `md`** (default): Use `className="size-4"` (16px)
- **For size `lg`**: Use `className="size-5"` (20px)

### Cursor Feedback

✅ **Automatically handled** - no additional work needed:

- Enabled buttons: `hover:cursor-pointer` (applied automatically)
- Disabled buttons: `cursor-not-allowed` (applied automatically)
- Loading buttons: `cursor-not-allowed` (applied automatically)

---

## Next Steps

1. **Priority High**: Complete icons in staff/admin pages (activity, stock, triage)
2. **Priority Medium**: Complete icons in form buttons
3. **Priority Low**: Design system gallery (demo purposes)

Each addition is independent and can be done in parallel.

---

## Verification

After adding icons, verify:

1. ✅ Icons display on the left side of text
2. ✅ Icon sizing matches button size (size-4 for sm/md, size-5 for lg)
3. ✅ Icon is semantically appropriate for the action
4. ✅ Build succeeds: `npm run build`
5. ✅ Visual appearance in light and dark themes

---

## Build Status

✅ **Current Build**: PASSING  
Last verified: 2026-08-13 after adding icons to 5 files and 12 buttons

All changes are backward compatible. No breaking changes to component API.
