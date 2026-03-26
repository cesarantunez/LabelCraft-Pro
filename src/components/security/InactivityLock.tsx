import { useState, useEffect, useRef, useCallback } from 'react'
import { Lock, Tag, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { db } from '@/lib/database'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const

export function InactivityLock({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const lastActivityRef = useRef(Date.now())
  const timeoutMinutesRef = useRef(0)
  const storedPinRef = useRef<string | null>(null)

  const resetActivity = useCallback(() => {
    if (!locked) {
      lastActivityRef.current = Date.now()
    }
  }, [locked])

  // Load settings and set up listeners
  useEffect(() => {
    const loadSettings = () => {
      const timeout = parseInt(db.getSetting('inactivity_timeout') || '0', 10)
      timeoutMinutesRef.current = timeout
      storedPinRef.current = db.getSetting('lock_pin')
    }

    loadSettings()

    // Reload settings periodically (in case user changes them)
    const settingsInterval = setInterval(loadSettings, 30_000)

    // Activity listeners
    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, resetActivity, { passive: true })
    }

    // Check for inactivity
    const checkInterval = setInterval(() => {
      const timeout = timeoutMinutesRef.current
      if (timeout <= 0) return
      const elapsed = (Date.now() - lastActivityRef.current) / 60_000
      if (elapsed >= timeout && !locked) {
        setLocked(true)
      }
    }, 10_000) // check every 10s

    return () => {
      clearInterval(settingsInterval)
      clearInterval(checkInterval)
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, resetActivity)
      }
    }
  }, [locked, resetActivity])

  const handleUnlock = () => {
    const storedPin = storedPinRef.current
    if (storedPin && storedPin.length > 0) {
      if (pin !== storedPin) {
        setPinError(true)
        setPin('')
        setTimeout(() => setPinError(false), 1500)
        return
      }
    }
    setLocked(false)
    setPin('')
    setPinError(false)
    setShowPin(false)
    lastActivityRef.current = Date.now()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleUnlock()
  }

  if (!locked) return <>{children}</>

  const hasPin = storedPinRef.current && storedPinRef.current.length > 0

  return (
    <>
      {children}
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm">
        <div className="w-full max-w-sm px-6 text-center">
          {/* Logo */}
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-copper/20">
              <Tag className="h-10 w-10 text-copper" />
            </div>
          </div>

          <h2 className="text-xl font-bold mb-1">
            Label<span className="text-copper">Craft</span> Pro
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Sesion bloqueada por inactividad
          </p>

          {hasPin ? (
            <div className="space-y-4">
              <div className="relative">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3">
                  <Lock className="h-4 w-4 text-gray-500 shrink-0" />
                  <input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={handleKeyDown}
                    placeholder="Ingresa tu PIN"
                    autoFocus
                    className={`flex-1 bg-transparent text-center text-lg tracking-[0.3em] outline-none placeholder:text-gray-500 placeholder:tracking-normal ${
                      pinError ? 'text-red-400' : 'text-white'
                    }`}
                  />
                  <button
                    onClick={() => setShowPin(!showPin)}
                    aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {pinError && (
                  <p className="mt-2 text-xs text-red-400">PIN incorrecto</p>
                )}
              </div>
              <Button onClick={handleUnlock} className="w-full">
                Desbloquear
              </Button>
            </div>
          ) : (
            <Button onClick={handleUnlock} className="w-full">
              <Lock className="h-4 w-4" /> Continuar
            </Button>
          )}

          <p className="mt-6 text-xs text-gray-500">
            Tus datos estan seguros localmente
          </p>
        </div>
      </div>
    </>
  )
}
