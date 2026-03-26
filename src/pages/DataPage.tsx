import { useState, useRef } from 'react'
import {
  Database,
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  HardDrive,
  AlertTriangle,
  CheckCircle,
  Trash2,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAppStore } from '@/store/appStore'
import { db } from '@/lib/database'
import type { Product, BarcodeType } from '@/types'

type ImportMode = 'add' | 'replace'

const VALID_BARCODE_TYPES: Set<string> = new Set(['code128', 'ean13', 'ean8', 'upca', 'code39', 'itf14', 'qr', 'datamatrix'])

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

export default function DataPage() {
  const { addToast } = useAppStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const backupInputRef = useRef<HTMLInputElement>(null)

  const [importing, setImporting] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importMode, setImportMode] = useState<ImportMode>('add')
  const [importPreview, setImportPreview] = useState<Partial<Product>[]>([])
  const [importFileName, setImportFileName] = useState('')

  const [showConfirmRestore, setShowConfirmRestore] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const currencySymbol = db.getSetting('currency_symbol') || '$'

  // ─── Export Products ────────────────────────────────────────────────────────

  const exportCSV = () => {
    const products = db.getProducts()
    if (products.length === 0) { addToast({ type: 'warning', message: 'No hay productos para exportar.' }); return }

    const headers = ['sku', 'name', 'description', 'price', 'cost', 'stock_quantity', 'min_stock_alert', 'barcode_value', 'barcode_type', 'unit']
    const rows = products.map((p) => headers.map((h) => `"${String(p[h as keyof Product] ?? '').replace(/"/g, '""')}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `productos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    addToast({ type: 'success', message: `${products.length} productos exportados a CSV.` })
  }

  const exportExcel = () => {
    const products = db.getProducts()
    if (products.length === 0) { addToast({ type: 'warning', message: 'No hay productos para exportar.' }); return }

    const headers = ['SKU', 'Nombre', 'Descripcion', 'Precio', 'Costo', 'Stock', 'Min. Stock', 'Codigo Barras', 'Tipo Codigo', 'Unidad']
    const rows = products.map((p) => [p.sku, p.name, p.description || '', p.price, p.cost, p.stock_quantity, p.min_stock_alert, p.barcode_value || '', p.barcode_type, p.unit])

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Productos')
    XLSX.writeFile(wb, `productos-${new Date().toISOString().slice(0, 10)}.xlsx`)
    addToast({ type: 'success', message: `${products.length} productos exportados a Excel.` })
  }

  // ─── Import Products ────────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFileName(file.name)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result
        let rows: Record<string, unknown>[] = []

        if (file.name.endsWith('.csv')) {
          const text = data as string
          const lines = text.split('\n').filter((l) => l.trim())
          if (lines.length < 2) { addToast({ type: 'error', message: 'El archivo CSV esta vacio.' }); return }

          // Parse CSV respecting quoted fields with commas
          const parseCSVLine = (line: string): string[] => {
            const result: string[] = []
            let current = ''
            let inQuotes = false
            for (let i = 0; i < line.length; i++) {
              const ch = line[i]
              if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
                else inQuotes = !inQuotes
              } else if (ch === ',' && !inQuotes) {
                result.push(current.trim())
                current = ''
              } else {
                current += ch
              }
            }
            result.push(current.trim())
            return result
          }

          const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase())
          rows = lines.slice(1).map((line) => {
            const values = parseCSVLine(line)
            const obj: Record<string, unknown> = {}
            headers.forEach((h, i) => { obj[h] = values[i] ?? '' })
            return obj
          })
        } else {
          const wb = XLSX.read(data, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          rows = XLSX.utils.sheet_to_json(ws)
        }

        const mapped: Partial<Product>[] = rows.map((row) => ({
          sku: String(row['sku'] || row['SKU'] || row['codigo'] || ''),
          name: String(row['name'] || row['nombre'] || row['Nombre'] || ''),
          description: String(row['description'] || row['descripcion'] || row['Descripcion'] || ''),
          price: parseFloat(String(row['price'] || row['precio'] || row['Precio'] || '0')) || 0,
          cost: parseFloat(String(row['cost'] || row['costo'] || row['Costo'] || '0')) || 0,
          stock_quantity: parseInt(String(row['stock_quantity'] || row['stock'] || row['Stock'] || '0')) || 0,
          min_stock_alert: parseInt(String(row['min_stock_alert'] || row['min_stock'] || row['Min. Stock'] || '5')) || 5,
          barcode_value: String(row['barcode_value'] || row['codigo_barras'] || row['Codigo Barras'] || '') || null,
          barcode_type: (() => {
            const raw = String(row['barcode_type'] || row['tipo_codigo'] || row['Tipo Codigo'] || 'code128').toLowerCase()
            return (VALID_BARCODE_TYPES.has(raw) ? raw : 'code128') as BarcodeType
          })(),
          unit: String(row['unit'] || row['unidad'] || row['Unidad'] || 'unidad'),
        })).filter((p) => p.sku && p.name)

        if (mapped.length === 0) { addToast({ type: 'error', message: 'No se encontraron productos validos.' }); return }

        setImportPreview(mapped)
        setShowImportModal(true)
      } catch (err) {
        addToast({ type: 'error', message: `Error leyendo archivo: ${err instanceof Error ? err.message : 'desconocido'}` })
      }
    }

    if (file.name.endsWith('.csv')) reader.readAsText(file)
    else reader.readAsArrayBuffer(file)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const executeImport = () => {
    setImporting(true)
    try {
      let created = 0, updated = 0, skipped = 0

      if (importMode === 'replace') {
        const existing = db.getProducts()
        for (const p of existing) db.deleteProduct(p.id)
      }

      for (const item of importPreview) {
        if (!item.sku || !item.name) { skipped++; continue }

        const existing = db.getProductBySku(item.sku)
        if (existing) {
          if (importMode === 'add') {
            db.updateProduct(existing.id, {
              name: item.name,
              description: item.description || null,
              price: item.price || 0,
              cost: item.cost || 0,
              stock_quantity: item.stock_quantity || 0,
              min_stock_alert: item.min_stock_alert || 5,
              barcode_value: item.barcode_value || null,
              barcode_type: item.barcode_type || 'code128',
              unit: item.unit || 'unidad',
            })
            updated++
          }
        } else {
          db.createProduct({
            sku: item.sku,
            name: item.name,
            description: item.description || null,
            category_id: null,
            price: item.price || 0,
            cost: item.cost || 0,
            stock_quantity: item.stock_quantity || 0,
            min_stock_alert: item.min_stock_alert || 5,
            barcode_value: item.barcode_value || null,
            barcode_type: item.barcode_type || 'code128',
            unit: item.unit || 'unidad',
            image_blob: null,
            is_active: 1,
          })
          created++
        }
      }

      addToast({ type: 'success', message: `Importacion completa: ${created} creados, ${updated} actualizados, ${skipped} omitidos.` })
      setShowImportModal(false)
      setImportPreview([])
    } catch (err) {
      addToast({ type: 'error', message: `Error importando: ${err instanceof Error ? err.message : 'desconocido'}` })
    } finally {
      setImporting(false)
    }
  }

  // ─── Backup / Restore ───────────────────────────────────────────────────────

  const handleBackup = () => {
    const data = db.exportDatabase()
    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `labelcraft-backup-${new Date().toISOString().slice(0, 10)}.db`
    a.click()
    URL.revokeObjectURL(url)
    addToast({ type: 'success', message: `Backup descargado (${formatBytes(data.length)}).` })
  }

  const handleRestoreSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRestoreFile(file)
    setShowConfirmRestore(true)
    if (backupInputRef.current) backupInputRef.current.value = ''
  }

  const executeRestore = async () => {
    if (!restoreFile) return
    try {
      const buffer = await restoreFile.arrayBuffer()
      await db.importDatabase(buffer)
      addToast({ type: 'success', message: 'Base de datos restaurada. Recarga la pagina para ver los cambios.' })
      setShowConfirmRestore(false)
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      addToast({ type: 'error', message: `Error restaurando: ${err instanceof Error ? err.message : 'desconocido'}` })
    }
  }

  const dbSize = formatBytes(db.getDatabaseSize())

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Importar / Exportar</h1>
        <p className="text-sm text-gray-400 mt-0.5">Gestiona tus datos y backups de la base de datos</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Export */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Download className="h-5 w-5 text-copper" />
            <h2 className="font-semibold">Exportar Productos</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">Descarga todos tus productos en formato CSV o Excel.</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={exportCSV}><FileText className="h-4 w-4" /> Exportar CSV</Button>
            <Button variant="secondary" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Exportar Excel</Button>
          </div>
        </Card>

        {/* Import */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Upload className="h-5 w-5 text-copper" />
            <h2 className="font-semibold">Importar Productos</h2>
          </div>
          <p className="text-sm text-gray-400 mb-2">Importa productos desde un archivo CSV o Excel (.xlsx).</p>
          <p className="text-xs text-gray-500 mb-4">Columnas requeridas: <span className="font-mono text-copper">sku</span>, <span className="font-mono text-copper">name</span>. Opcionales: description, price, cost, stock_quantity, barcode_value, unit.</p>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
          <Button onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" /> Seleccionar archivo</Button>
        </Card>

        {/* Backup */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="h-5 w-5 text-copper" />
            <h2 className="font-semibold">Backup de Base de Datos</h2>
          </div>
          <p className="text-sm text-gray-400 mb-2">Descarga una copia completa de tu base de datos SQLite.</p>
          <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 mb-4 text-xs text-gray-500">
            <Database className="h-3.5 w-3.5" /> Tamanio actual: <span className="font-medium text-white">{dbSize}</span>
          </div>
          <Button variant="secondary" onClick={handleBackup}><Download className="h-4 w-4" /> Descargar Backup</Button>
        </Card>

        {/* Restore */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Upload className="h-5 w-5 text-copper" />
            <h2 className="font-semibold">Restaurar Base de Datos</h2>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-error/10 border border-error/20 px-3 py-2 mb-4 text-xs text-error">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Esto reemplazara TODOS los datos actuales.
          </div>
          <input ref={backupInputRef} type="file" accept=".db,.sqlite" onChange={handleRestoreSelect} className="hidden" />
          <Button variant="danger" onClick={() => backupInputRef.current?.click()}><Upload className="h-4 w-4" /> Restaurar desde archivo</Button>
        </Card>

        {/* Optimize */}
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Trash2 className="h-5 w-5 text-copper" />
            <h2 className="font-semibold">Mantenimiento</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">Optimiza la base de datos para mejorar el rendimiento y reducir el tamanio.</p>
          <Button variant="ghost" onClick={() => { db.vacuum(); addToast({ type: 'success', message: 'Base de datos optimizada.' }) }}>
            Optimizar (VACUUM)
          </Button>
        </Card>
      </div>

      {/* Import Preview Modal */}
      <Modal open={showImportModal} onClose={() => { setShowImportModal(false); setImportPreview([]) }} title="Importar Productos" size="lg">
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-copper/5 border border-copper/20 px-3 py-2 text-xs text-copper">
            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
            {importFileName} — {importPreview.length} productos encontrados
          </div>

          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={importMode === 'add'} onChange={() => setImportMode('add')} className="accent-copper" />
              <span className="text-gray-300">Agregar / actualizar existentes</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} className="accent-copper" />
              <span className="text-gray-300">Reemplazar todo</span>
            </label>
          </div>

          {importMode === 'replace' && (
            <div className="flex items-center gap-2 rounded-lg bg-error/10 border border-error/20 px-3 py-2 text-xs text-error">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Esto eliminara TODOS los productos actuales antes de importar.
            </div>
          )}

          <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface"><tr className="border-b border-border text-xs text-gray-400">
                <th className="px-3 py-2 text-left font-medium">SKU</th><th className="px-3 py-2 text-left font-medium">Nombre</th>
                <th className="px-3 py-2 text-right font-medium">Precio</th><th className="px-3 py-2 text-right font-medium">Stock</th>
              </tr></thead>
              <tbody>{importPreview.slice(0, 50).map((p, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2 font-mono text-xs text-gray-400">{p.sku}</td>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 text-right text-copper">{currencySymbol}{(p.price || 0).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{p.stock_quantity || 0}</td>
                </tr>
              ))}</tbody>
            </table>
            {importPreview.length > 50 && <p className="text-center text-xs text-gray-500 py-2">... y {importPreview.length - 50} mas</p>}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setShowImportModal(false); setImportPreview([]) }}>Cancelar</Button>
            <Button onClick={executeImport} loading={importing}><CheckCircle className="h-4 w-4" /> Importar {importPreview.length} productos</Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Restore Modal */}
      <Modal open={showConfirmRestore} onClose={() => setShowConfirmRestore(false)} title="Confirmar Restauracion" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Esta accion es irreversible.</p>
              <p className="text-xs mt-1">Todos los datos actuales seran reemplazados por el backup seleccionado.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowConfirmRestore(false)}>Cancelar</Button>
            <Button variant="danger" onClick={executeRestore}><Upload className="h-4 w-4" /> Restaurar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
