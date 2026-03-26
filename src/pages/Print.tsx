import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Printer,
  Search,
  CheckSquare,
  Square,
  X,
  Download,
  FileText,
  Clock,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Layers,
  Check,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useAppStore } from '@/store/appStore'
import { db } from '@/lib/database'
import { generateBarcodeDataURL } from '@/lib/barcode'
import type { Product, LabelTemplate, PaperSize, PrintHistory, BarcodeType, CanvasElement } from '@/types'

interface PrintItem {
  product: Product
  quantity: number
}

interface PreviewLabel {
  product: Product
  col: number
  row: number
  page: number
}

// ─── Auto-pack layout calculator ──────────────────────────────────────────────

function getPaperDimensions(paperSize: PaperSize | 'a4' | 'letter'): { w: number; h: number } {
  if (paperSize === 'a4') return { w: 210, h: 297 }
  if (paperSize === 'letter') return { w: 216, h: 279 }
  return { w: 210, h: 297 } // default to A4 for custom/rollo_continuo
}

function calculateAutoPackLayout(template: LabelTemplate, overridePaper?: 'a4' | 'letter') {
  const paper = getPaperDimensions(overridePaper ?? template.paper_size)
  const availW = paper.w - template.margin_left_mm * 2
  const availH = paper.h - template.margin_top_mm * 2
  const maxCols = Math.max(1, Math.floor((availW + template.gap_x_mm) / (template.width_mm + template.gap_x_mm)))
  const maxRows = Math.max(1, Math.floor((availH + template.gap_y_mm) / (template.height_mm + template.gap_y_mm)))
  return { columns: maxCols, rows: maxRows }
}

// ─── PDF rendering helpers ──────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0]
}

function mapFont(family: string): string {
  const f = family.toLowerCase()
  if (f.includes('courier') || f.includes('mono') || f.includes('jetbrains')) return 'courier'
  if (f.includes('times') || f.includes('serif')) return 'times'
  return 'helvetica'
}

function mapFontStyle(weight: string, style: string): string {
  const isBold = weight === 'bold' || parseInt(weight) >= 700
  const isItalic = style === 'italic'
  if (isBold && isItalic) return 'bolditalic'
  if (isBold) return 'bold'
  if (isItalic) return 'italic'
  return 'normal'
}

function substituteText(text: string, product: Product, currencySymbol: string): string {
  return text
    .replace(/\{\{product\.name\}\}/g, product.name)
    .replace(/\{\{product\.sku\}\}/g, product.sku)
    .replace(/\{\{product\.price\}\}/g, `${currencySymbol}${product.price.toFixed(2)}`)
    .replace(/\{\{product\.barcode\}\}/g, product.barcode_value || '')
    .replace(/\{\{product\.description\}\}/g, product.description || '')
    .replace(/\{\{product\.stock\}\}/g, String(product.stock_quantity))
    .replace(/\{\{price\}\}/g, product.price.toFixed(2))
}

// ─── PDF generation ────────────────────────────────────────────────────────────

