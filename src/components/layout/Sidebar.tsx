import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  PenTool,
  Printer,
  ScanLine,
  ArrowLeftRight,
  BarChart3,
  Database,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/productos', icon: Package, label: 'Productos' },
  { to: '/editor', icon: PenTool, label: 'Editor' },
  { to: '/imprimir', icon: Printer, label: 'Imprimir' },
  { to: '/escanear', icon: ScanLine, label: 'Escanear' },
  { to: '/movimientos', icon: ArrowLeftRight, label: 'Movimientos' },
  { to: '/reportes', icon: BarChart3, label: 'Reportes' },
  { to: '/datos', icon: Database, label: 'Datos' },
  { to: '/configuracion', icon: Settings, label: 'Configuracion' },
]

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useAppStore()

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-surface transition-all duration-300 ${
        sidebarOpen ? 'w-64' : 'w-16'
      }`}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <img
          src="/icons/icon-192.png"
          alt="LabelCraft Pro"
          className="h-8 w-8 shrink-0 rounded-lg"
        />
        {sidebarOpen && (
          <span className="text-lg font-bold tracking-tight">
            Label<span className="text-copper">Craft</span>
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col gap-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-default ${
                    isActive
                      ? 'bg-copper/10 text-copper'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`
                }
                title={label}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {sidebarOpen && <span>{label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Collapse button */}
      <div className="border-t border-border p-3">
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white transition-default"
          title={sidebarOpen ? 'Colapsar' : 'Expandir'}
        >
          {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
      </div>
    </aside>
  )
}
