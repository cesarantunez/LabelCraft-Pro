import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Package,
  AlertTriangle,
  ArrowUpDown,
  Printer,
  DollarSign,
  Download,
  FileText,
  FileSpreadsheet,
  CheckCircle,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { db } from '@/lib/database'
import type { Product, InventoryMovement, PrintHistory, MovementType } from '@/types'

type ReportTab = 'inventario' | 'stock_bajo' | 'movimientos' | 'impresiones' | 'valor'

const TABS: { id: ReportTab; label: string; icon: typeof Package }[] = [
  { id: 'inventario', label: 'Inventario', icon: Package },
  { id: 'stock_bajo', label: 'Stock Bajo', icon: AlertTriangle },
  { id: 'movimientos', label: 'Movimientos', icon: ArrowUpDown },
  { id: 'impresiones', label: 'Impresiones', icon: Printer },
  { id: 'valor', label: 'Valor', icon: DollarSign },
]

const TYPE_LABELS: Record<MovementType, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
  devolucion: 'Devolucion',
}

const TYPE_COLORS: Record<MovementType, string> = {
  entrada: '#4ADE80',
  salida: '#F87171',
  ajuste: '#FBBF24',
  devolucion: '#60A5FA',
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function formatCurrency(n: number, symbol: string = '$') {
  return symbol + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function exportCSV(headers: string[], rows: string[][], filename: string) {
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportXLSX(headers: string[], rows: string[][], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
  XLSX.writeFile(wb, filename)
}

function exportPDF(title: string, headers: string[], rows: string[][], filename: string) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  pdf.setFontSize(16)
  pdf.setTextColor(196, 122, 58)
  pdf.text(title, 14, 18)
  pdf.setFontSize(8)
  pdf.setTextColor(150)
  pdf.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 14, 24)

  const colW = (297 - 28) / headers.length
  let y = 32
  pdf.setFillColor(30, 30, 30)
  pdf.rect(14, y - 4, 297 - 28, 7, 'F')
  pdf.setTextColor(196, 122, 58)
  pdf.setFontSize(7)
  headers.forEach((h, i) => pdf.text(h, 14 + i * colW, y))
  y += 8
  pdf.setTextColor(200)
  for (const row of rows) {
    if (y > 200) { pdf.addPage(); y = 18 }
    row.forEach((cell, i) => pdf.text(String(cell).slice(0, 30), 14 + i * colW, y))
    y += 5
  }
  pdf.save(filename)
}

function KPI({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg bg-background p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: color || '#fff' }}>{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function ExportButtons({ title, headers, rows, name }: { title: string; headers: string[]; rows: string[][]; name: string }) {
  return (
    <div className="flex gap-2">
      <Button variant="ghost" size="sm" onClick={() => exportPDF(title, headers, rows, `${name}.pdf`)}><FileText className="h-3.5 w-3.5" /> PDF</Button>
      <Button variant="ghost" size="sm" onClick={() => exportXLSX(headers, rows, `${name}.xlsx`)}><FileSpreadsheet className="h-3.5 w-3.5" /> Excel</Button>
      <Button variant="ghost" size="sm" onClick={() => exportCSV(headers, rows, `${name}.csv`)}><Download className="h-3.5 w-3.5" /> CSV</Button>
    </div>
  )
}

function MovimientosChart({ movements }: { movements: InventoryMovement[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    const grouped = new Map<string, Record<MovementType, number>>()
    for (const m of movements) {
      const date = m.created_at.split(' ')[0].split('T')[0]
      if (!grouped.has(date)) grouped.set(date, { entrada: 0, salida: 0, ajuste: 0, devolucion: 0 })
      const g = grouped.get(date)!
      g[m.type as MovementType] += m.quantity
    }

    const dates = Array.from(grouped.keys()).sort()
    if (dates.length === 0) {
      ctx.fillStyle = '#666'
      ctx.font = '12px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Sin datos', w / 2, h / 2)
      return
    }

    const maxVal = Math.max(1, ...dates.flatMap((d) => Object.values(grouped.get(d)!)))
    const padL = 50, padR = 16, padT = 20, padB = 40
    const chartW = w - padL - padR, chartH = h - padT - padB
    const barGroupW = chartW / dates.length
    const barW = Math.min(12, barGroupW / 5)
    const types: MovementType[] = ['entrada', 'salida', 'ajuste', 'devolucion']

    ctx.strokeStyle = '#1f1f1f'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = padT + (chartH / 4) * i
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke()
      ctx.fillStyle = '#666'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'right'
      ctx.fillText(String(Math.round(maxVal - (maxVal / 4) * i)), padL - 8, y + 4)
    }

    dates.forEach((date, di) => {
      const g = grouped.get(date)!
      const cx = padL + barGroupW * di + barGroupW / 2
      types.forEach((type, ti) => {
        const val = g[type] || 0
        const barH = (val / maxVal) * chartH
        const x = cx + (ti - 2) * (barW + 2)
        const y = padT + chartH - barH
        ctx.fillStyle = TYPE_COLORS[type]
        ctx.globalAlpha = 0.85
        ctx.beginPath()
        const r = 2
        ctx.moveTo(x + r, y); ctx.lineTo(x + barW - r, y)
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r)
        ctx.lineTo(x + barW, padT + chartH); ctx.lineTo(x, padT + chartH)
        ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.fill(); ctx.globalAlpha = 1
      })
      ctx.fillStyle = '#888'; ctx.font = '9px Inter, sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(date.split('-').slice(1).join('/'), cx, h - padB + 16)
    })

    const legendX = padL, legendY = h - 10
    types.forEach((type, i) => {
      const x = legendX + i * 80
      ctx.fillStyle = TYPE_COLORS[type]; ctx.fillRect(x, legendY - 6, 8, 8)
      ctx.fillStyle = '#aaa'; ctx.font = '9px Inter, sans-serif'; ctx.textAlign = 'left'
      ctx.fillText(TYPE_LABELS[type], x + 12, legendY + 2)
    })
  }, [movements])

  useEffect(() => {
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [draw])

  return <canvas ref={canvasRef} className="w-full" style={{ height: 260 }} />
}

