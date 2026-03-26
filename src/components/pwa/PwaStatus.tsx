import { useState, useEffect, useCallback, useRef } from 'react'
import { Wifi, WifiOff, RefreshCw, Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [showOffline, setShowOffline] = useState(false)
  const [hasUpdate, setHasUpdate] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)

  // Connectivity detection
  useEffect(() => {
    const goOnline = () => {
      setOnline(true)
      setShowOffline(true)
    }
    const goOffline = () => {
      setOnline(false)
      setShowOffline(true)
    }

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Auto-hide "connection restored" banner after 3s
  useEffect(() => {
    if (online && showOffline) {
      const timer = setTimeout(() => setShowOffline(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [online, showOffline])

  // Install prompt capture (Android/Desktop Chrome)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e as BeforeInstallPromptEvent
      setShowInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Hide install banner if already installed
    const matchMedia = window.matchMedia?.('(display-mode: standalone)')
    if (matchMedia?.matches || (navigator as unknown as Record<string, unknown>).standalone) {
      setShowInstall(false)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Service Worker update detection
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const checkForUpdate = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        if (!reg) return

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setHasUpdate(true)
            }
          })
        })

        if (reg.waiting && navigator.serviceWorker.controller) {
          setHasUpdate(true)
        }
      } catch {
        // SW not available
      }
    }

    checkForUpdate()
  }, [])

  const handleUpdate = useCallback(() => {
    setUpdating(true)
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
    })
    setTimeout(() => window.location.reload(), 500)
  }, [])

  const handleInstall = useCallback(async () => {
    const prompt = deferredPromptRef.current
    if (!prompt) return
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') {
      setShowInstall(false)
    }
    deferredPromptRef.current = null
  }, [])

  // Nothing to show
  if (!showOffline && !hasUpdate && !showInstall) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center max-w-[calc(100vw-2rem)]">
      {/* Offline/Online banner */}
      {showOffline && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg border transition-all ${
          online
            ? 'bg-success/10 border-success/30 text-success'
            : 'bg-surface border-border text-gray-300'
        }`}>
          {online ? (
            <>
              <Wifi className="h-4 w-4 shrink-0" />
              <span>Conexion restaurada</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 shrink-0 text-warning" />
              <span>Sin conexion — los datos se guardan localmente</span>
            </>
          )}
        </div>
      )}

      {/* Install banner */}
      {showInstall && (
        <div className="flex items-center gap-3 rounded-xl bg-surface border border-copper/30 px-4 py-2.5 text-sm shadow-lg">
          <Download className="h-4 w-4 shrink-0 text-copper" />
          <span className="text-gray-300">Instala la app en tu dispositivo</span>
          <button
            onClick={handleInstall}
            className="rounded-lg bg-copper px-3 py-1 text-xs font-medium text-white hover:opacity-90 transition-opacity"
          >
            Instalar
          </button>
          <button
            onClick={() => setShowInstall(false)}
            className="text-gray-500 hover:text-white text-xs transition-colors"
          >
            Ahora no
          </button>
        </div>
      )}

      {/* Update available banner */}
      {hasUpdate && (
        <div className="flex items-center gap-3 rounded-xl bg-surface border border-copper/30 px-4 py-2.5 text-sm shadow-lg">
          <RefreshCw className={`h-4 w-4 shrink-0 text-copper ${updating ? 'animate-spin' : ''}`} />
          <span className="text-gray-300">Nueva version disponible</span>
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="rounded-lg bg-copper px-3 py-1 text-xs font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {updating ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      )}
    </div>
  )
}