async function generatePDF(
  template: LabelTemplate,
  items: PrintItem[],
  onProgress: (pct: number) => void,
  currencySymbol: string,
): Promise<jsPDF> {
  const paperW = template.paper_size === 'a4' ? 210 : template.paper_size === 'letter' ? 216 : 210
  const paperH = template.paper_size === 'a4' ? 297 : template.paper_size === 'letter' ? 279 : 297

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [paperW, paperH] })

  const { columns: cols, rows, margin_top_mm: mTop, margin_left_mm: mLeft,
    gap_x_mm: gapX, gap_y_mm: gapY, width_mm: labelW, height_mm: labelH } = template
  const labelsPerPage = cols * rows

  // Parse canvas elements from template design
  let elements: CanvasElement[] = []
  let bgColor = '#FFFFFF'
  try {
    const parsed = JSON.parse(template.canvas_json)
    if (parsed && Array.isArray(parsed.elements)) {
      elements = [...parsed.elements].sort((a: CanvasElement, b: CanvasElement) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    }
    if (typeof parsed.backgroundColor === 'string') bgColor = parsed.backgroundColor
  } catch { /* fallback to basic layout */ }

  // Expand items into individual labels
  const allLabels: Product[] = []
  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) allLabels.push(item.product)
  }

  for (let li = 0; li < allLabels.length; li++) {
    const product = allLabels[li]
    const posOnPage = li % labelsPerPage
    if (posOnPage === 0 && li > 0) pdf.addPage([paperW, paperH])

    const col = posOnPage % cols
    const row = Math.floor(posOnPage / cols)
    const x = mLeft + col * (labelW + gapX)
    const y = mTop + row * (labelH + gapY)

    if (elements.length === 0) {
      // Fallback: basic layout when template has no canvas elements
      pdf.setDrawColor(200); pdf.setLineWidth(0.2); pdf.rect(x, y, labelW, labelH)
      pdf.setFontSize(Math.min(10, labelW / 5)); pdf.setTextColor(30)
      pdf.text(pdf.splitTextToSize(product.name, labelW - 4).slice(0, 2), x + 2, y + 5)
      pdf.setFontSize(6); pdf.setTextColor(120); pdf.text(product.sku, x + 2, y + labelH - 8)
      pdf.setFontSize(9); pdf.setTextColor(196, 122, 58)
      pdf.text(`${currencySymbol}${product.price.toFixed(2)}`, x + labelW - 3, y + labelH - 3, { align: 'right' })
      if (product.barcode_value) {
        try {
          const bcType = (product.barcode_type || 'code128') as BarcodeType
          const is2D = bcType === 'qr' || bcType === 'datamatrix'
          const dataUrl = await generateBarcodeDataURL(product.barcode_value, bcType, {
            height: is2D ? undefined : Math.max(6, Math.round(labelH * 0.3)), scale: 2,
          })
          const bcH = is2D ? Math.min(labelW - 4, labelH * 0.4) : 8
          const bcW = is2D ? bcH : labelW - 4
          pdf.addImage(dataUrl, 'PNG', x + (labelW - bcW) / 2, y + labelH - bcH - (is2D ? 2 : 5), bcW, bcH)
        } catch {
          pdf.setFontSize(5); pdf.setTextColor(80)
          pdf.text(product.barcode_value, x + labelW / 2, y + labelH - 8, { align: 'center' })
        }
      }
    } else {
      // Canvas-based rendering: render each element from the template design
      if (bgColor !== '#FFFFFF' && bgColor !== '#ffffff' && bgColor !== 'white') {
        pdf.setFillColor(...hexToRgb(bgColor)); pdf.rect(x, y, labelW, labelH, 'F')
      }

      for (const el of elements) {
        const ex = x + el.x, ey = y + el.y, ew = el.width, eh = el.height
        const p = el.properties as Record<string, unknown>

        switch (el.type) {
          case 'text': case 'dynamic_text': {
            let text = (p.text as string) || ''
            if (el.type === 'dynamic_text') text = substituteText(text, product, currencySymbol)
            const fontSize = (p.fontSize as number) || 12
            const fontPt = fontSize * 0.75
            const fontMm = fontSize / 3.78
            const [r, g, b] = hexToRgb((p.color as string) || '#000000')
            pdf.setFont(mapFont((p.fontFamily as string) || 'Inter'), mapFontStyle((p.fontWeight as string) || 'normal', (p.fontStyle as string) || 'normal'))
            pdf.setFontSize(fontPt)
            pdf.setTextColor(r, g, b)
            const align = (p.textAlign as string) || 'left'
            const tx = align === 'center' ? ex + ew / 2 : align === 'right' ? ex + ew : ex
            const lines = pdf.splitTextToSize(text, ew)
            const maxLines = Math.max(1, Math.floor(eh / fontMm))
            pdf.text(lines.slice(0, maxLines), tx, ey + fontMm * 0.75, { align: align as 'left' | 'center' | 'right' })
            break
          }
          case 'price': {
            const fontSize = (p.fontSize as number) || 18
            const fontPt = fontSize * 0.75
            const fontMm = fontSize / 3.78
            const symbol = (p.currencySymbol as string) || currencySymbol
            const [r, g, b] = hexToRgb((p.color as string) || '#000000')
            pdf.setFont(mapFont((p.fontFamily as string) || 'Inter'), 'bold')
            pdf.setFontSize(fontPt)
            pdf.setTextColor(r, g, b)
            pdf.text(`${symbol}${product.price.toFixed(2)}`, ex, ey + fontMm * 0.75)
            break
          }
          case 'barcode': {
            let bVal = (p.value as string) || ''
            bVal = substituteText(bVal, product, currencySymbol)
            if (!bVal && product.barcode_value) bVal = product.barcode_value
            const bType = (p.barcodeType as BarcodeType) || 'code128'
            if (bVal) {
              try {
                const dataUrl = await generateBarcodeDataURL(bVal, bType, { height: Math.max(6, Math.round(eh * 3)), scale: 2 })
                pdf.addImage(dataUrl, 'PNG', ex, ey, ew, eh)
              } catch {
                pdf.setFontSize(5); pdf.setTextColor(120, 120, 120)
                pdf.text(bVal, ex + ew / 2, ey + eh / 2, { align: 'center' })
              }
            }
            break
          }
          case 'qr': case 'datamatrix': {
            let val = (p.value as string) || ''
            val = substituteText(val, product, currencySymbol)
            if (!val && product.barcode_value) val = product.barcode_value
            const qType: BarcodeType = el.type === 'qr' ? 'qr' : 'datamatrix'
            if (val) {
              try {
                const dataUrl = await generateBarcodeDataURL(val, qType, { scale: 4 })
                pdf.addImage(dataUrl, 'PNG', ex, ey, ew, eh)
              } catch {
                pdf.setFontSize(5); pdf.setTextColor(120, 120, 120)
                pdf.text(el.type.toUpperCase(), ex + ew / 2, ey + eh / 2, { align: 'center' })
              }
            }
            break
          }
          case 'rectangle': {
            const fill = p.fill as string, stroke = (p.stroke as string) || '#000000'
            const sw = ((p.strokeWidth as number) || 1) * 0.26
            if (fill && fill !== 'transparent') { pdf.setFillColor(...hexToRgb(fill)); pdf.rect(ex, ey, ew, eh, 'F') }
            pdf.setDrawColor(...hexToRgb(stroke)); pdf.setLineWidth(sw); pdf.rect(ex, ey, ew, eh, 'S')
            break
          }
          case 'line': {
            const stroke = (p.stroke as string) || '#000000', sw = ((p.strokeWidth as number) || 1) * 0.26
            pdf.setDrawColor(...hexToRgb(stroke)); pdf.setLineWidth(sw); pdf.line(ex, ey + eh / 2, ex + ew, ey + eh / 2)
            break
          }
          case 'circle': {
            const fill = p.fill as string, stroke = (p.stroke as string) || '#000000'
            const sw = ((p.strokeWidth as number) || 1) * 0.26
            if (fill && fill !== 'transparent') { pdf.setFillColor(...hexToRgb(fill)); pdf.ellipse(ex + ew / 2, ey + eh / 2, ew / 2, eh / 2, 'F') }
            pdf.setDrawColor(...hexToRgb(stroke)); pdf.setLineWidth(sw); pdf.ellipse(ex + ew / 2, ey + eh / 2, ew / 2, eh / 2, 'S')
            break
          }
          case 'image': {
            const src = p.src as string
            if (src?.startsWith('data:')) { try { pdf.addImage(src, 'PNG', ex, ey, ew, eh) } catch { /* skip */ } }
            break
          }
        }
      }
    }

    onProgress(Math.round(((li + 1) / allLabels.length) * 100))
    if (li % 50 === 0) await new Promise((r) => setTimeout(r, 0))
  }

  return pdf
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Print() {
  const { addToast } = useAppStore()
  const [searchParams] = useSearchParams()

  const [templates, setTemplates] = useState<LabelTemplate[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [history, setHistory] = useState<PrintHistory[]>([])
  const [currencySymbol, setCurrencySymbol] = useState('$')

  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<LabelTemplate | null>(null)
  const [selectedItems, setSelectedItems] = useState<Map<string, PrintItem>>(new Map())
  const [globalQty, setGlobalQty] = useState(1)
  const [useGlobalQty, setUseGlobalQty] = useState(true)

  // Auto-pack state
  const [autoPackEnabled, setAutoPackEnabled] = useState(false)
  const [autoPackPaperSize, setAutoPackPaperSize] = useState<'a4' | 'letter'>('a4')

  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generatedPdf, setGeneratedPdf] = useState<jsPDF | null>(null)

  const [showPreview, setShowPreview] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [productSearch, setProductSearch] = useState('')

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Effective template: applies auto-pack overrides without modifying the original
  const effectiveTemplate = useMemo<LabelTemplate | null>(() => {
    if (!selectedTemplate) return null
    if (!autoPackEnabled) return selectedTemplate

    const needsPaperOverride = selectedTemplate.paper_size === 'custom' || selectedTemplate.paper_size === 'rollo_continuo'
    const paperOverride = needsPaperOverride ? autoPackPaperSize : undefined
    const layout = calculateAutoPackLayout(selectedTemplate, paperOverride)

    return {
      ...selectedTemplate,
      columns: layout.columns,
      rows: layout.rows,
      paper_size: needsPaperOverride ? autoPackPaperSize : selectedTemplate.paper_size,
    }
  }, [selectedTemplate, autoPackEnabled, autoPackPaperSize])

  useEffect(() => {
    setTemplates(db.getTemplates())
    setHistory(db.getPrintHistory(20))
    setCurrencySymbol(db.getSetting('currency_symbol') || '$')

    // Auto-select products from URL params (from Products bulk print)
    const productIdsParam = searchParams.get('productos')
    if (productIdsParam) {
      const ids = productIdsParam.split(',').filter(Boolean)
      const items = new Map<string, PrintItem>()
      for (const id of ids) {
        const product = db.getProduct(id)
        if (product) items.set(product.id, { product, quantity: 1 })
      }
      if (items.size > 0) setSelectedItems(items)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      setProducts(db.getProducts({ search: productSearch || undefined, activeOnly: true }))
    }, 200)
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current) }
  }, [productSearch])

  useEffect(() => {
    setSelectedTemplate(selectedTemplateId ? db.getTemplate(selectedTemplateId) : null)
  }, [selectedTemplateId])

  useEffect(() => {
    if (!useGlobalQty) return
    setSelectedItems((prev) => {
      const next = new Map(prev)
      for (const [, item] of next) {
        next.set(item.product.id, { ...item, quantity: globalQty })
      }
      return next
    })
  }, [globalQty, useGlobalQty])

  // Clear generated PDF when auto-pack settings change
  useEffect(() => {
    setGeneratedPdf(null)
  }, [autoPackEnabled, autoPackPaperSize])

  const toggleProduct = useCallback((product: Product) => {
    setSelectedItems((prev) => {
      const next = new Map(prev)
      if (next.has(product.id)) next.delete(product.id)
      else next.set(product.id, { product, quantity: globalQty })
      return next
    })
  }, [globalQty])

  const selectAll = useCallback(() => {
    const next = new Map<string, PrintItem>()
    for (const p of products) next.set(p.id, { product: p, quantity: globalQty })
    setSelectedItems(next)
  }, [products, globalQty])

  const clearAll = useCallback(() => setSelectedItems(new Map()), [])

  const setItemQty = useCallback((productId: string, qty: number) => {
    setSelectedItems((prev) => {
      const next = new Map(prev)
      const item = next.get(productId)
      if (item) next.set(productId, { ...item, quantity: Math.max(1, qty) })
      return next
    })
  }, [])

  // Use effectiveTemplate for all layout calculations
  const totalLabels = Array.from(selectedItems.values()).reduce((sum, i) => sum + i.quantity, 0)
  const labelsPerPage = effectiveTemplate ? effectiveTemplate.columns * effectiveTemplate.rows : 0
  const totalPages = labelsPerPage > 0 ? Math.ceil(totalLabels / labelsPerPage) : 0

  // Original pages (without auto-pack) for comparison
  const originalLabelsPerPage = selectedTemplate ? selectedTemplate.columns * selectedTemplate.rows : 0
  const originalTotalPages = originalLabelsPerPage > 0 ? Math.ceil(totalLabels / originalLabelsPerPage) : 0

  const previewLabels: PreviewLabel[] = (() => {
    if (!effectiveTemplate || selectedItems.size === 0) return []
    const cols = effectiveTemplate.columns
    const rows = effectiveTemplate.rows
    const labPP = cols * rows
    const result: PreviewLabel[] = []
    let idx = 0
    for (const item of selectedItems.values()) {
      for (let q = 0; q < item.quantity; q++) {
        const page = Math.floor(idx / labPP)
        const posOnPage = idx % labPP
        result.push({ product: item.product, col: posOnPage % cols, row: Math.floor(posOnPage / cols), page })
        idx++
      }
    }
    return result.slice(0, labelsPerPage * 2)
  })()

  const handleGenerate = useCallback(async () => {
    if (!effectiveTemplate) { addToast({ type: 'warning', message: 'Selecciona una plantilla primero.' }); return }
    if (selectedItems.size === 0) { addToast({ type: 'warning', message: 'Selecciona al menos un producto.' }); return }

    setGenerating(true)
    setProgress(0)
    setGeneratedPdf(null)

    try {
      const items = Array.from(selectedItems.values())
      const pdf = await generatePDF(effectiveTemplate, items, setProgress, currencySymbol)
      setGeneratedPdf(pdf)

      const productIds = items.map((i) => i.product.id)
      db.addPrintRecord(selectedTemplate?.id ?? '', productIds, totalLabels)
      setHistory(db.getPrintHistory(20))

      addToast({ type: 'success', message: `PDF generado: ${totalLabels} etiquetas en ${totalPages} paginas.` })
    } catch (err) {
      console.error(err)
      addToast({ type: 'error', message: 'Error al generar el PDF.' })
    } finally {
      setGenerating(false)
      setProgress(100)
    }
  }, [effectiveTemplate, selectedTemplate, selectedItems, totalLabels, totalPages, currencySymbol, addToast])

  const handleDownload = useCallback(() => {
    if (!generatedPdf) return
    generatedPdf.save(`${selectedTemplate?.name ?? 'etiquetas'}-${new Date().toISOString().slice(0, 10)}.pdf`)
    addToast({ type: 'success', message: 'PDF descargado.' })
  }, [generatedPdf, selectedTemplate, addToast])

  const handlePrint = useCallback(() => {
    if (!generatedPdf) { addToast({ type: 'warning', message: 'Genera el PDF primero.' }); return }
    const blob = generatedPdf.output('blob')
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (win) { win.onload = () => { win.print(); URL.revokeObjectURL(url) } }
    else { addToast({ type: 'error', message: 'Activa las ventanas emergentes para imprimir.' }); URL.revokeObjectURL(url) }
  }, [generatedPdf, addToast])

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-copper/10">
            <Printer className="h-5 w-5 text-copper" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Impresion por Lotes</h1>
            <p className="text-sm text-gray-400">Genera PDFs con multiples etiquetas</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)}>
          <Clock className="h-4 w-4" /> Historial
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">

          {/* Step 1: Template — Visual Card Selector */}
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-copper text-xs font-bold text-white">1</span>
              <h2 className="font-semibold">Seleccionar plantilla</h2>
            </div>
            {templates.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/5 p-4 text-sm text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0" /> No hay plantillas. Crea una en el Editor primero.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {templates.map((t) => {
                  const isSelected = selectedTemplateId === t.id
                  const perPage = t.columns * t.rows
                  const maxDim = 44
                  const aspect = t.width_mm / t.height_mm
                  const pw = aspect >= 1 ? maxDim : Math.round(maxDim * aspect)
                  const ph = aspect >= 1 ? Math.round(maxDim / aspect) : maxDim

                  return (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTemplateId(t.id); setGeneratedPdf(null) }}
                      className={`group relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200
                        ${isSelected
                          ? 'border-copper bg-copper/5'
                          : 'border-border bg-surface hover:border-gray-600 hover:bg-white/5'
                        }`}
                    >
                      {/* Proportional mini-preview */}
                      <div
                        className={`flex items-center justify-center rounded border-2 border-dashed
                          ${isSelected ? 'border-copper/60 bg-copper/10' : 'border-gray-600 bg-background'}`}
                        style={{ width: pw, height: ph }}
                      >
                        <span className="text-[8px] text-gray-500">{t.width_mm}x{t.height_mm}</span>
                      </div>

                      <p className={`text-sm font-medium truncate w-full text-center ${isSelected ? 'text-copper' : 'text-white'}`}>
                        {t.name}
                      </p>

                      <div className="flex flex-wrap items-center justify-center gap-1">
                        <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-mono text-gray-400">
                          {t.width_mm}x{t.height_mm}mm
                        </span>
                        <span className="rounded bg-background px-1.5 py-0.5 text-[10px] text-gray-500">
                          {t.columns}x{t.rows}
                        </span>
                      </div>

                      <span className={`text-[10px] ${isSelected ? 'text-copper' : 'text-gray-500'}`}>
                        {perPage} por pagina · {t.paper_size.toUpperCase()}
                      </span>

                      {isSelected && (
                        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-copper">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Selected template summary */}
            {selectedTemplate && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <strong className="text-white">{selectedTemplate.name}</strong>
                  {' — '}{selectedTemplate.width_mm}x{selectedTemplate.height_mm}mm, grilla {selectedTemplate.columns}x{selectedTemplate.rows}, {selectedTemplate.paper_size.toUpperCase()}
                </span>
              </div>
            )}
          </Card>

          {/* Step 2: Products */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-copper text-xs font-bold text-white">2</span>
                <h2 className="font-semibold">Seleccionar productos</h2>
                {selectedItems.size > 0 && <Badge color="#D4894A">{selectedItems.size} sel.</Badge>}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}><CheckSquare className="h-3.5 w-3.5" /> Todos</Button>
                <Button variant="ghost" size="sm" onClick={clearAll}><X className="h-3.5 w-3.5" /> Ninguno</Button>
              </div>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input type="text" placeholder="Buscar por nombre, SKU o codigo..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 transition-colors focus:border-copper/50 focus:outline-none" />
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              {products.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">No se encontraron productos</div>
              ) : products.map((product) => {
                const isSelected = selectedItems.has(product.id)
                const item = selectedItems.get(product.id)
                return (
                  <div key={product.id} className={`flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 transition-colors ${isSelected ? 'bg-copper/5' : 'hover:bg-white/5'}`}>
                    <button onClick={() => toggleProduct(product)} className="shrink-0 text-gray-400 hover:text-copper transition-colors">
                      {isSelected ? <CheckSquare className="h-4 w-4 text-copper" /> : <Square className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{product.name}</p>
                      <p className="text-xs text-gray-500">SKU: {product.sku}{product.barcode_value && ` · ${product.barcode_value}`}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">{currencySymbol}{product.price.toFixed(2)}</span>
                    {isSelected && !useGlobalQty && (
                      <input type="number" min={1} max={9999} value={item?.quantity ?? 1}
                        onChange={(e) => setItemQty(product.id, parseInt(e.target.value) || 1)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-14 rounded border border-border bg-background px-2 py-1 text-center text-sm text-white focus:border-copper/50 focus:outline-none" />
                    )}
                    {isSelected && useGlobalQty && (
                      <span className="w-14 rounded border border-copper/20 bg-copper/5 px-2 py-1 text-center text-sm text-copper">x{item?.quantity ?? globalQty}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Step 3: Quantity + Auto-pack */}
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-copper text-xs font-bold text-white">3</span>
              <h2 className="font-semibold">Configurar cantidad</h2>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={useGlobalQty} onChange={(e) => setUseGlobalQty(e.target.checked)} className="h-4 w-4 rounded accent-copper" />
                <span className="text-gray-300">Cantidad global para todos</span>
              </label>
              {useGlobalQty && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Cantidad:</span>
                  <input type="number" min={1} max={9999} value={globalQty} onChange={(e) => setGlobalQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-center text-sm text-white focus:border-copper/50 focus:outline-none" />
                  <span className="text-sm text-gray-500">por producto</span>
                </div>
              )}
            </div>

            {/* Auto-pack toggle */}
            {selectedTemplate && (
              <div className="mt-4 rounded-lg border border-border bg-background p-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={autoPackEnabled}
                    onChange={(e) => setAutoPackEnabled(e.target.checked)}
                    className="h-4 w-4 rounded accent-copper"
                  />
                  <div>
                    <span className="text-sm font-medium text-white">Agrupar en una hoja</span>
                    <p className="text-xs text-gray-500">Calcula automaticamente cuantas etiquetas caben por pagina</p>
                  </div>
                </label>

                {autoPackEnabled && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-lg bg-copper/5 border border-copper/20 px-3 py-2">
                      <Layers className="h-4 w-4 text-copper" />
                      <span className="text-sm text-copper font-medium">
                        {effectiveTemplate?.columns} col x {effectiveTemplate?.rows} filas = {(effectiveTemplate?.columns ?? 0) * (effectiveTemplate?.rows ?? 0)} por pagina
                      </span>
                    </div>

                    {(selectedTemplate.paper_size === 'custom' || selectedTemplate.paper_size === 'rollo_continuo') && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Papel:</span>
                        <select
                          value={autoPackPaperSize}
                          onChange={(e) => setAutoPackPaperSize(e.target.value as 'a4' | 'letter')}
                          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-white"
                        >
                          <option value="a4">A4 (210x297mm)</option>
                          <option value="letter">Letter (216x279mm)</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedItems.size > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-background p-3 text-center">
                  <p className="text-xs text-gray-500">Productos</p>
                  <p className="text-xl font-bold text-white">{selectedItems.size}</p>
                </div>
                <div className="rounded-lg bg-background p-3 text-center">
                  <p className="text-xs text-gray-500">Etiquetas</p>
                  <p className="text-xl font-bold text-copper">{totalLabels}</p>
                </div>
                <div className="rounded-lg bg-background p-3 text-center">
                  <p className="text-xs text-gray-500">Paginas PDF</p>
                  <p className="text-xl font-bold text-white">{totalPages || '—'}</p>
                  {autoPackEnabled && totalLabels > 0 && originalTotalPages !== totalPages && (
                    <p className="text-[10px] text-copper">antes: {originalTotalPages} pag.</p>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Step 4: Preview */}
          {effectiveTemplate && selectedItems.size > 0 && (
            <Card>
              <button onClick={() => setShowPreview((v) => !v)} className="flex w-full items-center justify-between text-left">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-copper text-xs font-bold text-white">4</span>
                  <h2 className="font-semibold">Vista previa</h2>
                  <Badge color="#D4894A" variant="outline">{Math.min(previewLabels.length, labelsPerPage * 2)} etiquetas</Badge>
                </div>
                {showPreview ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>
              {showPreview && (
                <div className="mt-4">
                  <PreviewGrid template={effectiveTemplate} labels={previewLabels} currencySymbol={currencySymbol} />
                </div>
              )}
            </Card>
          )}
        </div>

        {/* RIGHT: Actions */}
        <div className="flex flex-col gap-4">
          <Card className="xl:sticky xl:top-4">
            <h2 className="mb-4 font-semibold">Generar e Imprimir</h2>
            {!selectedTemplateId && <p className="mb-3 text-xs text-gray-500">Selecciona una plantilla para continuar.</p>}
            {selectedTemplateId && selectedItems.size === 0 && <p className="mb-3 text-xs text-gray-500">Selecciona al menos un producto.</p>}

            <Button className="w-full" size="lg" onClick={handleGenerate} disabled={generating || !selectedTemplateId || selectedItems.size === 0} loading={generating}>
              {generating ? `Generando... ${progress}%` : <><FileText className="h-4 w-4" /> Generar PDF ({totalLabels} etiq.)</>}
            </Button>

            {generating && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Progreso</span><span>{progress}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-copper transition-all duration-150" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {generatedPdf && !generating && (
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 rounded-lg bg-success/5 px-3 py-2 text-xs text-success">
                  <FileText className="h-3.5 w-3.5 shrink-0" /> PDF listo — {totalLabels} etiquetas, {totalPages} pag.
                </div>
                <Button variant="secondary" className="w-full" onClick={handleDownload}><Download className="h-4 w-4" /> Descargar PDF</Button>
                <Button variant="ghost" className="w-full" onClick={handlePrint}><Printer className="h-4 w-4" /> Imprimir ahora</Button>
                <Button variant="ghost" size="sm" className="w-full text-gray-500" onClick={() => { setGeneratedPdf(null); setProgress(0) }}>
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerar
                </Button>
              </div>
            )}

            {effectiveTemplate && (
              <div className="mt-6 border-t border-border pt-4">
                <p className="mb-2 text-xs font-medium text-gray-400">Detalles de layout</p>
                <div className="space-y-1.5 text-xs text-gray-500">
                  {[
                    { label: 'Papel', value: effectiveTemplate.paper_size.toUpperCase() },
                    { label: 'Grilla', value: autoPackEnabled
                      ? `${effectiveTemplate.columns} col x ${effectiveTemplate.rows} fila (auto)`
                      : `${effectiveTemplate.columns} col x ${effectiveTemplate.rows} fila` },
                    { label: 'Margen sup.', value: `${effectiveTemplate.margin_top_mm} mm` },
                    { label: 'Margen izq.', value: `${effectiveTemplate.margin_left_mm} mm` },
                    { label: 'Gap X / Y', value: `${effectiveTemplate.gap_x_mm} / ${effectiveTemplate.gap_y_mm} mm` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between"><span>{label}</span><span className="text-gray-300">{value}</span></div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* History Modal */}
      <Modal open={showHistory} onClose={() => setShowHistory(false)} title="Historial de impresion" size="lg">
        {history.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Aun no hay registros.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-xs text-gray-400">
                <th className="pb-2 text-left font-medium">Fecha</th><th className="pb-2 text-right font-medium">Etiquetas</th><th className="pb-2 text-right font-medium">Estado</th>
              </tr></thead>
              <tbody>{history.map((h) => {
                const date = new Date(h.printed_at)
                const formatted = isNaN(date.getTime()) ? h.printed_at : date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                return (
                  <tr key={h.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 text-gray-400 text-xs">{formatted}</td>
                    <td className="py-2 text-right font-medium text-white">{h.quantity}</td>
                    <td className="py-2 text-right">
                      <Badge color={h.status === 'completed' ? '#4ADE80' : h.status === 'error' ? '#F87171' : '#FBBF24'}>
                        {h.status === 'completed' ? 'OK' : h.status === 'error' ? 'Error' : 'Cancelado'}
                      </Badge>
                    </td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── Preview Grid ──────────────────────────────────────────────────────────────

function PreviewGrid({ template, labels, currencySymbol }: { template: LabelTemplate; labels: PreviewLabel[]; currencySymbol: string }) {
  const cols = template.columns
  const labelsPerPage = cols * template.rows

  const pageMap = new Map<number, PreviewLabel[]>()
  for (const label of labels) {
    const arr = pageMap.get(label.page) ?? []
    arr.push(label)
    pageMap.set(label.page, arr)
  }

  const pages = Array.from(pageMap.entries()).sort(([a], [b]) => a - b)
  const labelAspect = template.width_mm / template.height_mm
  const previewCellW = Math.min(120, Math.floor(520 / cols))
  const previewCellH = Math.round(previewCellW / labelAspect)

  return (
    <div className="space-y-4">
      {pages.map(([pageNum, pageLabels]) => (
        <div key={pageNum}>
          <p className="mb-2 text-xs text-gray-500"><LayoutGrid className="inline h-3 w-3 mr-1" /> Pagina {pageNum + 1}</p>
          <div className="inline-grid gap-1 rounded-lg border border-border bg-background p-3" style={{ gridTemplateColumns: `repeat(${cols}, ${previewCellW}px)` }}>
            {Array.from({ length: labelsPerPage }).map((_, idx) => {
              const col = idx % cols, row = Math.floor(idx / cols)
              const lbl = pageLabels.find((l) => l.col === col && l.row === row)
              return (
                <div key={idx} className={`flex flex-col items-center justify-center overflow-hidden rounded border text-center ${lbl ? 'border-copper/40 bg-copper/5' : 'border-border/30 bg-surface/50'}`}
                  style={{ width: previewCellW, height: previewCellH }} title={lbl ? lbl.product.name : 'Vacio'}>
                  {lbl ? (
                    <>
                      <p className="truncate px-1 text-[9px] font-medium leading-tight text-white w-full text-center">{lbl.product.name.length > 12 ? lbl.product.name.slice(0, 11) + '…' : lbl.product.name}</p>
                      <p className="text-[7px] text-copper leading-tight">{lbl.product.sku}</p>
                      <p className="text-[7px] text-gray-400 leading-tight">{currencySymbol}{lbl.product.price.toFixed(2)}</p>
                    </>
                  ) : <div className="h-2 w-2 rounded-full bg-border" />}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
