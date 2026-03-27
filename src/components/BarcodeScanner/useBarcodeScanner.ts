import { useRef, useCallback, useState, useEffect } from 'react'
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat, type Result } from '@zxing/library'
import { playBeep, vibrate } from './beep'

// ─── BarcodeDetector API types (not yet in TypeScript lib.dom) ──────────────

interface DetectedBarcode {
  rawValue: string
  format: string
  boundingBox: DOMRectReadOnly
  cornerPoints: ReadonlyArray<{ x: number; y: number }>
}

interface NativeBarcodeDetector {
  detect(source: CanvasImageSource | Blob | ImageData): Promise<DetectedBarcode[]>
}

const NativeDetectorCtor = (
  typeof window !== 'undefined' && 'BarcodeDetector' in window
)
  ? (window as unknown as {
      BarcodeDetector: { new (opts?: { formats: string[] }): NativeBarcodeDetector }
    }).BarcodeDetector
  : null

// ─── Format constants & mappings ────────────────────────────────────────────

const DETECTOR_FORMATS = [
  'code_128', 'code_39', 'code_93', 'codabar',
  'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf',
  'qr_code', 'data_matrix', 'aztec', 'pdf417',
]

const NATIVE_FORMAT_NAMES: Record<string, string> = {
  qr_code: 'QR Code', code_128: 'Code 128', code_39: 'Code 39',
  code_93: 'Code 93', ean_13: 'EAN-13', ean_8: 'EAN-8',
  upc_a: 'UPC-A', upc_e: 'UPC-E', itf: 'ITF',
  codabar: 'Codabar', data_matrix: 'DataMatrix', aztec: 'Aztec',
  pdf417: 'PDF 417',
}

const NATIVE_TO_ZXING: Record<string, BarcodeFormat> = {
  qr_code: BarcodeFormat.QR_CODE, code_128: BarcodeFormat.CODE_128,
  code_39: BarcodeFormat.CODE_39, code_93: BarcodeFormat.CODE_93,
  ean_13: BarcodeFormat.EAN_13, ean_8: BarcodeFormat.EAN_8,
  upc_a: BarcodeFormat.UPC_A, upc_e: BarcodeFormat.UPC_E,
  itf: BarcodeFormat.ITF, codabar: BarcodeFormat.CODABAR,
  data_matrix: BarcodeFormat.DATA_MATRIX, aztec: BarcodeFormat.AZTEC,
  pdf417: BarcodeFormat.PDF_417,
}

const ALL_FORMATS = [
  BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.ITF,
  BarcodeFormat.CODABAR, BarcodeFormat.DATA_MATRIX, BarcodeFormat.AZTEC,
  BarcodeFormat.PDF_417,
]

const FORMAT_NAMES: Record<number, string> = {
  [BarcodeFormat.QR_CODE]: 'QR Code',
  [BarcodeFormat.CODE_128]: 'Code 128',
  [BarcodeFormat.CODE_39]: 'Code 39',
  [BarcodeFormat.CODE_93]: 'Code 93',
  [BarcodeFormat.EAN_13]: 'EAN-13',
  [BarcodeFormat.EAN_8]: 'EAN-8',
  [BarcodeFormat.UPC_A]: 'UPC-A',
  [BarcodeFormat.UPC_E]: 'UPC-E',
  [BarcodeFormat.ITF]: 'ITF',
  [BarcodeFormat.CODABAR]: 'Codabar',
  [BarcodeFormat.DATA_MATRIX]: 'DataMatrix',
  [BarcodeFormat.AZTEC]: 'Aztec',
  [BarcodeFormat.PDF_417]: 'PDF 417',
}

export function getFormatName(format: BarcodeFormat): string {
  return FORMAT_NAMES[format] ?? `Formato ${format}`
}

// ─── Image preprocessing utilities ──────────────────────────────────────────

