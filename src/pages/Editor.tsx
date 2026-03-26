import { useEffect, useRef, useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Type, QrCode, Barcode, Image, Square, Minus, Circle, DollarSign,
  Save, Undo2, Redo2, ZoomIn, ZoomOut, Grid3X3, Magnet, Trash2,
  Copy, ArrowUpToLine, ArrowDownToLine, Lock, Unlock, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { useEditorStore } from '@/store/editorStore'
import { useAppStore } from '@/store/appStore'
import { db } from '@/lib/database'
import { generateBarcodeCanvasSync } from '@/lib/barcode'
import type { CanvasElement, CanvasElementType, CanvasState, BarcodeType } from '@/types'

const MM_TO_PX = 3.78
const BARCODE_CACHE_MAX = 50

const LABEL_PRESETS = [
  { label: '50 x 30 mm', w: 50, h: 30 },
  { label: '100 x 50 mm', w: 100, h: 50 },
  { label: '100 x 70 mm', w: 100, h: 70 },
  { label: '40 x 20 mm', w: 40, h: 20 },
  { label: '75 x 50 mm', w: 75, h: 50 },
]

function createElement(type: CanvasElementType, x: number, y: number): CanvasElement {
  const base = { id: crypto.randomUUID(), type, x, y, rotation: 0, locked: false, zIndex: Date.now() }
  switch (type) {
    case 'text':
      return { ...base, width: 20, height: 6, properties: { text: 'Texto', fontSize: 12, fontFamily: 'Inter', fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', textAlign: 'left', color: '#000000' } }
    case 'dynamic_text':
      return { ...base, width: 20, height: 6, properties: { text: '{{product.name}}', field: '{{product.name}}', fontSize: 12, fontFamily: 'Inter', fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', textAlign: 'left', color: '#000000' } }
    case 'barcode':
      return { ...base, width: 30, height: 10, properties: { barcodeType: 'code128', value: '123456789', showText: true } }
    case 'qr':
      return { ...base, width: 15, height: 15, properties: { value: 'https://example.com', errorCorrectionLevel: 'M' } }
    case 'datamatrix':
      return { ...base, width: 12, height: 12, properties: { value: 'DATAMATRIX001' } }
    case 'image':
      return { ...base, width: 15, height: 15, properties: { src: '', aspectRatio: 1 } }
    case 'rectangle':
      return { ...base, width: 15, height: 10, properties: { fill: 'transparent', stroke: '#000000', strokeWidth: 1 } }
    case 'line':
      return { ...base, width: 20, height: 1, properties: { fill: 'transparent', stroke: '#000000', strokeWidth: 1 } }
    case 'circle':
      return { ...base, width: 12, height: 12, properties: { fill: 'transparent', stroke: '#000000', strokeWidth: 1 } }
    case 'price':
      return { ...base, width: 15, height: 8, properties: { currencySymbol: db.getSetting('currency_symbol') || '$', fontSize: 18, fontFamily: 'Inter', color: '#000000' } }
    default:
      return { ...base, width: 15, height: 10, properties: {} }
  }
}

export default function Editor() {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const { addToast } = useAppStore()
  const store = useEditorStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const barcodeCacheRef = useRef<Map<string, HTMLCanvasElement | null>>(new Map())

  // Load template
  useEffect(() => {
    barcodeCacheRef.current.clear()
    if (templateId) {
      const template = db.getTemplate(templateId)
      if (template) {
        store.setTemplateId(template.id)
        store.setTemplateName(template.name)
        try {
          const parsed = JSON.parse(template.canvas_json)
          // Validate canvas structure
          if (
            typeof parsed !== 'object' || parsed === null ||
            !Array.isArray(parsed.elements) ||
            typeof parsed.width !== 'number' || typeof parsed.height !== 'number'
          ) {
            throw new Error('Estructura de canvas invalida')
          }
          // Sanitize elements — ensure required fields exist
          const safeElements = parsed.elements.filter((el: Record<string, unknown>) =>
            typeof el.id === 'string' && typeof el.type === 'string' &&
            typeof el.x === 'number' && typeof el.y === 'number' &&
            typeof el.width === 'number' && typeof el.height === 'number'
          )
          const canvasState: CanvasState = {
            elements: safeElements,
            width: parsed.width,
            height: parsed.height,
            backgroundColor: typeof parsed.backgroundColor === 'string' ? parsed.backgroundColor : '#FFFFFF',
          }
          store.loadCanvas(canvasState)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Error desconocido'
          addToast({ type: 'error', message: `Error al cargar la plantilla: ${msg}` })
          store.resetEditor()
        }
      }
    } else {
      store.resetEditor()
      // Apply default label dimensions from settings
      const defaultW = parseInt(db.getSetting('label_default_width') || '50')
      const defaultH = parseInt(db.getSetting('label_default_height') || '30')
      if (defaultW > 0 && defaultH > 0) store.setCanvasSize(defaultW, defaultH)
    }
  }, [templateId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); store.undo() }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); store.redo() }
      if (e.key === 'Delete' && store.selectedElementId) store.deleteElement(store.selectedElementId)
      if (e.ctrlKey && e.key === 'd' && store.selectedElementId) { e.preventDefault(); store.duplicateElement(store.selectedElementId) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [store])

  // Canvas rendering
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const container = containerRef.current
    if (container) { canvas.width = container.clientWidth; canvas.height = container.clientHeight }

    const { zoom, panX, panY, showGrid, gridSize, canvas: cs } = store
    const cW = cs.width * MM_TO_PX, cH = cs.height * MM_TO_PX

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    const oX = (canvas.width - cW * zoom) / 2 + panX
    const oY = (canvas.height - cH * zoom) / 2 + panY
    ctx.translate(oX, oY)
    ctx.scale(zoom, zoom)

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2
    ctx.fillStyle = cs.backgroundColor; ctx.fillRect(0, 0, cW, cH)
    ctx.shadowColor = 'transparent'

    // Grid
    if (showGrid) {
      ctx.strokeStyle = '#E0E0E0'; ctx.lineWidth = 0.3
      const gPx = gridSize * MM_TO_PX
      for (let x = 0; x <= cW; x += gPx) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cH); ctx.stroke() }
      for (let y = 0; y <= cH; y += gPx) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cW, y); ctx.stroke() }
    }

    // Elements
    const sorted = [...cs.elements].sort((a, b) => a.zIndex - b.zIndex)
    for (const el of sorted) {
      const ex = el.x * MM_TO_PX, ey = el.y * MM_TO_PX, ew = el.width * MM_TO_PX, eh = el.height * MM_TO_PX
      ctx.save()
      if (el.rotation) { ctx.translate(ex + ew / 2, ey + eh / 2); ctx.rotate(el.rotation * Math.PI / 180); ctx.translate(-(ex + ew / 2), -(ey + eh / 2)) }
      const p = el.properties as Record<string, unknown>

      switch (el.type) {
        case 'text': case 'dynamic_text': {
          const fs = (p.fontSize as number) || 12
          ctx.font = `${(p.fontStyle as string) || 'normal'} ${(p.fontWeight as string) || 'normal'} ${fs}px ${(p.fontFamily as string) || 'Inter'}`
          ctx.fillStyle = (p.color as string) || '#000'
          ctx.textBaseline = 'top'
          const ta = (p.textAlign as CanvasTextAlign) || 'left'
          ctx.textAlign = ta
          const tx = ta === 'center' ? ex + ew / 2 : ta === 'right' ? ex + ew : ex
          ctx.fillText((p.text as string) || '', tx, ey, ew)
          break
        }
        case 'barcode': {
          const bVal = (p.value as string) || ''
          const bType = (p.barcodeType as BarcodeType) || 'code128'
          const showTxt = p.showText !== false
          const cacheKey = `bc:${bType}:${bVal}:${showTxt}`
          let bcCanvas = barcodeCacheRef.current.get(cacheKey)
          if (bcCanvas === undefined) {
            if (barcodeCacheRef.current.size >= BARCODE_CACHE_MAX) barcodeCacheRef.current.delete(barcodeCacheRef.current.keys().next().value!)
            bcCanvas = generateBarcodeCanvasSync(bVal, bType, { scale: 2, showText: showTxt })
            barcodeCacheRef.current.set(cacheKey, bcCanvas)
          }
          ctx.fillStyle = '#FFF'; ctx.fillRect(ex, ey, ew, eh)
          if (bcCanvas) {
            ctx.drawImage(bcCanvas, ex, ey, ew, eh)
          } else {
            ctx.strokeStyle = '#CCC'; ctx.lineWidth = 0.5; ctx.strokeRect(ex, ey, ew, eh)
            ctx.font = '8px Inter'; ctx.fillStyle = '#999'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText(bVal ? 'Error' : 'Barcode', ex + ew / 2, ey + eh / 2)
          }
          break
        }
        case 'qr': case 'datamatrix': {
          const qVal = (p.value as string) || ''
          const qType: BarcodeType = el.type === 'qr' ? 'qr' : 'datamatrix'
          const qKey = `${qType}:${qVal}`
          let qCanvas = barcodeCacheRef.current.get(qKey)
          if (qCanvas === undefined) {
            if (barcodeCacheRef.current.size >= BARCODE_CACHE_MAX) barcodeCacheRef.current.delete(barcodeCacheRef.current.keys().next().value!)
            qCanvas = generateBarcodeCanvasSync(qVal, qType, { scale: 4 })
            barcodeCacheRef.current.set(qKey, qCanvas)
          }
          ctx.fillStyle = '#FFF'; ctx.fillRect(ex, ey, ew, eh)
          if (qCanvas) {
            ctx.drawImage(qCanvas, ex, ey, ew, eh)
          } else {
            ctx.strokeStyle = '#CCC'; ctx.lineWidth = 0.5; ctx.strokeRect(ex, ey, ew, eh)
            ctx.font = '7px Inter'; ctx.fillStyle = '#999'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText(qVal ? 'Error' : (el.type === 'qr' ? 'QR' : 'DM'), ex + ew / 2, ey + eh / 2)
          }
          break
        }
        case 'rectangle': {
          if (p.fill && p.fill !== 'transparent') { ctx.fillStyle = p.fill as string; ctx.fillRect(ex, ey, ew, eh) }
          ctx.strokeStyle = (p.stroke as string) || '#000'; ctx.lineWidth = (p.strokeWidth as number) || 1; ctx.strokeRect(ex, ey, ew, eh)
          break
        }
        case 'line': {
          ctx.strokeStyle = (p.stroke as string) || '#000'; ctx.lineWidth = (p.strokeWidth as number) || 1; ctx.beginPath(); ctx.moveTo(ex, ey + eh / 2); ctx.lineTo(ex + ew, ey + eh / 2); ctx.stroke()
          break
        }
        case 'circle': {
          ctx.beginPath(); ctx.ellipse(ex + ew / 2, ey + eh / 2, ew / 2, eh / 2, 0, 0, Math.PI * 2)
          if (p.fill && p.fill !== 'transparent') { ctx.fillStyle = p.fill as string; ctx.fill() }
          ctx.strokeStyle = (p.stroke as string) || '#000'; ctx.lineWidth = (p.strokeWidth as number) || 1; ctx.stroke()
          break
        }
        case 'price': {
          ctx.font = `bold ${(p.fontSize as number) || 18}px ${(p.fontFamily as string) || 'Inter'}`; ctx.fillStyle = (p.color as string) || '#000'; ctx.textBaseline = 'top'; ctx.textAlign = 'left'
          ctx.fillText(`${(p.currencySymbol as string) || '$'}{{price}}`, ex, ey)
          break
        }
        case 'image': {
          ctx.fillStyle = '#F0F0F0'; ctx.fillRect(ex, ey, ew, eh); ctx.strokeStyle = '#CCC'; ctx.lineWidth = 0.5; ctx.strokeRect(ex, ey, ew, eh)
          ctx.font = '8px Inter'; ctx.fillStyle = '#999'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Imagen', ex + ew / 2, ey + eh / 2)
          break
        }
      }

      // Selection
      if (el.id === store.selectedElementId) {
        ctx.strokeStyle = '#C47A3A'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 2]); ctx.strokeRect(ex - 2, ey - 2, ew + 4, eh + 4); ctx.setLineDash([])
        ctx.fillStyle = '#C47A3A'
        for (const h of [{ x: ex - 4, y: ey - 4 }, { x: ex + ew, y: ey - 4 }, { x: ex - 4, y: ey + eh }, { x: ex + ew, y: ey + eh }]) ctx.fillRect(h.x, h.y, 5, 5)
      }
      ctx.restore()
    }

    ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.strokeRect(0, 0, cW, cH)
    ctx.restore()
  }, [store])

  useEffect(() => { renderCanvas() }, [renderCanvas, store.canvas, store.zoom, store.panX, store.panY, store.selectedElementId, store.showGrid])
  useEffect(() => {
    const c = containerRef.current; if (!c) return
    const obs = new ResizeObserver(() => renderCanvas()); obs.observe(c); return () => obs.disconnect()
  }, [renderCanvas])

  const pxToMm = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current; if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const cW = store.canvas.width * MM_TO_PX, cH = store.canvas.height * MM_TO_PX
    const oX = (canvas.width - cW * store.zoom) / 2 + store.panX
    const oY = (canvas.height - cH * store.zoom) / 2 + store.panY
    return { x: (clientX - rect.left - oX) / (store.zoom * MM_TO_PX), y: (clientY - rect.top - oY) / (store.zoom * MM_TO_PX) }
  }, [store.canvas.width, store.canvas.height, store.zoom, store.panX, store.panY])

  const findElementAt = useCallback((mx: number, my: number): CanvasElement | null => {
    const els = [...store.canvas.elements].sort((a, b) => b.zIndex - a.zIndex)
    for (const el of els) { if (mx >= el.x && mx <= el.x + el.width && my >= el.y && my <= el.y + el.height) return el }
    return null
  }, [store.canvas.elements])

  const checkResizeHandle = useCallback((_mx: number, my: number, el: CanvasElement, mx: number): string => {
    const hs = 2
    if (mx >= el.x + el.width - hs && my >= el.y + el.height - hs) return 'se'
    if (mx <= el.x + hs && my <= el.y + hs) return 'nw'
    return ''
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { x, y } = pxToMm(e.clientX, e.clientY)
    if (e.button === 1 || (e.button === 0 && e.altKey)) { setIsPanning(true); setPanStart({ x: e.clientX - store.panX, y: e.clientY - store.panY }); return }
    const element = findElementAt(x, y)
    if (element) {
      if (element.locked) { store.selectElement(element.id); return }
      const handle = checkResizeHandle(x, y, element, x)
      if (handle) { setIsResizing(true); setResizeHandle(handle); store.selectElement(element.id); store.pushHistory(); return }
      store.selectElement(element.id); store.pushHistory(); setIsDragging(true); setDragOffset({ x: x - element.x, y: y - element.y })
    } else { store.selectElement(null) }
  }, [pxToMm, findElementAt, checkResizeHandle, store])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) { store.setPan(e.clientX - panStart.x, e.clientY - panStart.y); return }
    if (isDragging && store.selectedElementId) { const { x, y } = pxToMm(e.clientX, e.clientY); store.moveElement(store.selectedElementId, x - dragOffset.x, y - dragOffset.y); return }
    if (isResizing && store.selectedElementId) {
      const { x, y } = pxToMm(e.clientX, e.clientY); const el = store.canvas.elements.find((e) => e.id === store.selectedElementId)
      if (!el) return
      if (resizeHandle === 'se') store.resizeElement(store.selectedElementId, x - el.x, y - el.y)
      else if (resizeHandle === 'nw') { store.moveElement(store.selectedElementId, x, y); store.resizeElement(store.selectedElementId, el.x + el.width - x, el.y + el.height - y) }
    }
  }, [isPanning, isDragging, isResizing, store, pxToMm, dragOffset, panStart, resizeHandle])

  const handleMouseUp = useCallback(() => { setIsDragging(false); setIsPanning(false); setIsResizing(false); setResizeHandle('') }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => { e.preventDefault(); store.setZoom(store.zoom + (e.deltaY > 0 ? -0.1 : 0.1)) }, [store])

  const addElementToCenter = (type: CanvasElementType) => {
    store.addElement(createElement(type, store.canvas.width / 2 - 10, store.canvas.height / 2 - 5))
  }

  const handleSave = () => {
    const canvasJson = JSON.stringify(store.canvas)
    try {
      if (store.templateId) {
        db.updateTemplate(store.templateId, { name: store.templateName, canvas_json: canvasJson, width_mm: store.canvas.width, height_mm: store.canvas.height })
        addToast({ type: 'success', message: `Plantilla "${store.templateName}" guardada.` })
      } else {
        const id = db.createTemplate({ name: store.templateName, description: null, width_mm: store.canvas.width, height_mm: store.canvas.height, canvas_json: canvasJson, is_default: 0, paper_size: 'custom', columns: 1, rows: 1, margin_top_mm: 5, margin_left_mm: 5, gap_x_mm: 2, gap_y_mm: 2 })
        store.setTemplateId(id)
        addToast({ type: 'success', message: `Plantilla "${store.templateName}" creada.` })
        navigate(`/editor/${id}`, { replace: true })
      }
      setShowSaveModal(false)
    } catch { addToast({ type: 'error', message: 'No se pudo guardar la plantilla.' }) }
  }

  const sel = store.canvas.elements.find((el) => el.id === store.selectedElementId)

  const tools: Array<{ type: CanvasElementType; icon: typeof Type; label: string }> = [
    { type: 'text', icon: Type, label: 'Texto' },
    { type: 'dynamic_text', icon: FileText, label: 'Dinamico' },
    { type: 'barcode', icon: Barcode, label: 'Barcode' },
    { type: 'qr', icon: QrCode, label: 'QR' },
    { type: 'image', icon: Image, label: 'Imagen' },
    { type: 'rectangle', icon: Square, label: 'Rect' },
    { type: 'line', icon: Minus, label: 'Linea' },
    { type: 'circle', icon: Circle, label: 'Circulo' },
    { type: 'price', icon: DollarSign, label: 'Precio' },
  ]

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Left - Tools */}
      <div className="flex w-14 flex-col gap-1 rounded-xl border border-border bg-surface p-2">
        {tools.map(({ type, icon: Icon, label }) => (
          <button key={type} onClick={() => addElementToCenter(type)} className="flex flex-col items-center gap-0.5 rounded-lg p-2 text-gray-400 hover:bg-copper/10 hover:text-copper transition-default" title={label}>
            <Icon className="h-4 w-4" />
            <span className="text-[8px] leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Center - Canvas */}
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
          <Input value={store.templateName} onChange={(e) => store.setTemplateName(e.target.value)} className="!bg-transparent !border-0 !px-1 font-medium w-48" />
          <div className="flex-1" />
          <button onClick={store.undo} className="rounded p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-default" title="Deshacer"><Undo2 className="h-4 w-4" /></button>
          <button onClick={store.redo} className="rounded p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-default" title="Rehacer"><Redo2 className="h-4 w-4" /></button>
          <div className="h-5 w-px bg-border mx-1" />
          <button onClick={() => store.setZoom(store.zoom - 0.1)} className="rounded p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-default"><ZoomOut className="h-4 w-4" /></button>
          <span className="text-xs text-gray-400 w-12 text-center">{Math.round(store.zoom * 100)}%</span>
          <button onClick={() => store.setZoom(store.zoom + 0.1)} className="rounded p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-default"><ZoomIn className="h-4 w-4" /></button>
          <div className="h-5 w-px bg-border mx-1" />
          <button onClick={store.toggleGrid} className={`rounded p-1.5 transition-default ${store.showGrid ? 'text-copper' : 'text-gray-400'}`} title="Grilla"><Grid3X3 className="h-4 w-4" /></button>
          <button onClick={store.toggleSnap} className={`rounded p-1.5 transition-default ${store.snapToGrid ? 'text-copper' : 'text-gray-400'}`} title="Snap"><Magnet className="h-4 w-4" /></button>
          <div className="h-5 w-px bg-border mx-1" />
          <Button variant="secondary" size="sm" onClick={() => setShowSettingsModal(true)}>{store.canvas.width}x{store.canvas.height}mm</Button>
          <Button size="sm" onClick={() => store.templateId ? handleSave() : setShowSaveModal(true)}><Save className="h-3 w-3" /> Guardar</Button>
        </div>
        <div ref={containerRef} className="flex-1 overflow-hidden rounded-xl border border-border bg-[#333] cursor-crosshair">
          <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel} className="h-full w-full" />
        </div>
      </div>

      {/* Right - Properties */}
      <div className="w-64 overflow-y-auto rounded-xl border border-border bg-surface p-4">
        {sel ? (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-copper">Propiedades</h3>
            <div className="grid grid-cols-2 gap-2">
              <Input label="X (mm)" type="number" step="0.5" value={sel.x.toFixed(1)} onChange={(e) => store.updateElement(sel.id, { x: parseFloat(e.target.value) || 0 })} />
              <Input label="Y (mm)" type="number" step="0.5" value={sel.y.toFixed(1)} onChange={(e) => store.updateElement(sel.id, { y: parseFloat(e.target.value) || 0 })} />
              <Input label="Ancho" type="number" step="0.5" value={sel.width.toFixed(1)} onChange={(e) => store.resizeElement(sel.id, parseFloat(e.target.value) || 1, sel.height)} />
              <Input label="Alto" type="number" step="0.5" value={sel.height.toFixed(1)} onChange={(e) => store.resizeElement(sel.id, sel.width, parseFloat(e.target.value) || 1)} />
              <Input label="Rotacion" type="number" step="15" value={String(sel.rotation)} onChange={(e) => store.updateElement(sel.id, { rotation: parseInt(e.target.value) || 0 })} />
            </div>

            {(sel.type === 'text' || sel.type === 'dynamic_text') && (
              <div className="space-y-2">
                <Input label={sel.type === 'dynamic_text' ? 'Campo' : 'Texto'} value={(sel.properties as Record<string, string>).text || ''} onChange={(e) => store.updateElement(sel.id, { properties: { ...sel.properties, text: e.target.value } })} />
                {sel.type === 'dynamic_text' && (
                  <Select label="Variable" value={(sel.properties as Record<string, string>).field || ''} onChange={(e) => store.updateElement(sel.id, { properties: { ...sel.properties, field: e.target.value, text: e.target.value } })}
                    options={[{ value: '{{product.name}}', label: 'Nombre' }, { value: '{{product.sku}}', label: 'SKU' }, { value: '{{product.price}}', label: 'Precio' }, { value: '{{product.category}}', label: 'Categoria' }, { value: '{{product.barcode_value}}', label: 'Codigo' }, { value: '{{date}}', label: 'Fecha' }]} />
                )}
                <Input label="Tamano" type="number" value={String((sel.properties as Record<string, number>).fontSize || 12)} onChange={(e) => store.updateElement(sel.id, { properties: { ...sel.properties, fontSize: parseInt(e.target.value) || 12 } })} />
                <Input label="Color" type="color" value={(sel.properties as Record<string, string>).color || '#000000'} onChange={(e) => store.updateElement(sel.id, { properties: { ...sel.properties, color: e.target.value } })} />
                <Select label="Alineacion" value={(sel.properties as Record<string, string>).textAlign || 'left'} onChange={(e) => store.updateElement(sel.id, { properties: { ...sel.properties, textAlign: e.target.value } })}
                  options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} />
                <div className="flex gap-1">
                  <button onClick={() => store.updateElement(sel.id, { properties: { ...sel.properties, fontWeight: (sel.properties as Record<string, string>).fontWeight === 'bold' ? 'normal' : 'bold' } })} className={`rounded px-2 py-1 text-xs font-bold transition-default ${(sel.properties as Record<string, string>).fontWeight === 'bold' ? 'bg-copper/20 text-copper' : 'text-gray-400 hover:bg-white/5'}`}>B</button>
                  <button onClick={() => store.updateElement(sel.id, { properties: { ...sel.properties, fontStyle: (sel.properties as Record<string, string>).fontStyle === 'italic' ? 'normal' : 'italic' } })} className={`rounded px-2 py-1 text-xs italic transition-default ${(sel.properties as Record<string, string>).fontStyle === 'italic' ? 'bg-copper/20 text-copper' : 'text-gray-400 hover:bg-white/5'}`}>I</button>
                </div>
              </div>
            )}

            {sel.type === 'barcode' && (
              <div className="space-y-2">
                <Input label="Valor" value={(sel.properties as Record<string, string>).value || ''} onChange={(e) => store.updateElement(sel.id, { properties: { ...sel.properties, value: e.target.value } })} />
                <Select label="Tipo" value={(sel.properties as Record<string, string>).barcodeType || 'code128'} onChange={(e) => store.updateElement(sel.id, { properties: { ...sel.properties, barcodeType: e.target.value } })}
                  options={[{ value: 'code128', label: 'Code 128' }, { value: 'ean13', label: 'EAN-13' }, { value: 'ean8', label: 'EAN-8' }, { value: 'upca', label: 'UPC-A' }, { value: 'code39', label: 'Code 39' }, { value: 'itf14', label: 'ITF-14' }]} />
              </div>
            )}

            {(sel.type === 'qr' || sel.type === 'datamatrix') && (
              <Input label="Contenido" value={(sel.properties as Record<string, string>).value || ''} onChange={(e) => store.updateElement(sel.id, { properties: { ...sel.properties, value: e.target.value } })} />
            )}

            {(sel.type === 'rectangle' || sel.type === 'circle' || sel.type === 'line') && (
              <div className="space-y-2">
                <Input label="Color borde" type="color" value={(sel.properties as Record<string, string>).stroke || '#000000'} onChange={(e) => store.updateElement(sel.id, { properties: { ...sel.properties, stroke: e.target.value } })} />
                {sel.type !== 'line' && <Input label="Relleno" type="color" value={(sel.properties as Record<string, string>).fill || '#FFFFFF'} onChange={(e) => store.updateElement(sel.id, { properties: { ...sel.properties, fill: e.target.value } })} />}
                <Input label="Grosor" type="number" min="0.5" step="0.5" value={String((sel.properties as Record<string, number>).strokeWidth || 1)} onChange={(e) => store.updateElement(sel.id, { properties: { ...sel.properties, strokeWidth: parseFloat(e.target.value) || 1 } })} />
              </div>
            )}

            {sel.type === 'price' && (
              <div className="space-y-2">
                <Input label="Simbolo" value={(sel.properties as Record<string, string>).currencySymbol || '$'} onChange={(e) => store.updateElement(sel.id, { properties: { ...sel.properties, currencySymbol: e.target.value } })} />
                <Input label="Tamano" type="number" value={String((sel.properties as Record<string, number>).fontSize || 18)} onChange={(e) => store.updateElement(sel.id, { properties: { ...sel.properties, fontSize: parseInt(e.target.value) || 18 } })} />
                <Input label="Color" type="color" value={(sel.properties as Record<string, string>).color || '#000000'} onChange={(e) => store.updateElement(sel.id, { properties: { ...sel.properties, color: e.target.value } })} />
              </div>
            )}

            <div className="border-t border-border pt-3">
              <div className="flex flex-wrap gap-1">
                <button onClick={() => store.duplicateElement(sel.id)} className="rounded p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-default" title="Duplicar"><Copy className="h-4 w-4" /></button>
                <button onClick={() => store.bringToFront(sel.id)} className="rounded p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-default" title="Al frente"><ArrowUpToLine className="h-4 w-4" /></button>
                <button onClick={() => store.sendToBack(sel.id)} className="rounded p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-default" title="Atras"><ArrowDownToLine className="h-4 w-4" /></button>
                <button onClick={() => store.updateElement(sel.id, { locked: !sel.locked })} className={`rounded p-1.5 transition-default ${sel.locked ? 'text-warning' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`} title={sel.locked ? 'Desbloquear' : 'Bloquear'}>{sel.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}</button>
                <button onClick={() => store.deleteElement(sel.id)} className="rounded p-1.5 text-gray-400 hover:bg-error/10 hover:text-error transition-default" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-400">Selecciona un elemento</h3>
            <p className="text-xs text-gray-500">Haz clic en un elemento del canvas para editar sus propiedades.</p>
            <div className="border-t border-border pt-3">
              <h4 className="text-xs font-medium text-gray-400 mb-2">Atajos</h4>
              <ul className="space-y-1 text-xs text-gray-500">
                <li><kbd className="bg-border px-1 rounded">Ctrl+Z</kbd> Deshacer</li>
                <li><kbd className="bg-border px-1 rounded">Ctrl+Y</kbd> Rehacer</li>
                <li><kbd className="bg-border px-1 rounded">Ctrl+D</kbd> Duplicar</li>
                <li><kbd className="bg-border px-1 rounded">Del</kbd> Eliminar</li>
                <li><kbd className="bg-border px-1 rounded">Scroll</kbd> Zoom</li>
              </ul>
            </div>
            <div className="border-t border-border pt-3">
              <h4 className="text-xs font-medium text-gray-400 mb-2">Plantillas</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {db.getTemplates().map((t) => (
                  <button key={t.id} onClick={() => navigate(`/editor/${t.id}`)}
                    className={`w-full text-left rounded-lg px-2 py-1.5 text-xs transition-default ${t.id === store.templateId ? 'bg-copper/10 text-copper' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                    {t.name} <span className="text-gray-600 ml-1">{t.width_mm}x{t.height_mm}mm</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal open={showSaveModal} onClose={() => setShowSaveModal(false)} title="Guardar Plantilla" size="sm">
        <Input label="Nombre" value={store.templateName} onChange={(e) => store.setTemplateName(e.target.value)} placeholder="Mi etiqueta" />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowSaveModal(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar</Button>
        </div>
      </Modal>

      <Modal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="Dimensiones" size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Ancho (mm)" type="number" value={String(store.canvas.width)} onChange={(e) => store.setCanvasSize(parseFloat(e.target.value) || 50, store.canvas.height)} />
            <Input label="Alto (mm)" type="number" value={String(store.canvas.height)} onChange={(e) => store.setCanvasSize(store.canvas.width, parseFloat(e.target.value) || 30)} />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">Presets:</p>
            <div className="flex flex-wrap gap-2">
              {LABEL_PRESETS.map((p) => (
                <button key={p.label} onClick={() => store.setCanvasSize(p.w, p.h)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-default ${store.canvas.width === p.w && store.canvas.height === p.h ? 'border-copper text-copper bg-copper/10' : 'border-border text-gray-400 hover:border-gray-500'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end"><Button onClick={() => setShowSettingsModal(false)}>Listo</Button></div>
      </Modal>
    </div>
  )
}
