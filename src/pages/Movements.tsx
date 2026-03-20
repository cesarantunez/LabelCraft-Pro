import { useState, useEffect, useCallback } from 'react'
import { Plus, ArrowLeftRight, Calendar } from 'lucide-react'
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
  devolucion: '#C47A3A',
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
      loadMovements()
    } catch {
      addToast({ type: 'error', message: 'No se pudo registrar el movimiento.' })
    }
  }

  const getProductName = (id: string) => products.find((p) => p.id === id)?.name || id

  return (
    <div className="space-y-4">
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
        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white transition-default focus-ring max-w-[200px]"
        >
          <option value="">Todos los productos</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-gray-500" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-white transition-default focus-ring"
            title="Fecha inicio"
          />
          <span className="text-gray-500 text-xs">a</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-white transition-default focus-ring"
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
        <div className="flex-1" />
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4" /> Registrar Movimiento
        </Button>
      </div>

      <Card className="!p-0 overflow-x-auto">
        {movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <ArrowLeftRight className="h-12 w-12 text-gray-600 mb-4" />
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
                  <td className="px-4 py-3 text-gray-400 text-xs">{mov.created_at}</td>
                  <td className="px-4 py-3">
                    <Badge color={typeColors[mov.type as MovementType]}>{typeLabels[mov.type as MovementType]}</Badge>
                  </td>
                  <td className="px-4 py-3">{getProductName(mov.product_id)}</td>
                  <td className="px-4 py-3 text-right font-mono">{mov.quantity}</td>
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