function imgToCanvas(img: HTMLImageElement, maxDim?: number): HTMLCanvasElement {
  let w = img.naturalWidth, h = img.naturalHeight
  if (maxDim) {
    const s = Math.min(1, maxDim / Math.max(w, h))
    w = Math.round(w * s)
    h = Math.round(h * s)
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(img, 0, 0, w, h)
  return c
}

function binarize(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  const id = ctx.getImageData(0, 0, c.width, c.height)
  const d = id.data
  let sum = 0
  for (let i = 0; i < d.length; i += 4) {
    sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
  }
  const thresh = (sum / (d.length / 4)) * 0.85
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = d[i + 1] = d[i + 2] = g > thresh ? 255 : 0
  }
  ctx.putImageData(id, 0, 0)
  return c
}

function enhanceContrast(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d')!
  // Try native CSS filter (Chrome/Firefox), manual fallback (Safari <17.2)
  if (typeof ctx.filter === 'string') {
    ctx.filter = 'contrast(1.6) brightness(1.1)'
    ctx.drawImage(src, 0, 0)
    return c
  }
  ctx.drawImage(src, 0, 0)
  const id = ctx.getImageData(0, 0, c.width, c.height)
  const d = id.data
  const f = 1.6
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, Math.max(0, f * (d[i] - 128) + 128 + 14))
    d[i + 1] = Math.min(255, Math.max(0, f * (d[i + 1] - 128) + 128 + 14))
    d[i + 2] = Math.min(255, Math.max(0, f * (d[i + 2] - 128) + 128 + 14))
  }
  ctx.putImageData(id, 0, 0)
  return c
}

function centerCrop(src: HTMLCanvasElement, ratio: number): HTMLCanvasElement {
  const cw = Math.round(src.width * ratio)
  const ch = Math.round(src.height * ratio)
  const x = (src.width - cw) >> 1
  const y = (src.height - ch) >> 1
  const c = document.createElement('canvas')
  c.width = cw
  c.height = ch
  c.getContext('2d')!.drawImage(src, x, y, cw, ch, 0, 0, cw, ch)
  return c
}

async function canvasToImg(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = canvas.toDataURL()
  })
}

// ─── Scan result type ───────────────────────────────────────────────────────

export interface ScanResult {
  text: string
  format: string
  formatEnum: BarcodeFormat
  timestamp: number
}

// ─── Hook ───────────────────────────────────────────────────────────────────

interface UseScannerOptions {
  onScan: (result: ScanResult) => void
  formats?: BarcodeFormat[]
  continuous?: boolean
  debounceMs?: number
}

