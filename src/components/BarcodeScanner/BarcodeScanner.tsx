import { useRef, useEffect, useState, useCallback } from 'react'
import { X, Zap, ZapOff, SwitchCamera, Check } from 'lucide-react'
import { useBarcodeScanner, type ScanResult } from './useBarcodeScanner'
import type { BarcodeFormat } from '@zxing/library'
import './BarcodeScanner.css'

// ─── Props ───────────────────────────────────────────────────────────────────

interface BarcodeScannerProps {
  onScan: (result: ScanResult) => void
  onClose: () => void
  allowedFormats?: BarcodeFormat[]
  continuous?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BarcodeScanner({
  onScan,
  onClose,
  allowedFormats,
  continuous = true,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)
  const [detected, setDetected] = useState(false)

  const handleScan = useCallback(
    (result: ScanResult) => {
      setLastResult(result)
      setDetected(true)
      setTimeout(() => setDetected(false), 800)
      onScan(result)
    },
    [onScan],
  )

  const {
    start,
    stop,
    switchCamera,
    toggleTorch,
    isActive,
    error,
    torchOn,
    hasTorch,
  } = useBarcodeScanner({
    onScan: handleScan,
    formats: allowedFormats,
    continuous,
    debounceMs: 1200,
  })

  // Auto-start when video element is ready
  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl) return

    start(videoEl)

    return () => {
      stop()
    }
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="barcode-scanner-overlay">
      {/* Video feed */}
      <video ref={videoRef} playsInline muted />

      {/* Detection guide overlay */}
      <div className="scanner-guide">
        <div className={`scanner-frame ${detected ? 'sf-detected' : ''}`}>
          {/* Corner markers */}
          <div className={`sf-corner sf-tl ${detected ? 'detected' : ''}`} />
          <div className={`sf-corner sf-tr ${detected ? 'detected' : ''}`} />
          <div className={`sf-corner sf-bl ${detected ? 'detected' : ''}`} />
          <div className={`sf-corner sf-br ${detected ? 'detected' : ''}`} />
          {/* Laser line */}
          <div className="sf-laser" />
          {/* Center crosshair */}
          <div className="sf-crosshair" />
          {/* Hint text */}
          <span className="sf-hint">
            {error ? error : isActive ? 'Apunta al codigo de barras o QR' : 'Iniciando camara...'}
          </span>
        </div>
      </div>

      {/* Top controls bar */}
      <div className="scanner-top-bar">
        <button className="scanner-btn" onClick={onClose} title="Cerrar">
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          {/* Torch */}
          {hasTorch && (
            <button
              className={`scanner-btn ${torchOn ? 'active' : ''}`}
              onClick={toggleTorch}
              title={torchOn ? 'Apagar linterna' : 'Encender linterna'}
            >
              {torchOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
            </button>
          )}

          {/* Switch camera */}
          <button
            className="scanner-btn"
            onClick={switchCamera}
            title="Cambiar camara"
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Bottom result bar */}
      {lastResult && (
        <div className="scanner-bottom-bar">
          <div className="scanner-result-chip">
            <Check className="h-4 w-4 text-green-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white font-medium truncate">{lastResult.text}</p>
              <p className="text-[11px] text-green-400/70">{lastResult.format}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
