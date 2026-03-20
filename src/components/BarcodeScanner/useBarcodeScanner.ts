import { useRef, useCallback, useState, useEffect } from 'react'
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat, type Result } from '@zxing/library'
import { playBeep, vibrate } from './beep'

// ─── All supported barcode formats ────────────────────────────────────────────

const ALL_FORMATS = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.AZTEC,
  BarcodeFormat.PDF_417,
]

// ─── Format name helper ───────────────────────────────────────────────────────

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

// ─── Scan result type ─────────────────────────────────────────────────────────

export interface ScanResult {
  text: string
  format: string
  formatEnum: BarcodeFormat
  timestamp: number
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

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
  const lastResultRef = useRef<string>('')
  const lastTimeRef = useRef<number>(0)
  const activeRef = useRef(false)
  const playingRef = useRef(false)

  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [torchOn, setTorchOn] = useState(false)
  const [hasTorch, setHasTorch] = useState(false)

  // ─── Build reader with hints ────────────────────────────────────────────

  const buildReader = useCallback(() => {
    const hints = new Map<DecodeHintType, unknown>()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats ?? ALL_FORMATS)
    hints.set(DecodeHintType.TRY_HARDER, true)
    const reader = new BrowserMultiFormatReader(hints, 80)
    return reader
  }, [formats])

  // ─── Process a ZXing Result ───────────────────────────────────────────────

  const processResult = useCallback((result: Result) => {
    const text = result.getText()
    const now = Date.now()

    // Debounce same code
    if (text === lastResultRef.current && now - lastTimeRef.current < debounceMs) {
      return
    }
    lastResultRef.current = text
    lastTimeRef.current = now

    playBeep()
    vibrate()

    const format = result.getBarcodeFormat()
    onScan({
      text,
      format: getFormatName(format),
      formatEnum: format,
      timestamp: now,
    })
  }, [onScan, debounceMs])

  // ─── Apply camera optimizations ─────────────────────────────────────────

  const optimizeTrack = useCallback(async (stream: MediaStream) => {
    const track = stream.getVideoTracks()[0]
    if (!track) return

    const caps = track.getCapabilities() as MediaTrackCapabilities & {
      focusMode?: string[]
      torch?: boolean
      exposureMode?: string[]
      whiteBalanceMode?: string[]
      zoom?: { min: number; max: number; step: number }
    }

    setHasTorch(!!caps.torch)

    const advanced: Record<string, unknown> = {}

    if (caps.focusMode?.includes('continuous')) advanced.focusMode = 'continuous'
    if (caps.exposureMode?.includes('continuous')) advanced.exposureMode = 'continuous'
    if (caps.whiteBalanceMode?.includes('continuous')) advanced.whiteBalanceMode = 'continuous'

    if (Object.keys(advanced).length > 0) {
      try {
        await track.applyConstraints({ advanced: [advanced] } as MediaTrackConstraints)
      } catch { /* not all constraints supported */ }
    }
  }, [])

  // ─── Start scanning ────────────────────────────────────────────────────

  const start = useCallback(async (videoEl: HTMLVideoElement, mode?: 'environment' | 'user') => {
    if (activeRef.current) return
    setError(null)

    const currentMode = mode ?? facingMode

    try {
      // Get camera stream with high resolution
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

      // Wait for video metadata before playing
      await new Promise<void>((resolve) => {
        videoEl.onloadedmetadata = () => resolve()
      })

      // Guard against multiple play() calls
      if (!playingRef.current) {
        playingRef.current = true
        try {
          await videoEl.play()
        } catch (err) {
          playingRef.current = false
          if (err instanceof Error && err.name !== 'AbortError') {
            throw err
          }
          // AbortError is just a race condition, ignore it
          return
        }
      }

      // Optimize: autofocus, exposure, white balance
      await optimizeTrack(stream)

      // Build ZXing reader with TRY_HARDER
      const reader = buildReader()
      readerRef.current = reader
      videoRef.current = videoEl

      // Start continuous decode
      activeRef.current = true
      setIsActive(true)

      if (continuous) {
        // Use ZXing's built-in continuous decode which handles the loop internally
        reader.decodeFromVideoElementContinuously(videoEl, (result: Result | null) => {
          if (!activeRef.current) return
          if (result) {
            processResult(result)
          }
        })
      } else {
        // Single decode
        try {
          const result = await reader.decodeFromVideoElement(videoEl)
          if (result) {
            processResult(result)
          }
        } catch {
          // No code found
        }
        stop()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setError('Permiso de camara denegado. Revisa la configuracion del navegador.')
      } else if (msg.includes('NotFoundError') || msg.includes('Requested device not found')) {
        setError('No se encontro camara disponible.')
      } else {
        setError(`Error de camara: ${msg}`)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, buildReader, optimizeTrack, processResult, continuous])

  // ─── Stop scanning ─────────────────────────────────────────────────────

  const stop = useCallback(() => {
    activeRef.current = false
    playingRef.current = false
    setIsActive(false)
    setTorchOn(false)
    setHasTorch(false)

    if (readerRef.current) {
      try { readerRef.current.stopContinuousDecode() } catch { /* ok */ }
      try { readerRef.current.reset() } catch { /* ok */ }
      readerRef.current = null
    }

    // Pause video first, then release stream
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // ─── Switch camera ─────────────────────────────────────────────────────

  const switchCamera = useCallback(async () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(newMode)

    if (activeRef.current && videoRef.current) {
      const savedVideo = videoRef.current
      stop()
      // Small delay to ensure tracks are fully released
      await new Promise((r) => setTimeout(r, 300))
      await start(savedVideo, newMode)
    }
  }, [facingMode, stop, start])

  // ─── Toggle torch ───────────────────────────────────────────────────────

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return

    const newState = !torchOn
    try {
      await track.applyConstraints({
        advanced: [{ torch: newState } as Record<string, unknown>],
      } as MediaTrackConstraints)
      setTorchOn(newState)
    } catch {
      // torch not supported
    }
  }, [torchOn])

  // ─── Scan from image file ──────────────────────────────────────────────

  const scanImage = useCallback(async (file: File): Promise<ScanResult | null> => {
    const reader = buildReader()
    const url = URL.createObjectURL(file)

    try {
      const img = new Image()
      img.src = url
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load image'))
      })

      // Use the reader to decode from the image element
      const result = await reader.decodeFromImageElement(img)
      if (result) {
        const format = result.getBarcodeFormat()
        playBeep()
        vibrate()
        return {
          text: result.getText(),
          format: getFormatName(format),
          formatEnum: format,
          timestamp: Date.now(),
        }
      }
      return null
    } catch {
      return null
    } finally {
      URL.revokeObjectURL(url)
      reader.reset()
    }
  }, [buildReader])

  // ─── Cleanup on unmount ─────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      activeRef.current = false
      playingRef.current = false
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
