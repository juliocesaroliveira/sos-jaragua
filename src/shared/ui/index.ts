/**
 * Barrel do design system (DESIGN_SYSTEM.md §5). Telas importam daqui, nunca
 * de `@ark-ui/react` diretamente — é o que impede drift visual entre telas.
 */
export { cn, ANEL_FOCO, ALTURA_POR_TAMANHO, type TamanhoControle } from './cn'

export { Button, type ButtonProps, type VarianteBotao } from './button/button'
export { IconButton, type IconButtonProps } from './icon-button/icon-button'

export { Formulario, type FormularioProps } from './formulario/formulario'
export { Campo, type CampoProps } from './campo/campo'
export { Input, type InputProps } from './input/input'
export { Password, type PasswordProps } from './password/password'
export { Textarea, type TextareaProps } from './textarea/textarea'
export { NumberInput, type NumberInputProps } from './number-input/number-input'
export { Select, type SelectProps, type OpcaoSelect } from './select/select'
export { Combobox, type ComboboxProps, type OpcaoCombobox } from './combobox/combobox'
export { CheckboxGroup, type CheckboxGroupProps, type OpcaoCheckbox } from './checkbox-group/checkbox-group'
export { RadioGroup, type RadioGroupProps, type OpcaoRadio } from './radio-group/radio-group'
export { Switch, type SwitchProps } from './switch/switch'
export { DatePicker, type DatePickerProps } from './date-picker/date-picker'

export { Dialog, type DialogProps } from './dialog/dialog'
export { Drawer, type DrawerProps } from './drawer/drawer'
export { Toaster, avisar } from './toast/toast'
export { Tooltip, type TooltipProps } from './tooltip/tooltip'
export { Popover, type PopoverProps } from './popover/popover'
export { Menu, type MenuProps, type ItemMenu } from './menu/menu'

export { Tabs, type TabsProps, type AbaTabs } from './tabs/tabs'
export { Accordion, type AccordionProps, type ItemAccordion } from './accordion/accordion'

export { Avatar, iniciaisDe, type AvatarProps } from './avatar/avatar'
export { Logo, type LogoProps, type TamanhoLogo } from './logo/logo'
export {
    Badge,
    type BadgeProps,
    type CorBadge,
    COR_STATUS_VOLUNTARIO,
    COR_STATUS_ATIVIDADE,
    COR_STATUS_ALOCACAO,
    COR_TIPO_SAIDA,
    COR_STATUS_ENVIO,
    ROTULO_STATUS_VOLUNTARIO,
    ROTULO_STATUS_ATIVIDADE,
    ROTULO_STATUS_ALOCACAO,
    ROTULO_TIPO_SAIDA
} from './badge/badge'
export { Progress, ProgressCircle, type ProgressProps } from './progress/progress'
export { StatCard, type StatCardProps } from './stat-card/stat-card'
export { Table, type TableProps, type ColunaTabela } from './table/table'
export { TableFooter, type PaginacaoTabela } from './table/table-footer'
export { Pagination, type PaginationProps } from './pagination/pagination'
export { Alert, type AlertProps, type TomAlerta } from './alert/alert'
export { Skeleton, SkeletonLista, type SkeletonProps } from './skeleton/skeleton'
export { KanbanColumn, type KanbanColumnProps } from './kanban/kanban-column'
export { KanbanCard, type KanbanCardProps } from './kanban/kanban-card'

export { ThemeProvider, themeInitScript } from './theme/theme-provider'
export { ThemeToggle } from './theme/theme-toggle'

export { AppShell, type AppShellProps } from './shell/app-shell'
export { ConteudoNaoEncontrado, type ConteudoNaoEncontradoProps } from './nao-encontrado/nao-encontrado'
