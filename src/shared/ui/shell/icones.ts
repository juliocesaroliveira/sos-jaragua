import {
    BellRing,
    Boxes,
    CalendarCheck,
    CalendarPlus,
    ClipboardList,
    FileSpreadsheet,
    HandHeart,
    House,
    LayoutDashboard,
    Megaphone,
    Package,
    PackageMinus,
    PackagePlus,
    ShieldAlert,
    Trash2,
    TriangleAlert,
    UserCheck,
    Users,
    Wrench,
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
    CalendarPlus,
    LayoutDashboard,
    Users,
    UserCheck,
    ClipboardList,
    TriangleAlert,
    // 026-danger-zone-admin — distinto do alerta de crise, que usa TriangleAlert.
    ShieldAlert,
    Boxes,
    PackagePlus,
    PackageMinus,
    Package,
    Trash2,
    Megaphone,
    FileSpreadsheet,
    Wrench,
    BellRing
}
