import { useState, useRef, useCallback, useMemo } from 'react'
import {
  ScanLine,
  Camera,
  CheckCircle,
  XCircle,
  Plus,
  Edit3,
  Printer,
  ArrowUpDown,
  Package,
  Clock,
  Trash2,
  AlertTriangle,
  Keyboard,
  ImagePlus,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import BarcodeScanner from '@/components/BarcodeScanner/BarcodeScanner'
import { useBarcodeScanner, type ScanResult } from '@/components/BarcodeScanner/useBarcodeScanner'
import { useAppStore } from '@/store/appStore'
import { db } from '@/lib/database'
import type { Product, BarcodeType, MovementType } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScanRecord {
  id: string
  barcode: string
  format: string
  product: Product | null
  scannedAt: Date
  source: 'camera' | 'manual' | 'image'
}

interface MovementForm {
  type: MovementType
  quantity: string
  reason: string
  reference: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MOVEMENT_FORM: MovementForm = {
  type: 'entrada',
  quantity: '1',
  reason: '',
  reference: '',
}

const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
  devolucion: 'Devolucion',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Scanner() {
  const { addToast } = useAppStore()
  const navigate = useNavigate()
  const currencySymbol = useMemo(() => db.getSetting('currency_symbol') || '$', [])
  const defaultUnit = useMemo(() => db.getSetting('default_unit') || 'unidad', [])
  const defaultMinStock = useMemo(() => db.getSetting('low_stock_threshold') || '5', [])

  // Scanner overlay
  const [showScanner, setShowScanner] = useState(false)
  const [flashActive, setFlashActive] = useState(false)

  // Image scanning (uses the hook's scanImage for file-based scanning)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const { scanImage } = useBarcodeScanner({
    onScan: () => {},
    continuous: false,
  })

  // Manual input
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')

  // History & modals
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([])
  const [selectedScan, setSelectedScan] = useState<ScanRecord | null>(null)
  const [showProductModal, setShowProductModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showMovementModal, setShowMovementModal] = useState(false)

  // Forms
  const [movementForm, setMovementForm] = useState<MovementForm>(DEFAULT_MOVEMENT_FORM)
  const [newProductForm, setNewProductForm] = useState({
    sku: '',
    name: '',
    description: '',
    price: '0',
    cost: '0',
    stock_quantity: '0',
    min_stock_alert: defaultMinStock,
    barcode_value: '',
    barcode_type: 'code128' as BarcodeType,
    unit: defaultUnit,
  })
  const [isSaving, setIsSaving] = useState(false)

  // ─── Audio feedback ───────────────────────────────────────────────────────

  const triggerFlash = useCallback(() => {
    setFlashActive(true)
    setTimeout(() => setFlashActive(false), 600)
  }, [])

  // ─── Process barcode (shared by camera, manual, image) ────────────────────

  const processBarcode = useCallback(
    (decodedText: string, format: string, source: 'camera' | 'manual' | 'image') => {
      triggerFlash()

      const product = db.getProductByBarcode(decodedText)
      const record: ScanRecord = {
        id: crypto.randomUUID(),
        barcode: decodedText,
        format,
        product,
        scannedAt: new Date(),
        source,
      }

      setScanHistory((prev) => [record, ...prev])
      setSelectedScan(record)
      setShowProductModal(true)

      if (product) {
        addToast({ type: 'success', message: `Producto encontrado: ${product.name}` })
      } else {
        addToast({ type: 'warning', message: `Codigo no registrado: ${decodedText}` })
      }
    },
    [addToast, triggerFlash],
  )

  // ─── Camera scan handler ──────────────────────────────────────────────────

  const handleCameraScan = useCallback(
    (result: ScanResult) => {
      processBarcode(result.text, result.format, 'camera')
    },
    [processBarcode],
  )

  // ─── Manual barcode input ────────────────────────────────────────────────

  const handleManualSubmit = useCallback(() => {
    const trimmed = manualBarcode.trim()
    if (!trimmed) {
      addToast({ type: 'error', message: 'Ingresa un codigo de barras.' })
      return
    }
    processBarcode(trimmed, 'Manual', 'manual')
    setManualBarcode('')
    setShowManualInput(false)
  }, [manualBarcode, processBarcode, addToast])

  // ─── Scan from image file ────────────────────────────────────────────────

  const handleImageScan = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const result = await scanImage(file)
    if (result) {
      processBarcode(result.text, result.format, 'image')
    } else {
      addToast({ type: 'error', message: 'No se detecto ningun codigo en la imagen. Intenta con otra foto mas nitida.' })
    }
  }, [scanImage, processBarcode, addToast])

  // ─── Movement handler ────────────────────────────────────────────────────

  const handleRegisterMovement = () => {
    if (!selectedScan?.product) return
    const qty = parseInt(movementForm.quantity) || 0
    if (qty <= 0) {
      addToast({ type: 'error', message: 'La cantidad debe ser mayor a 0.' })
      return
    }
    if ((movementForm.type === 'salida' || movementForm.type === 'ajuste') && qty > selectedScan.product.stock_quantity) {
      addToast({ type: 'error', message: `Stock insuficiente. Solo hay ${selectedScan.product.stock_quantity} ${selectedScan.product.unit} disponibles.` })
      return
    }
    setIsSaving(true)
    try {
      db.addMovement({
        product_id: selectedScan.product.id,
        type: movementForm.type,
        quantity: qty,
        reason: movementForm.reason || null,
        reference: movementForm.reference || null,
      })
      addToast({ type: 'success', message: `Movimiento "${MOVEMENT_TYPE_LABELS[movementForm.type]}" registrado.` })
      const updated = db.getProduct(selectedScan.product.id)
      setScanHistory((prev) => prev.map((r) => (r.id === selectedScan.id ? { ...r, product: updated } : r)))
      setSelectedScan((prev) => (prev ? { ...prev, product: updated } : prev))
      setShowMovementModal(false)
      setMovementForm(DEFAULT_MOVEMENT_FORM)
    } catch (err) {
      addToast({ type: 'error', message: `Error: ${err instanceof Error ? err.message : 'desconocido'}` })
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Create product handler ──────────────────────────────────────────────

  const handleCreateProduct = () => {
    if (!newProductForm.name.trim() || !newProductForm.sku.trim()) {
      addToast({ type: 'error', message: 'El nombre y el SKU son obligatorios.' })
      return
    }
    setIsSaving(true)
    try {
      const id = db.createProduct({
        sku: newProductForm.sku,
        name: newProductForm.name,
        description: newProductForm.description || null,
        category_id: null,
        price: parseFloat(newProductForm.price) || 0,
        cost: parseFloat(newProductForm.cost) || 0,
        stock_quantity: parseInt(newProductForm.stock_quantity) || 0,
        min_stock_alert: parseInt(newProductForm.min_stock_alert) || 5,
        barcode_value: newProductForm.barcode_value || null,
        barcode_type: newProductForm.barcode_type,
        unit: newProductForm.unit,
        image_blob: null,
        is_active: 1,
      })
      const created = db.getProduct(id)
      addToast({ type: 'success', message: `Producto "${newProductForm.name}" creado.` })
      setScanHistory((prev) => prev.map((r) => (r.barcode === newProductForm.barcode_value ? { ...r, product: created } : r)))
      if (selectedScan && selectedScan.barcode === newProductForm.barcode_value) {
        setSelectedScan((prev) => (prev ? { ...prev, product: created } : prev))
      }
      setShowCreateModal(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      addToast({ type: 'error', message: msg.includes('UNIQUE') ? 'El SKU ya existe.' : msg })
    } finally {
      setIsSaving(false)
    }
  }

  const openCreateFromBarcode = (barcode: string) => {
    setNewProductForm({
      sku: barcode.slice(0, 20),
      name: '',
      description: '',
      price: '0',
      cost: '0',
      stock_quantity: '0',
      min_stock_alert: defaultMinStock,
      barcode_value: barcode,
      barcode_type: 'code128',
      unit: defaultUnit,
    })
    setShowProductModal(false)
    setShowCreateModal(true)
  }

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const sourceIcon = (source: string) => {
    if (source === 'manual') return '⌨'
    if (source === 'image') return '🖼'
    return '📷'
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Fullscreen scanner overlay */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleCameraScan}
          onClose={() => setShowScanner(false)}
          continuous
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Escanear Codigos</h1>
          <p className="text-sm text-gray-400 mt-0.5">Escanea codigos de barras y QR con camara, imagen o entrada manual</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowScanner(true)}>
            <Camera className="h-4 w-4" /> Activar camara
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Scanner area */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="!p-0 overflow-hidden relative">
            {/* Green flash overlay */}
            <div className={`pointer-events-none absolute inset-0 z-10 rounded-xl border-4 transition-all duration-150 ${flashActive ? 'border-green-400 bg-green-400/10 opacity-100' : 'border-transparent opacity-0'}`} />

            {/* Idle state */}
            <div className="flex flex-col items-center justify-center py-10 sm:py-16 px-4 sm:px-6">
              <div className="relative mb-6">
                <ScanLine className="h-20 w-20 text-copper/20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-10 w-10 rounded-full bg-copper/10 animate-ping" />
                </div>
              </div>
              <p className="text-gray-400 text-center mb-6 max-w-xs">
                Activa la camara, sube una imagen o ingresa el codigo manualmente.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button onClick={() => setShowScanner(true)} size="lg">
                  <Camera className="h-5 w-5" /> Camara
                </Button>
                <Button variant="secondary" size="lg" onClick={() => imageInputRef.current?.click()}>
                  <ImagePlus className="h-5 w-5" /> Imagen
                </Button>
                <Button variant="secondary" size="lg" onClick={() => setShowManualInput(true)}>
                  <Keyboard className="h-5 w-5" /> Manual
                </Button>
              </div>
            </div>

            {/* Recent scan summary */}
            {scanHistory.length > 0 && (
              <div className="border-t border-border px-4 py-3 bg-surface">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                  <span className="text-xs text-gray-400">{scanHistory.length} escaneado{scanHistory.length !== 1 ? 's' : ''} en esta sesion</span>
                  <span className="ml-auto text-xs text-gray-500">Ultimo: {scanHistory[0].barcode.slice(0, 20)}{scanHistory[0].barcode.length > 20 ? '...' : ''}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Tips panel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-gray-500">
            <div className="rounded-lg bg-surface border border-border px-3 py-2 text-center">Buena iluminacion</div>
            <div className="rounded-lg bg-surface border border-border px-3 py-2 text-center">Superficie plana</div>
            <div className="rounded-lg bg-surface border border-border px-3 py-2 text-center">10-20cm distancia</div>
            <div className="rounded-lg bg-surface border border-border px-3 py-2 text-center">Horizontal o vertical</div>
          </div>
        </div>

        {/* Scan history sidebar */}
        <div className="flex flex-col gap-4">
          <Card className="!p-0 flex flex-col max-h-80 sm:max-h-[520px]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Clock className="h-4 w-4 text-copper" />
              <span className="text-sm font-medium">Historial de sesion</span>
              {scanHistory.length > 0 && (
                <>
                  <span className="ml-auto text-xs text-gray-500">{scanHistory.length}</span>
                  <button onClick={() => setScanHistory([])} className="ml-1 rounded p-1 text-gray-500 hover:text-error hover:bg-error/10 transition-default" title="Limpiar historial">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>

            {scanHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <ScanLine className="h-8 w-8 text-gray-500 mb-2" />
                <p className="text-xs text-gray-500 text-center">Los codigos escaneados aparecen aqui</p>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1">
                {scanHistory.map((record) => (
                  <button key={record.id} className="w-full text-left px-4 py-3 border-b border-border/50 hover:bg-white/[0.03] transition-default flex items-start gap-3 last:border-0" onClick={() => { setSelectedScan(record); setShowProductModal(true) }}>
                    <div className="mt-0.5 shrink-0">
                      {record.product ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{record.product ? record.product.name : 'No registrado'}</p>
                      <p className="text-xs text-gray-500 font-mono truncate">{record.barcode}</p>
                      {record.format && record.format !== 'Manual' && (
                        <p className="text-[10px] text-gray-500">{record.format}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end shrink-0 mt-0.5">
                      <span className="text-[10px] text-gray-500">{formatTime(record.scannedAt)}</span>
                      <span className="text-[9px] text-gray-700">{sourceIcon(record.source)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Hidden image input */}
      <input ref={imageInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageScan} />

      {/* Manual input modal */}
      <Modal open={showManualInput} onClose={() => setShowManualInput(false)} title="Ingresar codigo manualmente" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Escribe o pega el codigo de barras del producto.</p>
          <Input
            label="Codigo de barras"
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
            placeholder="Ej: 7501234567890"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit() }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowManualInput(false)}>Cancelar</Button>
            <Button onClick={handleManualSubmit}><ScanLine className="h-4 w-4" /> Buscar</Button>
          </div>
        </div>
      </Modal>

      {/* Product found / not found modal */}
      <Modal open={showProductModal} onClose={() => setShowProductModal(false)} title={selectedScan?.product ? 'Producto encontrado' : 'Codigo no registrado'} size="md">
        {selectedScan && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-black/20 px-4 py-3 flex items-center gap-3">
              <ScanLine className="h-4 w-4 text-copper shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="font-mono text-sm text-gray-300 break-all">{selectedScan.barcode}</span>
                {selectedScan.format && selectedScan.format !== 'Manual' && (
                  <span className="ml-2 text-[10px] text-gray-500">({selectedScan.format})</span>
                )}
              </div>
            </div>

            {selectedScan.product ? (
              <>
                <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-lg leading-tight">{selectedScan.product.name}</h3>
                      <p className="font-mono text-xs text-gray-400 mt-0.5">{selectedScan.product.sku}</p>
                    </div>
                    <Badge color={selectedScan.product.stock_quantity <= 0 ? '#ef4444' : selectedScan.product.stock_quantity < selectedScan.product.min_stock_alert ? '#f59e0b' : '#22c55e'}>
                      {selectedScan.product.stock_quantity <= 0 ? 'Sin stock' : selectedScan.product.stock_quantity < selectedScan.product.min_stock_alert ? 'Stock bajo' : 'En stock'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div className="text-center rounded-lg bg-black/20 p-3">
                      <p className="text-xs text-gray-500 mb-1">Stock</p>
                      <p className={`text-lg font-bold ${selectedScan.product.stock_quantity < selectedScan.product.min_stock_alert ? 'text-amber-400' : 'text-white'}`}>{selectedScan.product.stock_quantity}</p>
                      <p className="text-[10px] text-gray-500">{selectedScan.product.unit}</p>
                    </div>
                    <div className="text-center rounded-lg bg-black/20 p-3">
                      <p className="text-xs text-gray-500 mb-1">Precio</p>
                      <p className="text-lg font-bold text-copper">{currencySymbol}{selectedScan.product.price.toFixed(2)}</p>
                    </div>
                    <div className="text-center rounded-lg bg-black/20 p-3">
                      <p className="text-xs text-gray-500 mb-1">Costo</p>
                      <p className="text-lg font-bold">{currencySymbol}{selectedScan.product.cost.toFixed(2)}</p>
                    </div>
                  </div>

                  {selectedScan.product.stock_quantity < selectedScan.product.min_stock_alert && (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Stock por debajo del minimo ({selectedScan.product.min_stock_alert} {selectedScan.product.unit})
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" onClick={() => { setMovementForm(DEFAULT_MOVEMENT_FORM); setShowMovementModal(true) }}>
                    <ArrowUpDown className="h-3.5 w-3.5" /> Registrar movimiento
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => { setShowProductModal(false); navigate(`/print?productos=${selectedScan.product!.id}`) }}>
                    <Printer className="h-3.5 w-3.5" /> Imprimir etiqueta
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setShowProductModal(false); navigate('/products') }}>
                    <Edit3 className="h-3.5 w-3.5" /> Editar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-border bg-surface p-6 flex flex-col items-center text-center gap-3">
                  <XCircle className="h-10 w-10 text-red-500" />
                  <p className="font-medium">Codigo no registrado</p>
                  <p className="text-sm text-gray-400">Este codigo no corresponde a ningun producto en la base de datos.</p>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => openCreateFromBarcode(selectedScan.barcode)}>
                    <Plus className="h-4 w-4" /> Crear producto con este codigo
                  </Button>
                  <Button variant="ghost" onClick={() => setShowProductModal(false)}>Cerrar</Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Movement modal */}
      <Modal open={showMovementModal} onClose={() => { setShowMovementModal(false); setMovementForm(DEFAULT_MOVEMENT_FORM) }} title="Registrar Movimiento" size="md">
        {selectedScan?.product && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-black/20 px-4 py-3">
              <Package className="h-4 w-4 text-copper shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{selectedScan.product.name}</p>
                <p className="text-xs text-gray-500 font-mono">{selectedScan.product.sku} · Stock actual: {selectedScan.product.stock_quantity}</p>
              </div>
            </div>

            <Select label="Tipo de movimiento" value={movementForm.type} onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value as MovementType })} options={[
              { value: 'entrada', label: 'Entrada (incrementa stock)' },
              { value: 'salida', label: 'Salida (reduce stock)' },
              { value: 'ajuste', label: 'Ajuste de inventario' },
              { value: 'devolucion', label: 'Devolucion (incrementa stock)' },
            ]} />

            <Input label="Cantidad" type="number" min="1" value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
              hint={`Stock resultante: ${(movementForm.type === 'entrada' || movementForm.type === 'devolucion') ? selectedScan.product.stock_quantity + (parseInt(movementForm.quantity) || 0) : selectedScan.product.stock_quantity - (parseInt(movementForm.quantity) || 0)} ${selectedScan.product.unit}`} />

            <Input label="Motivo (opcional)" value={movementForm.reason} onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })} placeholder="Ej: Compra proveedor, venta..." />
            <Input label="Referencia (opcional)" value={movementForm.reference} onChange={(e) => setMovementForm({ ...movementForm, reference: e.target.value })} placeholder="Ej: Factura #123..." />

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="ghost" onClick={() => { setShowMovementModal(false); setMovementForm(DEFAULT_MOVEMENT_FORM) }}>Cancelar</Button>
              <Button onClick={handleRegisterMovement} loading={isSaving}>Registrar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create product modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nuevo Producto" size="lg">
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-copper/30 bg-copper/5 px-3 py-2 text-xs text-copper">
            <ScanLine className="h-3.5 w-3.5 shrink-0" />
            Codigo pre-cargado: <span className="font-mono ml-1">{newProductForm.barcode_value}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre *" value={newProductForm.name} onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })} placeholder="Nombre del producto" autoFocus />
            <Input label="SKU *" value={newProductForm.sku} onChange={(e) => setNewProductForm({ ...newProductForm, sku: e.target.value })} placeholder="PROD-0001" />
            <div className="col-span-2">
              <Input label="Descripcion" value={newProductForm.description} onChange={(e) => setNewProductForm({ ...newProductForm, description: e.target.value })} placeholder="Descripcion opcional" />
            </div>
            <Input label="Precio" type="number" step="0.01" min="0" value={newProductForm.price} onChange={(e) => setNewProductForm({ ...newProductForm, price: e.target.value })} />
            <Input label="Costo" type="number" step="0.01" min="0" value={newProductForm.cost} onChange={(e) => setNewProductForm({ ...newProductForm, cost: e.target.value })} />
            <Input label="Stock inicial" type="number" min="0" value={newProductForm.stock_quantity} onChange={(e) => setNewProductForm({ ...newProductForm, stock_quantity: e.target.value })} />
            <Input label="Alerta stock minimo" type="number" min="0" value={newProductForm.min_stock_alert} onChange={(e) => setNewProductForm({ ...newProductForm, min_stock_alert: e.target.value })} />
            <Select label="Tipo de codigo" value={newProductForm.barcode_type} onChange={(e) => setNewProductForm({ ...newProductForm, barcode_type: e.target.value as BarcodeType })} options={[
              { value: 'code128', label: 'Code 128' },
              { value: 'ean13', label: 'EAN-13' },
              { value: 'ean8', label: 'EAN-8' },
              { value: 'upca', label: 'UPC-A' },
              { value: 'code39', label: 'Code 39' },
              { value: 'qr', label: 'QR Code' },
              { value: 'datamatrix', label: 'DataMatrix' },
            ]} />
            <Select label="Unidad" value={newProductForm.unit} onChange={(e) => setNewProductForm({ ...newProductForm, unit: e.target.value })} options={[
              { value: 'unidad', label: 'Unidad' },
              { value: 'kg', label: 'Kilogramo' },
              { value: 'lb', label: 'Libra' },
              { value: 'litro', label: 'Litro' },
              { value: 'caja', label: 'Caja' },
              { value: 'paquete', label: 'Paquete' },
            ]} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateProduct} loading={isSaving}><Plus className="h-4 w-4" /> Crear producto</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
