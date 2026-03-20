import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, Grid3X3, List, Trash2, Copy, Printer, Filter, AlertTriangle, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { useAppStore } from '@/store/appStore'
import { db } from '@/lib/database'
import type { Product, Category, BarcodeType } from '@/types'

export default function Products() {
  const { addToast } = useAppStore()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [sortField, setSortField] = useState<string>('created_at')
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Form state
  const [form, setForm] = useState({
    sku: '',
    name: '',
    description: '',
    category_id: '',
    price: '0',
    cost: '0',
    stock_quantity: '0',
    min_stock_alert: '5',
    barcode_value: '',
    barcode_type: 'code128' as BarcodeType,
    unit: 'unidad',
  })

  const loadProducts = useCallback(() => {
    const data = db.getProducts({
      search: search || undefined,
      categoryId: categoryFilter || undefined,
      activeOnly: statusFilter === 'active' ? true : undefined,
      lowStock: lowStockOnly || undefined,
      orderBy: sortField,
      orderDir: sortDir,
    })
    const filtered = statusFilter === 'inactive' ? data.filter((p) => p.is_active === 0) : data
    setProducts(filtered)
  }, [search, categoryFilter, statusFilter, lowStockOnly, sortField, sortDir])

  useEffect(() => {
    setCategories(db.getCategories())
  }, [])

  useEffect(() => {
    const timer = setTimeout(loadProducts, 300)
    return () => clearTimeout(timer)
  }, [loadProducts])

  const resetForm = () => {
    setForm({
      sku: '',
      name: '',
      description: '',
      category_id: '',
      price: '0',
      cost: '0',
      stock_quantity: '0',
      min_stock_alert: '5',
      barcode_value: '',
      barcode_type: 'code128',
      unit: 'unidad',
    })
    setEditingProduct(null)
  }

  const openCreateModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (product: Product) => {
    setEditingProduct(product)
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      category_id: product.category_id || '',
      price: String(product.price),
      cost: String(product.cost),
      stock_quantity: String(product.stock_quantity),
      min_stock_alert: String(product.min_stock_alert),
      barcode_value: product.barcode_value || '',
      barcode_type: product.barcode_type,
      unit: product.unit,
    })
    setShowModal(true)
  }

  const handleSave = () => {
    if (!form.name.trim() || !form.sku.trim()) {
      addToast({ type: 'error', message: 'El nombre y SKU son obligatorios.' })
      return
    }

    try {
      if (editingProduct) {
        db.updateProduct(editingProduct.id, {
          ...form,
          price: parseFloat(form.price) || 0,
          cost: parseFloat(form.cost) || 0,
          stock_quantity: parseInt(form.stock_quantity) || 0,
          min_stock_alert: parseInt(form.min_stock_alert) || 5,
          category_id: form.category_id || null,
          description: form.description || null,
          barcode_value: form.barcode_value || null,
        })
        addToast({ type: 'success', message: `Producto "${form.name}" actualizado correctamente.` })
      } else {
        db.createProduct({
          ...form,
          price: parseFloat(form.price) || 0,
          cost: parseFloat(form.cost) || 0,
          stock_quantity: parseInt(form.stock_quantity) || 0,
          min_stock_alert: parseInt(form.min_stock_alert) || 5,
          category_id: form.category_id || null,
          description: form.description || null,
          barcode_value: form.barcode_value || null,
          image_blob: null,
          is_active: 1,
        })
        addToast({ type: 'success', message: `Producto "${form.name}" creado correctamente.` })
      }
      setShowModal(false)
      resetForm()
      loadProducts()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      if (msg.includes('UNIQUE constraint failed') && msg.includes('sku')) {
        addToast({ type: 'error', message: `El SKU "${form.sku}" ya existe. Usa un SKU diferente.` })
      } else {
        addToast({ type: 'error', message: `No se pudo guardar el producto: ${msg}` })
      }
    }
  }

  const handleDelete = (product: Product) => {
    if (!confirm(`Eliminar "${product.name}"? Esta accion no se puede deshacer.`)) return
    try {
      db.deleteProduct(product.id)
      addToast({ type: 'success', message: `Producto "${product.name}" eliminado.` })
      loadProducts()
    } catch {
      addToast({ type: 'error', message: 'No se pudo eliminar el producto.' })
    }
  }

  const handleDuplicate = (product: Product) => {
    try {
      db.createProduct({
        ...product,
        sku: product.sku + '-copia',
        name: product.name + ' (copia)',
      })
      addToast({ type: 'success', message: `Producto duplicado como "${product.name} (copia)".` })
      loadProducts()
    } catch {
      addToast({ type: 'error', message: 'No se pudo duplicar el producto.' })
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null
    return categories.find((c) => c.id === categoryId)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, SKU o codigo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface py-2 pl-10 pr-3 text-sm text-white placeholder-gray-500 transition-default focus-ring"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white transition-default focus-ring"
        >
          <option value="">Todas las categorias</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'active' | 'inactive' | 'all')}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white transition-default focus-ring"
        >
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="all">Todos</option>
        </select>

        <button
          onClick={() => setLowStockOnly((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-default ${lowStockOnly ? 'border-error/50 bg-error/10 text-error' : 'border-border bg-surface text-gray-400 hover:text-white'}`}
          title="Filtrar stock bajo"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Stock bajo
        </button>

        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          <button
            onClick={() => setViewMode('table')}
            className={`rounded p-1.5 transition-default ${viewMode === 'table' ? 'bg-copper/20 text-copper' : 'text-gray-400 hover:text-white'}`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded p-1.5 transition-default ${viewMode === 'grid' ? 'bg-copper/20 text-copper' : 'text-gray-400 hover:text-white'}`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
        </div>

        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          Agregar Producto
        </Button>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <ArrowUpDown className="h-3.5 w-3.5" />
        <span>Ordenar por:</span>
        {[
          { field: 'name', label: 'Nombre' },
          { field: 'sku', label: 'SKU' },
          { field: 'price', label: 'Precio' },
          { field: 'stock_quantity', label: 'Stock' },
          { field: 'created_at', label: 'Fecha' },
        ].map(({ field, label }) => (
          <button
            key={field}
            onClick={() => {
              if (sortField === field) setSortDir((d) => d === 'ASC' ? 'DESC' : 'ASC')
              else { setSortField(field); setSortDir(field === 'name' || field === 'sku' ? 'ASC' : 'DESC') }
            }}
            className={`flex items-center gap-0.5 rounded px-2 py-1 transition-default ${sortField === field ? 'bg-copper/10 text-copper' : 'hover:bg-white/5 hover:text-white'}`}
          >
            {label}
            {sortField === field && (sortDir === 'ASC' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
          </button>
        ))}
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-copper/30 bg-copper/5 px-4 py-2">
          <span className="text-sm">{selectedIds.size} seleccionados</span>
          <Button variant="secondary" size="sm">
            <Printer className="h-3 w-3" /> Imprimir etiquetas
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Deseleccionar
          </Button>
        </div>
      )}

      {/* Products List */}
      {products.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12">
            <Filter className="h-12 w-12 text-gray-600 mb-4" />
            <p className="text-gray-400 mb-2">No se encontraron productos</p>
            <p className="text-sm text-gray-600 mb-4">
              {search ? 'Intenta con otros terminos de busqueda' : 'Agrega tu primer producto para empezar'}
            </p>
            {!search && (
              <Button onClick={openCreateModal}>
                <Plus className="h-4 w-4" /> Agregar Producto
              </Button>
            )}
          </div>
        </Card>
      ) : viewMode === 'table' ? (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-gray-400">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    className="rounded"
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(products.map((p) => p.id)))
                      else setSelectedIds(new Set())
                    }}
                  />
                </th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Precio</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const cat = getCategoryName(product.category_id)
                const lowStock = product.stock_quantity < product.min_stock_alert
                return (
                  <tr key={product.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-default">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{product.name}</td>
                    <td className="px-4 py-3 font-mono text-gray-400">{product.sku}</td>
                    <td className="px-4 py-3">
                      {cat ? <Badge color={cat.color}>{cat.name}</Badge> : <span className="text-gray-600">—</span>}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${lowStock ? 'text-error' : ''}`}>
                      {product.stock_quantity}
                      {lowStock && <AlertTriangle className="ml-1 inline h-3 w-3" />}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">${product.price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditModal(product)} className="rounded p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-default" title="Editar">
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDuplicate(product)} className="rounded p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-default" title="Duplicar">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(product)} className="rounded p-1.5 text-gray-400 hover:bg-error/10 hover:text-error transition-default" title="Eliminar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => {
            const cat = getCategoryName(product.category_id)
            const lowStock = product.stock_quantity < product.min_stock_alert
            return (
              <Card key={product.id} hover onClick={() => openEditModal(product)}>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <h3 className="font-medium">{product.name}</h3>
                    {cat && <Badge color={cat.color}>{cat.name}</Badge>}
                  </div>
                  <p className="font-mono text-xs text-gray-400">{product.sku}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`text-sm font-mono ${lowStock ? 'text-error' : 'text-gray-300'}`}>
                      Stock: {product.stock_quantity}
                    </span>
                    <span className="font-mono text-sm">${product.price.toFixed(2)}</span>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); resetForm() }}
        title={editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre del producto" />
          <Input label="SKU *" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="PROD-0001" />
          <div className="col-span-2">
            <Input label="Descripcion" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripcion opcional" />
          </div>
          <Select
            label="Categoria"
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Sin categoria"
          />
          <Select
            label="Unidad"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            options={[
              { value: 'unidad', label: 'Unidad' },
              { value: 'kg', label: 'Kilogramo' },
              { value: 'lb', label: 'Libra' },
              { value: 'litro', label: 'Litro' },
              { value: 'caja', label: 'Caja' },
              { value: 'paquete', label: 'Paquete' },
            ]}
          />
          <Input label="Precio" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <Input label="Costo" type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          <Input label="Stock" type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
          <Input label="Alerta stock minimo" type="number" value={form.min_stock_alert} onChange={(e) => setForm({ ...form, min_stock_alert: e.target.value })} />
          <Input label="Codigo de barras" value={form.barcode_value} onChange={(e) => setForm({ ...form, barcode_value: e.target.value })} placeholder="Valor del codigo" />
          <Select
            label="Tipo de codigo"
            value={form.barcode_type}
            onChange={(e) => setForm({ ...form, barcode_type: e.target.value as BarcodeType })}
            options={[
              { value: 'code128', label: 'Code 128' },
              { value: 'ean13', label: 'EAN-13' },
              { value: 'ean8', label: 'EAN-8' },
              { value: 'upca', label: 'UPC-A' },
              { value: 'code39', label: 'Code 39' },
              { value: 'itf14', label: 'ITF-14' },
              { value: 'qr', label: 'QR Code' },
              { value: 'datamatrix', label: 'DataMatrix' },
            ]}
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => { setShowModal(false); resetForm() }}>Cancelar</Button>
          <Button onClick={handleSave}>{editingProduct ? 'Guardar cambios' : 'Crear producto'}</Button>
        </div>
      </Modal>
    </div>
  )
}
