import { useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/productos': 'Productos',
  '/editor': 'Editor de Etiquetas',
  '/imprimir': 'Impresion por Lotes',
  '/escanear': 'Escanear Codigo',
  '/movimientos': 'Movimientos',
  '/reportes': 'Reportes',
  '/datos': 'Importar / Exportar',
  '/configuracion': 'Configuracion',
}

export function Header() {
  const location = useLocation()
  const { setSidebarOpen } = useAppStore()

  const basePath = '/' + (location.pathname.split('/')[1] || '')
  const title = pageTitles[basePath] || 'LabelCraft Pro'

  return (
    <header className="flex h-14 sm:h-16 items-center gap-3 sm:gap-4 border-b border-border bg-surface/50 px-3 sm:px-6 backdrop-blur-sm">
      <button
        onClick={() => setSidebarOpen(true)}
        aria-label="Abrir menu"
        className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white transition-default lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <img
        src="/icons/icon-192.png"
        alt="LabelCraft Pro"
        className="h-7 w-7 rounded-md lg:hidden"
      />
      <h1 className="text-lg sm:text-xl font-semibold truncate">{title}</h1>
    </header>
  )
}
