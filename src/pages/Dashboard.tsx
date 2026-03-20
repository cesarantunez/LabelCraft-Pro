import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, AlertTriangle, Printer, DollarSign, PenTool, Plus, ScanLine, ArrowLeftRight, BarChart3 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { db } from '@/lib/database'
import type { DashboardStats } from '@/types'

function StatCard({ icon: Icon, label, value, color, subtext }: {
  icon: typeof Package
  label: string
  value: string | number
  color: string
  subtext?: string
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {subtext && <p className="mt-1 text-xs text-gray-500">{subtext}</p>}
        </div>
        <div className="rounded-lg p-2" style={{ backgroundColor: color + '20' }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    lowStockProducts: 0,
    labelsPrintedToday: 0,
    labelsPrintedWeek: 0,
    labelsPrintedMonth: 0,
    inventoryValue: 0,
  })
  const [recentActivity, setRecentActivity] = useState<Array<{ type: string; description: string; date: string }>>([])
  const [chartData, setChartData] = useState<Array<{ date: string; label: string; entradas: number; salidas: number }>>([])

  useEffect(() => {
    setStats({
      totalProducts: db.getProductCount(),
      lowStockProducts: db.getLowStockCount(),
      labelsPrintedToday: db.getPrintCountToday(),
      labelsPrintedWeek: db.getPrintCountWeek(),
      labelsPrintedMonth: db.getPrintCountMonth(),
      inventoryValue: db.getInventoryValue(),
    })
    setRecentActivity(db.getRecentActivity(5))

    // Build last 7 days chart data (fill missing days with zeros)
    const raw = db.getMovementsLast7Days()
    const rawMap = new Map(raw.map((d) => [d.date, d]))
    const days: typeof chartData = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const iso = d.toISOString().slice(0, 10)
      const found = rawMap.get(iso)
      days.push({
        date: iso,
        label: d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
        entradas: found?.entradas ?? 0,
        salidas: found?.salidas ?? 0,
      })
    }
    setChartData(days)
  }, [])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' }).format(value)
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Package}
          label="Productos activos"
          value={stats.totalProducts}
          color="#C47A3A"
        />
        <StatCard
          icon={AlertTriangle}
          label="Stock bajo"
          value={stats.lowStockProducts}
          color={stats.lowStockProducts > 0 ? '#F87171' : '#4ADE80'}
        />
        <StatCard
          icon={Printer}
          label="Etiquetas impresas"
          value={stats.labelsPrintedMonth}
          color="#C47A3A"
          subtext={`Hoy: ${stats.labelsPrintedToday} | Semana: ${stats.labelsPrintedWeek}`}
        />
        <StatCard
          icon={DollarSign}
          label="Valor del inventario"
          value={formatCurrency(stats.inventoryValue)}
          color="#4ADE80"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Accesos rapidos</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link to="/editor">
            <Card hover className="flex items-center gap-3 !p-4">
              <PenTool className="h-5 w-5 text-copper" />
              <span className="text-sm font-medium">Nueva Etiqueta</span>
            </Card>
          </Link>
          <Link to="/productos">
            <Card hover className="flex items-center gap-3 !p-4">
              <Plus className="h-5 w-5 text-copper" />
              <span className="text-sm font-medium">Agregar Producto</span>
            </Card>
          </Link>
          <Link to="/escanear">
            <Card hover className="flex items-center gap-3 !p-4">
              <ScanLine className="h-5 w-5 text-copper" />
              <span className="text-sm font-medium">Escanear Codigo</span>
            </Card>
          </Link>
          <Link to="/movimientos">
            <Card hover className="flex items-center gap-3 !p-4">
              <ArrowLeftRight className="h-5 w-5 text-copper" />
              <span className="text-sm font-medium">Mov. Inventario</span>
            </Card>
          </Link>
        </div>
      </div>

      {/* Movements Chart */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-5 w-5 text-copper" />
          <h2 className="text-lg font-semibold">Movimientos (ultimos 7 dias)</h2>
        </div>
        <Card>
          {chartData.every((d) => d.entradas === 0 && d.salidas === 0) ? (
            <p className="text-center text-sm text-gray-500 py-8">
              Sin movimientos en los ultimos 7 dias.
            </p>
          ) : (
            <>
              <div className="flex items-end gap-2" style={{ height: 140 }}>
                {chartData.map((day) => {
                  const maxVal = Math.max(...chartData.flatMap((d) => [d.entradas, d.salidas]), 1)
                  const eH = (day.entradas / maxVal) * 100
                  const sH = (day.salidas / maxVal) * 100
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      <div className="flex gap-0.5 items-end w-full justify-center" style={{ height: 112 }}>
                        <div
                          className="w-3 rounded-t bg-emerald-500/70 transition-all"
                          style={{ height: `${eH}%`, minHeight: day.entradas > 0 ? 4 : 0 }}
                          title={`Entradas: ${day.entradas}`}
                        />
                        <div
                          className="w-3 rounded-t bg-red-400/70 transition-all"
                          style={{ height: `${sH}%`, minHeight: day.salidas > 0 ? 4 : 0 }}
                          title={`Salidas: ${day.salidas}`}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 truncate w-full text-center">{day.label}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500/70" />
                  Entradas
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <div className="h-2.5 w-2.5 rounded-sm bg-red-400/70" />
                  Salidas
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Actividad reciente</h2>
        <Card>
          {recentActivity.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-8">
              Sin actividad aun. Agrega productos o imprime etiquetas para ver la actividad aqui.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentActivity.map((activity, i) => (
                <li key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <ArrowLeftRight className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{activity.description}</span>
                  </div>
                  <span className="text-xs text-gray-500">{activity.date}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
