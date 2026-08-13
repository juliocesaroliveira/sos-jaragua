import {
    Boxes,
    CalendarCheck,
    ClipboardList,
    FileSpreadsheet,
    HandHeart,
    House,
    LayoutDashboard,
    Megaphone,
    Package,
    PackageMinus,
    PackagePlus,
    Trash2,
    TriangleAlert,
    UserCheck,
    Users,
    type LucideIcon
} from 'lucide-react'
import type { NomeIcone } from '../../auth/navegacao'

/**
 * Ponte entre o registro de navegação (dado puro, sem React) e a camada de UI.
 *
 * É o que permite a `src/shared/auth/navegacao.ts` declarar `icone: 'Boxes'`
 * em vez de JSX, mantendo o registro serializável e testável em Node sem
 * renderizar React (research.md D7).
 */
export const ICONES: Readonly<Record<NomeIcone, LucideIcon>> = {
    House,
    HandHeart,
    CalendarCheck,
    LayoutDashboard,
    Users,
    UserCheck,
    ClipboardList,
    TriangleAlert,
    Boxes,
    PackagePlus,
    PackageMinus,
    Package,
    Trash2,
    Megaphone,
    FileSpreadsheet
}