export function useBarcodeScanner({
  onScan,
  formats,
  continuous = true,
  debounceMs = 1200,
}: UseScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const lastResultRef = useRef('')
  const lastTimeRef = useRef(0)
  const activeRef = useRef(false)
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [torchOn, setTorchOn] = useState(false)
  const [hasTorch, setHasTorch] = useState(false)

  // ─── Build engines ──────────────────────────────────────────────────────

  const buildNativeDetector = useCallback((): NativeBarcodeDetector | null => {
    if (!NativeDetectorCtor) return null
    try {
      return new NativeDetectorCtor({ formats: DETECTOR_FORMATS })
    } catch {
      return null
    }
  }, [])

  const buildZxingReader = useCallback(() => {
    const hints = new Map<DecodeHintType, unknown>()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats ?? ALL_FORMATS)
    hints.set(DecodeHintType.TRY_HARDER, true)
    return new BrowserMultiFormatReader(hints, 40)
  }, [formats])

  // ─── Debounce check ─────────────────────────────────────────────────────

  const shouldDebounce = useCallback((text: string) => {
    const now = Date.now()
    if (text === lastResultRef.current && now - lastTimeRef.current < debounceMs) return true
    lastResultRef.current = text
    lastTimeRef.current = now
    return false
  }, [debounceMs])

  // ─── Process results ────────────────────────────────────────────────────

  const processZxingResult = useCallback(
    (result: Result) => {
      const text = result.getText()
      if (shouldDebounce(text)) return
      playBeep()
      vibrate()
      const fmt = result.getBarcodeFormat()
      onScan({ text, format: getFormatName(fmt), formatEnum: fmt, timestamp: Date.now() })
    },
    [onScan, shouldDebounce],
  )

  const processNativeResult = useCallback(
    (barcode: DetectedBarcode) => {
      const text = barcode.rawValue
      if (shouldDebounce(text)) return
      playBeep()
      vibrate()
      onScan({
        text,
        format: NATIVE_FORMAT_NAMES[barcode.format] ?? barcode.format,
        formatEnum: NATIVE_TO_ZXING[barcode.format] ?? BarcodeFormat.CODE_128,
        timestamp: Date.now(),
      })
    },
    [onScan, shouldDebounce],
  )

  // ─── Optimize camera track ──────────────────────────────────────────────

  const optimizeTrack = useCallback(async (stream: MediaStream) => {
    const track = stream.getVideoTracks()[0]
    if (!track) return
    const caps = track.getCapabilities() as MediaTrackCapabilities & {
      focusMode?: string[]
      torch?: boolean
      exposureMode?: string[]
      whiteBalanceMode?: string[]
    }
    setHasTorch(!!caps.torch)
    const adv: Record<string, unknown> = {}
    if (caps.focusMode?.includes('continuous')) adv.focusMode = 'continuous'
    if (caps.exposureMode?.includes('continuous')) adv.exposureMode = 'continuous'
    if (caps.whiteBalanceMode?.includes('continuous')) adv.whiteBalanceMode = 'continuous'
    if (Object.keys(adv).length) {
      try {
        await track.applyConstraints({ advanced: [adv] } as MediaTrackConstraints)
      } catch {
        /* not all constraints supported */
      }
    }
  }, [])

  // ─── Stop scanning ──────────────────────────────────────────────────────

  const stop = useCallback(() => {
    activeRef.current = false
    setIsActive(false)
    setTorchOn(false)
    setHasTorch(false)

    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current)
      scanTimerRef.current = null
    }
    if (readerRef.current) {
      try { readerRef.current.stopContinuousDecode() } catch { /* ok */ }
      try { readerRef.current.reset() } catch { /* ok */ }
      readerRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // ─── Start scanning ─────────────────────────────────────────────────────

  const start = useCallback(
    async (videoEl: HTMLVideoElement, mode?: 'environment' | 'user') => {
      if (activeRef.current) return
      setError(null)
      const currentMode = mode ?? facingMode

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: currentMode },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
          audio: false,
        })

        streamRef.current = stream
        videoEl.srcObject = stream
        videoRef.current = videoEl

        await new Promise<void>((resolve) => {
          videoEl.onloadedmetadata = () => resolve()
        })

        // Avoid "Trying to play video that is already playing" warning
        if (videoEl.paused) {
          try {
            await videoEl.play()
          } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') throw err
            return
          }
        }

        await optimizeTrack(stream)
        activeRef.current = true
        setIsActive(true)

        if (!continuous) {
          const reader = buildZxingReader()
          readerRef.current = reader
          try {
            const result = await reader.decodeFromVideoElement(videoEl)
            if (result) processZxingResult(result)
          } catch {
            /* no code found */
          }
          stop()
          return
        }

        // ── Continuous scanning: prefer native BarcodeDetector ──────────
        const detector = buildNativeDetector()

        if (detector) {
          const loop = () => {
            if (!activeRef.current) return
            if (videoEl.readyState < 2) {
              scanTimerRef.current = setTimeout(loop, 100)
              return
            }
            detector
              .detect(videoEl)
              .then((barcodes) => {
                if (barcodes.length > 0 && activeRef.current) {
                  processNativeResult(barcodes[0])
                }
              })
              .catch(() => {})
              .finally(() => {
                if (activeRef.current) {
                  scanTimerRef.current = setTimeout(loop, 50)
                }
              })
          }
          loop()
        } else {
          // ZXing fallback
          const reader = buildZxingReader()
          readerRef.current = reader
          reader.decodeFromVideoElementContinuously(videoEl, (result: Result | null) => {
            if (!activeRef.current) return
            if (result) processZxingResult(result)
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('NotAllowed') || msg.includes('Permission')) {
          setError('Permiso de camara denegado. Revisa la configuracion del navegador.')
        } else if (msg.includes('NotFound') || msg.includes('device not found')) {
          setError('No se encontro camara disponible.')
        } else {
          setError(`Error de camara: ${msg}`)
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facingMode, buildZxingReader, buildNativeDetector, optimizeTrack, processZxingResult, processNativeResult, continuous],
  )

  // ─── Switch camera ──────────────────────────────────────────────────────

  const switchCamera = useCallback(async () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(newMode)
    if (activeRef.current && videoRef.current) {
      const v = videoRef.current
      stop()
      await new Promise((r) => setTimeout(r, 300))
      await start(v, newMode)
    }
  }, [facingMode, stop, start])

  // ─── Toggle torch ──────────────────────────────────────────────────────

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as Record<string, unknown>],
      } as MediaTrackConstraints)
      setTorchOn(next)
    } catch {
      /* torch not supported */
    }
  }, [torchOn])

  // ─── Multi-pass image scanning ──────────────────────────────────────────

  const scanImage = useCallback(
    async (file: File): Promise<ScanResult | null> => {
      const url = URL.createObjectURL(file)
      try {
        const img = new Image()
        img.src = url
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Failed to load image'))
        })

        const makeResult = (text: string, format: string, formatEnum: BarcodeFormat): ScanResult => {
          playBeep()
          vibrate()
          return { text, format, formatEnum, timestamp: Date.now() }
        }

        // ── Pass 1: Native BarcodeDetector on original image ──────────
        const detector = buildNativeDetector()
        if (detector) {
          try {
            const barcodes = await detector.detect(img)
            if (barcodes.length > 0) {
              const b = barcodes[0]
              return makeResult(
                b.rawValue,
                NATIVE_FORMAT_NAMES[b.format] ?? b.format,
                NATIVE_TO_ZXING[b.format] ?? BarcodeFormat.CODE_128,
              )
            }
          } catch {
            /* detector failed */
          }
        }

        // ── Pass 2-6: ZXing with preprocessed variants ────────────────
        const reader = buildZxingReader()
        const original = imgToCanvas(img)
        const variants = [
          original,
          enhanceContrast(original),
          binarize(original),
          centerCrop(original, 0.6),
          imgToCanvas(img, 1200),
        ]

        for (const canvas of variants) {
          try {
            const tempImg = await canvasToImg(canvas)
            const result = await reader.decodeFromImageElement(tempImg)
            if (result) {
              const fmt = result.getBarcodeFormat()
              return makeResult(result.getText(), getFormatName(fmt), fmt)
            }
          } catch {
            /* no code found in this variant */
          }
        }

        // ── Pass 7+: Native detector on preprocessed variants ─────────
        if (detector) {
          for (const canvas of variants.slice(1)) {
            try {
              const barcodes = await detector.detect(canvas)
              if (barcodes.length > 0) {
                const b = barcodes[0]
                return makeResult(
                  b.rawValue,
                  NATIVE_FORMAT_NAMES[b.format] ?? b.format,
                  NATIVE_TO_ZXING[b.format] ?? BarcodeFormat.CODE_128,
                )
              }
            } catch {
              /* detector failed on variant */
            }
          }
        }

        return null
      } finally {
        URL.revokeObjectURL(url)
      }
    },
    [buildNativeDetector, buildZxingReader],
  )

  // ─── Cleanup on unmount ─────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      activeRef.current = false
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
      if (readerRef.current) {
        try { readerRef.current.stopContinuousDecode() } catch { /* ok */ }
        try { readerRef.current.reset() } catch { /* ok */ }
      }
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.srcObject = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  return {
    start,
    stop,
    switchCamera,
    toggleTorch,
    scanImage,
    isActive,
    error,
    facingMode,
    torchOn,
    hasTorch,
    videoRef,
  }
}
