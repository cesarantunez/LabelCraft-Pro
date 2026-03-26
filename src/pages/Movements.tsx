import { useState, useEffect, useCallback } from 'react'
import { Plus, ArrowLeftRight, Calendar, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/store/appStore'
import { db } from '@/lib/database'
import type { InventoryMovement, Product, MovementType } from '@/types'

const typeLabels: Record<MovementType, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
  devolucion: 'Devolucion',
}

const typeColors: Record<MovementType, string> = {
  entrada: '#4ADE80',
  salida: '#F87171',
  ajuste: '#FBBF24',
  devolucion: '#D4894A',
}

function formatMovDate(dateStr: string) {
  const date = new Date(dateStr.replace(' ', 'T'))
  if (isNaN(date.getTime())) return dateStr
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Justo ahora'
  if (diffMin < 60) return `Hace ${diffMin} min`
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return `Hace ${diffDays} dias`
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function Movements() {
  const { addToast } = useAppStore()
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [showModal, setShowModal] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [form, setForm] = useState({
    product_id: '',
    type: 'entrada' as MovementType,
    quantity: '1',
    reason: '',
    reference: '',
  })

  const loadMovements = useCallback(() => {
    setMovements(db.getMovements({
      type: typeFilter || undefined,
      productId: productFilter || undefined,
      startDate: startDate || undefined,
      endDate: endDate ? endDate + ' 23:59:59' : undefined,
      limit: 200,
    }))
  }, [typeFilter, productFilter, startDate, endDate])

  useEffect(() => {
    setProducts(db.getProducts({ activeOnly: true }))
  }, [])

  useEffect(() => {
    loadMovements()
  }, [loadMovements])

  const handleSave = () => {
    if (!form.product_id) {
      addToast({ type: 'error', message: 'Selecciona un producto.' })
      return
    }
    const qty = parseInt(form.quantity)
    if (!qty || qty <= 0) {
      addToast({ type: 'error', message: 'La cantidad debe ser mayor a 0.' })
      return
    }

    // Validate stock won't go negative on salida/ajuste
    if (form.type === 'salida' || form.type === 'ajuste') {
      const product = products.find((p) => p.id === form.product_id)
      if (product && qty > product.stock_quantity) {
        addToast({ type: 'error', message: `Stock insuficiente. "${product.name}" solo tiene ${product.stock_quantity} en inventario.` })
        return
      }
    }

    try {
      db.addMovement({
        product_id: form.product_id,
        type: form.type,
        quantity: qty,
        reason: form.reason || null,
        reference: form.reference || null,
      })
      const product = products.find((p) => p.id === form.product_id)
      addToast({ type: 'success', message: `${typeLabels[form.type]} de ${qty} registrada para "${product?.name}".` })
      setShowModal(false)
      setForm({ product_id: '', type: 'entrada', quantity: '1', reason: '', reference: '' })
      setProducts(db.getProducts({ activeOnly: true }))
      loadMovements()
    } catch {
      addToast({ type: 'error', message: 'No se pudo registrar el movimiento.' })
    }
  }

  const getProductName = (id: string) => products.find((p) => p.id === id)?.name || id

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Movimientos de Inventario</h1>
          <p className="text-sm text-gray-400 mt-0.5">Entradas, salidas y ajustes de stock</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Registrar Movimiento
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          options={[
            { value: 'entrada', label: 'Entradas' },
            { value: 'salida', label: 'Salidas' },
            { value: 'ajuste', label: 'Ajustes' },
            { value: 'devolucion', label: 'Devoluciones' },
          ]}
          placeholder="Todos los tipos"
        />
        <Select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          options={products.map((p) => ({ value: p.id, label: p.name }))}
          placeholder="Todos los productos"
        />
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 w-full sm:w-auto">
          <Calendar className="h-4 w-4 text-gray-500 hidden sm:block" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-white transition-default focus-ring w-full sm:w-auto"
            title="Fecha inicio"
          />
          <span className="text-gray-500 text-xs hidden sm:block">a</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-white transition-default focus-ring w-full sm:w-auto"
            title="Fecha fin"
          />
        </div>
        {(typeFilter || productFilter || startDate || endDate) && (
          <button
            onClick={() => { setTypeFilter(''); setProductFilter(''); setStartDate(''); setEndDate('') }}
            className="text-xs text-gray-400 hover:text-copper transition-default"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <Card className="!p-0 overflow-x-auto">
        {movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <ArrowLeftRight className="h-12 w-12 text-gray-500 mb-4" />
            <p className="text-gray-400">Sin movimientos registrados</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-gray-400">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3 text-right">Cantidad</th>
                <th className="px-4 py-3">Razon</th>
                <th className="px-4 py-3">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((mov) => (
                <tr key={mov.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-default">
                  <td className="px-4 py-3 text-gray-400 text-xs" title={mov.created_at}>{formatMovDate(mov.created_at)}</td>
                  <td className="px-4 py-3">
                    <Badge color={typeColors[mov.type as MovementType]}>{typeLabels[mov.type as MovementType]}</Badge>
                  </td>
                  <td className="px-4 py-3">{getProductName(mov.product_id)}</td>
                  <td className={`px-4 py-3 text-right font-mono ${mov.type === 'entrada' || mov.type === 'devolucion' ? 'text-green-400' : 'text-red-400'}`}>
                    {mov.type === 'entrada' || mov.type === 'devolucion' ? '+' : '-'}{mov.quantity}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{mov.reason || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono">{mov.reference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Registrar Movimiento">
        <div className="space-y-4">
          <Select
            label="Producto *"
            value={form.product_id}
            onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
            placeholder="Selecciona un producto"
          />
          {form.product_id && (() => {
            const p = products.find((pr) => pr.id === form.product_id)
            if (!p) return null
            const isLow = p.stock_quantity <= p.min_stock_alert
            return (
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isLow ? 'bg-red-500/10 text-red-400' : 'bg-surface text-gray-400'}`}>
                {isLow && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                Stock actual: <span className="font-mono font-medium text-white">{p.stock_quantity}</span> {p.unit}
              </div>
            )
          })()}
          <Select
            label="Tipo *"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as MovementType })}
            options={[
              { value: 'entrada', label: 'Entrada' },
              { value: 'salida', label: 'Salida' },
              { value: 'ajuste', label: 'Ajuste' },
              { value: 'devolucion', label: 'Devolucion' },
            ]}
          />
          <Input label="Cantidad *" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <Input label="Razon" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Motivo del movimiento" />
          <Input label="Referencia" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="No. factura, orden, etc." />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Registrar</Button>
        </div>
      </Modal>
    </div>
  )
}
