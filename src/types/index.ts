// === Database Models ===

export interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  category_id: string | null
  price: number
  cost: number
  stock_quantity: number
  min_stock_alert: number
  barcode_value: string | null
  barcode_type: BarcodeType
  unit: string
  image_blob: string | null
  is_active: number
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  color: string
  icon: string
  created_at: string
}

export interface LabelTemplate {
  id: string
  name: string
  description: string | null
  width_mm: number
  height_mm: number
  canvas_json: string
  is_default: number
  paper_size: PaperSize
  columns: number
  rows: number
  margin_top_mm: number
  margin_left_mm: number
  gap_x_mm: number
  gap_y_mm: number
  created_at: string
  updated_at: string
}

export interface PrintHistory {
  id: string
  template_id: string | null
  product_ids: string
  quantity: number
  printed_at: string
  status: 'completed' | 'cancelled' | 'error'
}

export interface InventoryMovement {
  id: string
  product_id: string
  type: MovementType
  quantity: number
  reason: string | null
  reference: string | null
  created_at: string
}

export interface AppSetting {
  key: string
  value: string
  updated_at: string
}

// === Enums ===

export type BarcodeType = 'code128' | 'ean13' | 'ean8' | 'upca' | 'code39' | 'itf14' | 'qr' | 'datamatrix'
export type PaperSize = 'custom' | 'letter' | 'a4' | 'rollo_continuo'
export type MovementType = 'entrada' | 'salida' | 'ajuste' | 'devolucion'

// === Canvas Editor ===

export type CanvasElementType = 'text' | 'dynamic_text' | 'barcode' | 'qr' | 'datamatrix' | 'image' | 'rectangle' | 'line' | 'circle' | 'price'

export interface CanvasElement {
  id: string
  type: CanvasElementType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  locked: boolean
  zIndex: number
  properties: Record<string, unknown>
}

export interface TextProperties {
  text: string
  fontSize: number
  fontFamily: string
  fontWeight: string
  fontStyle: string
  textDecoration: string
  textAlign: 'left' | 'center' | 'right'
  color: string
}

export interface DynamicTextProperties extends TextProperties {
  field: string // e.g. '{{product.name}}'
}

export interface BarcodeProperties {
  barcodeType: BarcodeType
  value: string
  showText: boolean
  barWidth: number
  barHeight: number
}

export interface QRProperties {
  value: string
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'
}

export interface ImageProperties {
  src: string
  aspectRatio: number
}

export interface ShapeProperties {
  fill: string
  stroke: string
  strokeWidth: number
}

export interface PriceProperties {
  currencySymbol: string
  fontSize: number
  fontFamily: string
  color: string
}

export interface CanvasState {
  elements: CanvasElement[]
  width: number
  height: number
  backgroundColor: string
}

// === UI ===

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

// === Dashboard ===

export interface DashboardStats {
  totalProducts: number
  lowStockProducts: number
  labelsPrintedToday: number
  labelsPrintedWeek: number
  labelsPrintedMonth: number
  inventoryValue: number
}
