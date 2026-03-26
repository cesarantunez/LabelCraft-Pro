import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HelpCircle, ChevronDown, ChevronRight, ArrowLeft,
  Package, PenTool, Printer, ScanLine, ArrowLeftRight,
  BarChart3, Database, Settings, Tag,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface GuideSection {
  id: string
  icon: React.ReactNode
  title: string
  audience: 'admin' | 'all'
  steps: string[]
}

function GuideCard({ section, isOpen, onToggle }: { section: GuideSection; isOpen: boolean; onToggle: () => void }) {
  return (
    <Card>
      <button onClick={onToggle} className="flex w-full items-center justify-between text-left">
        <div className="flex items-center gap-3">
          {section.icon}
          <div>
            <h3 className="font-semibold text-sm">{section.title}</h3>
            <span className="text-xs text-gray-500">{section.audience === 'admin' ? 'Administrador' : 'Todos'}</span>
          </div>
        </div>
        {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>
      {isOpen && (
        <ol className="mt-4 space-y-2 border-t border-border pt-4">
          {section.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-300">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-copper/20 text-xs font-bold text-copper">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

const guides: GuideSection[] = [
  {
    id: 'products',
    icon: <Package className="h-5 w-5 text-copper" />,
    title: 'Agregar Productos',
    audience: 'all',
    steps: [
      'Ve a Productos en el menu lateral.',
      'Haz clic en "+ Nuevo Producto".',
      'Llena nombre, precio, costo y unidad. El SKU se genera automaticamente.',
      'Opcionalmente agrega un codigo de barras (puedes escanearlo despues).',
      'Haz clic en "Guardar". El producto aparecera en tu catalogo.',
    ],
  },
  {
    id: 'editor',
    icon: <PenTool className="h-5 w-5 text-copper" />,
    title: 'Disenar Etiquetas',
    audience: 'all',
    steps: [
      'Ve a Editor en el menu lateral.',
      'Haz clic en "+ Nueva Plantilla" o selecciona una existente.',
      'Usa la barra de herramientas izquierda para agregar: texto, codigos de barras, imagenes, lineas o rectangulos.',
      'Usa variables dinamicas como {nombre}, {precio}, {sku}, {barcode} para datos automaticos.',
      'Ajusta el tamaño en el boton de dimensiones (ej: 50x30mm).',
      'Haz clic en "Guardar" cuando estes satisfecho.',
    ],
  },
  {
    id: 'print',
    icon: <Printer className="h-5 w-5 text-copper" />,
    title: 'Imprimir Etiquetas',
    audience: 'all',
    steps: [
      'Ve a Imprimir en el menu lateral.',
      'Selecciona una plantilla de la lista.',
      'Marca los productos que deseas imprimir.',
      'Ajusta la cantidad por producto o usa "cantidad global".',
      'La vista previa se actualiza en tiempo real.',
      'Haz clic en "Generar PDF" y luego "Descargar PDF" o "Imprimir".',
    ],
  },
  {
    id: 'scanner',
    icon: <ScanLine className="h-5 w-5 text-copper" />,
    title: 'Escanear Codigos',
    audience: 'all',
    steps: [
      'Ve a Escanear en el menu lateral.',
      'Permite el acceso a la camara cuando el navegador lo solicite.',
      'Apunta la camara al codigo de barras del producto.',
      'Si el producto existe, veras sus datos y podras registrar movimientos.',
      'Si no existe, puedes crearlo directamente desde la pantalla de escaneo.',
    ],
  },
  {
    id: 'movements',
    icon: <ArrowLeftRight className="h-5 w-5 text-copper" />,
    title: 'Registrar Movimientos de Inventario',
    audience: 'all',
    steps: [
      'Ve a Movimientos en el menu lateral.',
      'Haz clic en "Registrar Movimiento".',
      'Selecciona el producto y el tipo: Entrada, Salida, Ajuste o Devolucion.',
      'Ingresa la cantidad y opcionalmente una razon o referencia.',
      'El stock se actualiza automaticamente al guardar.',
    ],
  },
  {
    id: 'reports',
    icon: <BarChart3 className="h-5 w-5 text-copper" />,
    title: 'Consultar Reportes',
    audience: 'admin',
    steps: [
      'Ve a Reportes en el menu lateral.',
      'Selecciona la pestana: Inventario, Movimientos o Impresiones.',
      'Usa los filtros de fecha para acotar el periodo.',
      'Los KPIs se calculan automaticamente (valor, conteos, etc.).',
      'Haz clic en "Exportar CSV" para descargar los datos.',
    ],
  },
  {
    id: 'backup',
    icon: <Database className="h-5 w-5 text-copper" />,
    title: 'Respaldar y Restaurar Datos',
    audience: 'admin',
    steps: [
      'Ve a Datos en el menu lateral.',
      'En la seccion "Backup de Base de Datos", haz clic en "Descargar Backup".',
      'Se descargara un archivo .db con TODOS tus datos.',
      'Para restaurar: sube el archivo .db en "Restaurar Base de Datos".',
      'IMPORTANTE: Restaurar reemplaza TODOS los datos actuales.',
      'Recomendacion: haz un backup semanal como minimo.',
    ],
  },
  {
    id: 'settings',
    icon: <Settings className="h-5 w-5 text-copper" />,
    title: 'Configurar la Aplicacion',
    audience: 'admin',
    steps: [
      'Ve a Configuracion en el menu lateral.',
      'Datos del negocio: nombre, direccion y telefono.',
      'Moneda: selecciona tu moneda (MXN, USD, EUR, etc.).',
      'Formato de SKU: prefijo y cantidad de digitos.',
      'Seguridad: activa el bloqueo por inactividad y configura un PIN.',
      'Retencion de datos: define cuanto tiempo conservar historiales.',
      'Haz clic en "Guardar" para aplicar los cambios.',
    ],
  },
]

export default function Help() {
  const navigate = useNavigate()
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['products']))
  const [filter, setFilter] = useState<'all' | 'admin'>('all')

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = filter === 'all' ? guides : guides.filter((g) => g.audience === 'admin')

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/configuracion')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Manual de Usuario</h1>
            <p className="text-sm text-gray-400 mt-0.5">Guias paso a paso para usar LabelCraft Pro</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-1 self-end sm:self-auto">
          <button
            onClick={() => setFilter('all')}
            aria-label="Todas las guias"
            className={`rounded px-3 py-1 text-xs font-medium transition-default ${filter === 'all' ? 'bg-copper/20 text-copper' : 'text-gray-400 hover:text-white'}`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('admin')}
            aria-label="Guias de administrador"
            className={`rounded px-3 py-1 text-xs font-medium transition-default ${filter === 'admin' ? 'bg-copper/20 text-copper' : 'text-gray-400 hover:text-white'}`}
          >
            Admin
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((section) => (
          <GuideCard
            key={section.id}
            section={section}
            isOpen={openSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface/50 px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <HelpCircle className="h-3.5 w-3.5 text-copper" />
          <span>LabelCraft Pro v1.0.0 — Todos los datos se procesan localmente en tu dispositivo.</span>
        </div>
      </div>
    </div>
  )
}
