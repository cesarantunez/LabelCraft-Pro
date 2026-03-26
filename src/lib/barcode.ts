import bwipjs from 'bwip-js'
import type { BarcodeType } from '@/types'

// ─── Barcode type mapping to bwip-js encoder names ────────────────────────────

const BWIP_ENCODER: Record<BarcodeType, string> = {
  code128: 'code128',
  ean13: 'ean13',
  ean8: 'ean8',
  upca: 'upca',
  code39: 'code39',
  itf14: 'interleaved2of5',
  qr: 'qrcode',
  datamatrix: 'datamatrix',
}

// ─── Generate barcode as canvas (for Editor preview) ──────────────────────────

export async function generateBarcodeCanvas(
  value: string,
  type: BarcodeType,
  opts?: { width?: number; height?: number; scale?: number },
): Promise<HTMLCanvasElement> {
  const is2D = type === 'qr' || type === 'datamatrix'
  const canvas = document.createElement('canvas')

  const bwipOpts: bwipjs.RenderOptions = {
    bcid: BWIP_ENCODER[type] || 'code128',
    text: value,
    scale: opts?.scale ?? (is2D ? 4 : 2),
    includetext: !is2D,
    textxalign: 'center',
    backgroundcolor: 'FFFFFF',
  }

  if (!is2D) {
    bwipOpts.height = opts?.height ?? 10
    if (opts?.width != null) bwipOpts.width = opts.width
  }

  bwipjs.toCanvas(canvas, bwipOpts)
  return canvas
}

// ─── Generate barcode canvas synchronously (for Editor preview) ──────────────

export function generateBarcodeCanvasSync(
  value: string,
  type: BarcodeType,
  opts?: { width?: number; height?: number; scale?: number; showText?: boolean },
): HTMLCanvasElement | null {
  if (!value.trim()) return null
  try {
    const is2D = type === 'qr' || type === 'datamatrix'
    const canvas = document.createElement('canvas')

    const bwipOpts: bwipjs.RenderOptions = {
      bcid: BWIP_ENCODER[type] || 'code128',
      text: value,
      scale: opts?.scale ?? (is2D ? 4 : 2),
      includetext: opts?.showText ?? !is2D,
      textxalign: 'center',
      backgroundcolor: 'FFFFFF',
    }

    if (!is2D) {
      bwipOpts.height = opts?.height ?? 10
      if (opts?.width != null) bwipOpts.width = opts.width
    }

    bwipjs.toCanvas(canvas, bwipOpts)
    return canvas
  } catch (err) {
    console.warn('[barcode] generation failed:', value, type, err)
    return null
  }
}

// ─── Generate barcode as PNG data URL (for PDF embedding) ─────────────────────

export async function generateBarcodeDataURL(
  value: string,
  type: BarcodeType,
  opts?: { width?: number; height?: number; scale?: number },
): Promise<string> {
  const canvas = await generateBarcodeCanvas(value, type, opts)
  return canvas.toDataURL('image/png')
}

// ─── Validate barcode value for a given type ──────────────────────────────────

export function validateBarcodeValue(value: string, type: BarcodeType): string | null {
  if (!value.trim()) return 'El valor del codigo no puede estar vacio.'

  switch (type) {
    case 'ean13':
      if (!/^\d{12,13}$/.test(value)) return 'EAN-13 requiere 12 o 13 digitos.'
      break
    case 'ean8':
      if (!/^\d{7,8}$/.test(value)) return 'EAN-8 requiere 7 u 8 digitos.'
      break
    case 'upca':
      if (!/^\d{11,12}$/.test(value)) return 'UPC-A requiere 11 o 12 digitos.'
      break
    case 'itf14':
      if (!/^\d+$/.test(value) || value.length % 2 !== 0) return 'ITF requiere un numero par de digitos.'
      break
    case 'code128':
    case 'code39':
    case 'qr':
    case 'datamatrix':
      break
  }
  return null
}
