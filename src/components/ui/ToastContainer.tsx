import { useEffect } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import type { ToastType } from '@/types'

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const colors: Record<ToastType, string> = {
  success: 'border-success text-success',
  error: 'border-error text-error',
  warning: 'border-warning text-warning',
  info: 'border-copper text-copper',
}

export function ToastContainer() {
  const { toasts, removeToast } = useAppStore()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = icons[toast.type]
        return (
          <ToastItem
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            duration={toast.duration ?? 4000}
            Icon={Icon}
            colorClass={colors[toast.type]}
            onRemove={removeToast}
          />
        )
      })}
    </div>
  )
}

interface ToastItemProps {
  id: string
  type: ToastType
  message: string
  duration: number
  Icon: typeof CheckCircle
  colorClass: string
  onRemove: (id: string) => void
}

function ToastItem({ id, message, duration, Icon, colorClass, onRemove }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(id), duration)
    return () => clearTimeout(timer)
  }, [id, duration, onRemove])

  return (
    <div className={`flex items-center gap-3 rounded-lg border bg-surface px-4 py-3 shadow-glow transition-default animate-in slide-in-from-right ${colorClass}`}>
      <Icon className="h-5 w-5 shrink-0" />
      <p className="text-sm text-white">{message}</p>
      <button
        onClick={() => onRemove(id)}
        className="ml-2 shrink-0 text-gray-400 hover:text-white transition-default"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