export default function Reports() {
  const [tab, setTab] = useState<ReportTab>('inventario')
  const [products, setProducts] = useState<Product[]>([])
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [printHistory, setPrintHistory] = useState<PrintHistory[]>([])
  const [movTypeFilter, setMovTypeFilter] = useState<string>('')
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [productMap, setProductMap] = useState<Map<string, Product>>(new Map())

  useEffect(() => {
    const prods = db.getProducts({ activeOnly: true })
    setProducts(prods)
    const map = new Map<string, Product>()
    for (const p of prods) map.set(p.id, p)
    setProductMap(map)
    setLowStockProducts(db.getProducts({ lowStock: true, activeOnly: true }))
    setMovements(db.getMovements({ limit: 500 }))
    setPrintHistory(db.getPrintHistory(200))
    setCurrencySymbol(db.getSetting('currency_symbol') || '$')
  }, [])

  const fc = (n: number) => formatCurrency(n, currencySymbol)
  const getProductName = (id: string) => productMap.get(id)?.name || 'Eliminado'
  const filteredMovements = movTypeFilter ? movements.filter((m) => m.type === movTypeFilter) : movements
  const totalUnits = products.reduce((s, p) => s + p.stock_quantity, 0)
  const totalCostValue = products.reduce((s, p) => s + p.cost * p.stock_quantity, 0)
  const totalSaleValue = products.reduce((s, p) => s + p.price * p.stock_quantity, 0)
  const margin = totalSaleValue - totalCostValue
  const marginPct = totalCostValue > 0 ? ((margin / totalCostValue) * 100).toFixed(1) : '0'
  const totalLabelsPrinted = printHistory.filter((h) => h.status === 'completed').reduce((s, h) => s + h.quantity, 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Reportes y Analisis</h1>
        <p className="text-sm text-gray-400 mt-0.5">Reportes de inventario, stock y movimientos</p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg bg-surface p-1">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-default whitespace-nowrap ${tab === t.id ? 'bg-copper text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <Icon className="h-4 w-4" />{t.label}
            </button>
          )
        })}
      </div>

      {tab === 'inventario' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Inventario Actual</h2>
            <ExportButtons title="Inventario Actual" headers={['SKU', 'Nombre', 'Stock', 'Unidad', 'Precio', 'Costo', 'Valor']}
              rows={products.map((p) => [p.sku, p.name, String(p.stock_quantity), p.unit, p.price.toFixed(2), p.cost.toFixed(2), (p.price * p.stock_quantity).toFixed(2)])} name="inventario" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
            <KPI label="Productos" value={products.length} />
            <KPI label="Total unidades" value={totalUnits.toLocaleString()} />
            <KPI label="Valor costo" value={fc(totalCostValue)} />
            <KPI label="Valor venta" value={fc(totalSaleValue)} color="#D4894A" />
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface text-xs text-gray-400">
                <th className="px-3 py-2 text-left font-medium">SKU</th><th className="px-3 py-2 text-left font-medium">Nombre</th>
                <th className="px-3 py-2 text-right font-medium">Stock</th><th className="px-3 py-2 text-left font-medium">Unidad</th>
                <th className="px-3 py-2 text-right font-medium">Precio</th><th className="px-3 py-2 text-right font-medium">Costo</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
              </tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono text-xs text-gray-400">{p.sku}</td>
                    <td className="px-3 py-2">{p.name}</td>
                    <td className={`px-3 py-2 text-right font-medium ${p.stock_quantity < p.min_stock_alert ? 'text-red-400' : ''}`}>{p.stock_quantity}</td>
                    <td className="px-3 py-2 text-gray-500">{p.unit}</td>
                    <td className="px-3 py-2 text-right text-copper">{fc(p.price)}</td>
                    <td className="px-3 py-2 text-right text-gray-400">{fc(p.cost)}</td>
                    <td className="px-3 py-2 text-right font-medium">{fc(p.price * p.stock_quantity)}</td>
                  </tr>
                ))}
                {products.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-gray-500">No hay productos</td></tr>}
              </tbody>
              {products.length > 0 && <tfoot><tr className="border-t border-border bg-surface text-xs font-semibold">
                <td className="px-3 py-2" colSpan={2}>Totales</td><td className="px-3 py-2 text-right">{totalUnits}</td>
                <td className="px-3 py-2" /><td className="px-3 py-2" /><td className="px-3 py-2 text-right">{fc(totalCostValue)}</td>
                <td className="px-3 py-2 text-right text-copper">{fc(totalSaleValue)}</td>
              </tr></tfoot>}
            </table>
          </div>
        </Card>
      )}

      {tab === 'stock_bajo' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Productos con Stock Bajo</h2>
            <ExportButtons title="Stock Bajo" headers={['SKU', 'Nombre', 'Stock', 'Minimo', 'Faltante', 'Estado']}
              rows={lowStockProducts.map((p) => [p.sku, p.name, String(p.stock_quantity), String(p.min_stock_alert), String(p.min_stock_alert - p.stock_quantity), p.stock_quantity <= 0 ? 'Sin stock' : 'Bajo'])} name="stock-bajo" />
          </div>
          {lowStockProducts.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
              <p className="font-medium">Todo en orden</p>
              <p className="text-sm text-gray-400">Ningun producto por debajo del stock minimo</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 mb-4 text-sm text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />{lowStockProducts.length} producto(s) necesitan reposicion
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-surface text-xs text-gray-400">
                    <th className="px-3 py-2 text-left font-medium">SKU</th><th className="px-3 py-2 text-left font-medium">Nombre</th>
                    <th className="px-3 py-2 text-right font-medium">Stock</th><th className="px-3 py-2 text-right font-medium">Minimo</th>
                    <th className="px-3 py-2 text-right font-medium">Faltante</th><th className="px-3 py-2 text-left font-medium">Estado</th>
                  </tr></thead>
                  <tbody>{lowStockProducts.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-gray-400">{p.sku}</td>
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="px-3 py-2 text-right font-medium text-red-400">{p.stock_quantity}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{p.min_stock_alert}</td>
                      <td className="px-3 py-2 text-right text-amber-400">{p.min_stock_alert - p.stock_quantity}</td>
                      <td className="px-3 py-2"><Badge color={p.stock_quantity <= 0 ? '#ef4444' : '#f59e0b'}>{p.stock_quantity <= 0 ? 'Sin stock' : 'Bajo'}</Badge></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      {tab === 'movimientos' && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold">Movimientos de Inventario</h2>
            <div className="flex items-center gap-2">
              <Select value={movTypeFilter} onChange={(e) => setMovTypeFilter(e.target.value)} options={[
                { value: '', label: 'Todos' }, { value: 'entrada', label: 'Entrada' }, { value: 'salida', label: 'Salida' },
                { value: 'ajuste', label: 'Ajuste' }, { value: 'devolucion', label: 'Devolucion' },
              ]} />
              <ExportButtons title="Movimientos" headers={['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Motivo']}
                rows={filteredMovements.map((m) => [formatDate(m.created_at), getProductName(m.product_id), TYPE_LABELS[m.type], String(m.quantity), m.reason || ''])} name="movimientos" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {(['entrada', 'salida', 'ajuste', 'devolucion'] as MovementType[]).map((type) => {
              const qty = movements.filter((m) => m.type === type).reduce((s, m) => s + m.quantity, 0)
              return (
                <div key={type} className="flex items-center gap-2 rounded-lg bg-background px-3 py-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[type] }} />
                  <span className="text-xs text-gray-400">{TYPE_LABELS[type]}</span>
                  <span className="text-xs font-medium">{qty} u.</span>
                </div>
              )
            })}
          </div>
          <div className="rounded-lg border border-border bg-background p-4 mb-4">
            <MovimientosChart movements={filteredMovements} />
          </div>
          <div className="overflow-x-auto rounded-lg border border-border max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface z-10"><tr className="border-b border-border text-xs text-gray-400">
                <th className="px-3 py-2 text-left font-medium">Fecha</th><th className="px-3 py-2 text-left font-medium">Producto</th>
                <th className="px-3 py-2 text-left font-medium">Tipo</th><th className="px-3 py-2 text-right font-medium">Cantidad</th>
                <th className="px-3 py-2 text-left font-medium">Motivo</th>
              </tr></thead>
              <tbody>
                {filteredMovements.slice(0, 100).map((m) => {
                  return (
                    <tr key={m.id} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 text-xs text-gray-500">{formatDate(m.created_at)}</td>
                      <td className="px-3 py-2">{getProductName(m.product_id)}</td>
                      <td className="px-3 py-2"><Badge color={TYPE_COLORS[m.type]}>{TYPE_LABELS[m.type]}</Badge></td>
                      <td className={`px-3 py-2 text-right font-mono font-medium ${m.type === 'entrada' || m.type === 'devolucion' ? 'text-green-400' : 'text-red-400'}`}>
                        {m.type === 'entrada' || m.type === 'devolucion' ? '+' : '-'}{m.quantity}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{m.reason || '—'}</td>
                    </tr>
                  )
                })}
                {filteredMovements.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-gray-500">No hay movimientos</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'impresiones' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Historial de Impresiones</h2>
            <ExportButtons title="Historial Impresiones" headers={['Fecha', 'Productos', 'Etiquetas', 'Estado']}
              rows={printHistory.map((h) => { let n = 0; try { n = JSON.parse(h.product_ids).length } catch {}; return [formatDate(h.printed_at), String(n), String(h.quantity), h.status] })} name="impresiones" />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <KPI label="Total etiquetas" value={totalLabelsPrinted.toLocaleString()} color="#D4894A" />
            <KPI label="Sesiones" value={printHistory.length} />
            <KPI label="Hoy" value={db.getPrintCountToday()} />
          </div>
          {printHistory.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No hay registros de impresion</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface z-10"><tr className="border-b border-border text-xs text-gray-400">
                  <th className="px-3 py-2 text-left font-medium">Fecha</th><th className="px-3 py-2 text-right font-medium">Productos</th>
                  <th className="px-3 py-2 text-right font-medium">Etiquetas</th><th className="px-3 py-2 text-left font-medium">Estado</th>
                </tr></thead>
                <tbody>{printHistory.map((h) => {
                  let n = 0; try { n = JSON.parse(h.product_ids).length } catch {}
                  return (
                    <tr key={h.id} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 text-xs text-gray-400">{formatDate(h.printed_at)}</td>
                      <td className="px-3 py-2 text-right">{n}</td>
                      <td className="px-3 py-2 text-right font-medium">{h.quantity}</td>
                      <td className="px-3 py-2"><Badge color={h.status === 'completed' ? '#4ADE80' : h.status === 'error' ? '#F87171' : '#FBBF24'}>{h.status === 'completed' ? 'Completado' : h.status === 'error' ? 'Error' : 'Cancelado'}</Badge></td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'valor' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Valor del Inventario</h2>
            <ExportButtons title="Valor del Inventario" headers={['SKU', 'Nombre', 'Stock', 'Costo', 'Precio', 'Inversion', 'Valor', 'Margen']}
              rows={products.map((p) => [p.sku, p.name, String(p.stock_quantity), p.cost.toFixed(2), p.price.toFixed(2), (p.cost * p.stock_quantity).toFixed(2), (p.price * p.stock_quantity).toFixed(2), ((p.price - p.cost) * p.stock_quantity).toFixed(2)])} name="valor" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
            <KPI label="Inversion costo" value={fc(totalCostValue)} />
            <KPI label="Valor venta" value={fc(totalSaleValue)} color="#D4894A" />
            <KPI label="Margen bruto" value={fc(margin)} color={margin >= 0 ? '#4ADE80' : '#F87171'} />
            <KPI label="Margen %" value={`${marginPct}%`} color="#60A5FA" sub="sobre costo" />
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface text-xs text-gray-400">
                <th className="px-3 py-2 text-left font-medium">Producto</th><th className="px-3 py-2 text-right font-medium">Stock</th>
                <th className="px-3 py-2 text-right font-medium">Costo u.</th><th className="px-3 py-2 text-right font-medium">Precio u.</th>
                <th className="px-3 py-2 text-right font-medium">Inversion</th><th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 text-right font-medium">Margen</th>
              </tr></thead>
              <tbody>{products.map((p) => {
                const inv = p.cost * p.stock_quantity, val = p.price * p.stock_quantity, m = val - inv
                return (
                  <tr key={p.id} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2"><p className="font-medium">{p.name}</p><p className="text-[10px] text-gray-500 font-mono">{p.sku}</p></td>
                    <td className="px-3 py-2 text-right">{p.stock_quantity}</td>
                    <td className="px-3 py-2 text-right text-gray-400">{fc(p.cost)}</td>
                    <td className="px-3 py-2 text-right text-copper">{fc(p.price)}</td>
                    <td className="px-3 py-2 text-right">{fc(inv)}</td>
                    <td className="px-3 py-2 text-right">{fc(val)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${m >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fc(m)}</td>
                  </tr>
                )
              })}
              {products.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-gray-500">No hay productos</td></tr>}
              </tbody>
              {products.length > 0 && <tfoot><tr className="border-t border-border bg-surface text-xs font-semibold">
                <td className="px-3 py-2">Totales</td><td className="px-3 py-2 text-right">{totalUnits}</td>
                <td className="px-3 py-2" /><td className="px-3 py-2" />
                <td className="px-3 py-2 text-right">{fc(totalCostValue)}</td>
                <td className="px-3 py-2 text-right text-copper">{fc(totalSaleValue)}</td>
                <td className={`px-3 py-2 text-right ${margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fc(margin)}</td>
              </tr></tfoot>}
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
