import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
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
  X,
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
  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useAppStore()
  const location = useLocation()

  // Close mobile sidebar on route change
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [location.pathname, setSidebarOpen])

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-border bg-surface transition-all duration-300
          ${sidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-16'}
        `}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
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
          {/* Close button - mobile only */}
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-default lg:hidden"
              aria-label="Cerrar menu"
            >
              <X className="h-5 w-5" />
            </button>
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

        {/* Collapse button - desktop only */}
        <div className="hidden border-t border-border p-3 lg:block">
          <button
            onClick={toggleSidebar}
            className="flex w-full items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white transition-default"
            aria-label={sidebarOpen ? 'Colapsar menu' : 'Expandir menu'}
            title={sidebarOpen ? 'Colapsar' : 'Expandir'}
          >
            {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>
      </aside>
    </>
  )
}
