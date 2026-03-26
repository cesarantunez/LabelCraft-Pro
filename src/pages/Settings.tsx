import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings as SettingsIcon,
  Building2,
  DollarSign,
  Tag,
  Database,
  Save,
  RotateCcw,
  Info,
  MapPin,
  Phone,
  Trash2,
  Shield,
  Lock,
  Eye,
  EyeOff,
  FileText,
  Clock,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAppStore } from '@/store/appStore'
import { db } from '@/lib/database'

interface SettingsForm {
  business_name: string
  business_address: string
  business_phone: string
  currency_symbol: string
  currency_code: string
  sku_prefix: string
  sku_digits: string
  default_unit: string
  low_stock_threshold: string
  label_default_width: string
  label_default_height: string
  inactivity_timeout: string
  lock_pin: string
  retention_movements_days: string
  retention_print_days: string
  retention_audit_days: string
}

const CURRENCY_OPTIONS = [
  { value: 'MXN', label: 'MXN - Peso Mexicano ($)' },
  { value: 'USD', label: 'USD - Dolar ($)' },
  { value: 'EUR', label: 'EUR - Euro (€)' },
  { value: 'COP', label: 'COP - Peso Colombiano ($)' },
  { value: 'ARS', label: 'ARS - Peso Argentino ($)' },
  { value: 'CLP', label: 'CLP - Peso Chileno ($)' },
  { value: 'PEN', label: 'PEN - Sol Peruano (S/)' },
  { value: 'BRL', label: 'BRL - Real Brasileno (R$)' },
]

const SYMBOL_MAP: Record<string, string> = {
  MXN: '$', USD: '$', EUR: '€', COP: '$', ARS: '$', CLP: '$', PEN: 'S/', BRL: 'R$',
}

const TIMEOUT_OPTIONS = [
  { value: '0', label: 'Desactivado' },
  { value: '5', label: '5 minutos' },
  { value: '15', label: '15 minutos' },
  { value: '30', label: '30 minutos' },
  { value: '60', label: '1 hora' },
  { value: '120', label: '2 horas' },
  { value: '480', label: '8 horas' },
]

const RETENTION_OPTIONS = [
  { value: '0', label: 'Sin limite (conservar todo)' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: '180', label: '6 meses' },
  { value: '365', label: '1 ano' },
]

const UNIT_OPTIONS = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'kg', label: 'Kilogramo' },
  { value: 'lb', label: 'Libra' },
  { value: 'litro', label: 'Litro' },
  { value: 'caja', label: 'Caja' },
  { value: 'paquete', label: 'Paquete' },
]

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

export default function Settings() {
  const navigate = useNavigate()
  const { addToast } = useAppStore()
  const [form, setForm] = useState<SettingsForm>({
    business_name: '',
    business_address: '',
    business_phone: '',
    currency_symbol: '$',
    currency_code: 'MXN',
    sku_prefix: 'PROD',
    sku_digits: '4',
    default_unit: 'unidad',
    low_stock_threshold: '5',
    label_default_width: '50',
    label_default_height: '30',
    inactivity_timeout: '0',
    lock_pin: '',
    retention_movements_days: '0',
    retention_print_days: '0',
    retention_audit_days: '0',
  })
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [vacuuming, setVacuuming] = useState(false)
  const [showPinField, setShowPinField] = useState(false)

  useEffect(() => {
    const loaded: SettingsForm = {
      business_name: db.getSetting('business_name') || '',
      business_address: db.getSetting('business_address') || '',
      business_phone: db.getSetting('business_phone') || '',
      currency_symbol: db.getSetting('currency_symbol') || '$',
      currency_code: db.getSetting('currency_code') || 'MXN',
      sku_prefix: db.getSetting('sku_prefix') || 'PROD',
      sku_digits: db.getSetting('sku_digits') || '4',
      default_unit: db.getSetting('default_unit') || 'unidad',
      low_stock_threshold: db.getSetting('low_stock_threshold') || '5',
      label_default_width: db.getSetting('label_default_width') || '50',
      label_default_height: db.getSetting('label_default_height') || '30',
      inactivity_timeout: db.getSetting('inactivity_timeout') || '0',
      lock_pin: db.getSetting('lock_pin') || '',
      retention_movements_days: db.getSetting('retention_movements_days') || '0',
      retention_print_days: db.getSetting('retention_print_days') || '0',
      retention_audit_days: db.getSetting('retention_audit_days') || '0',
    }
    setForm(loaded)
  }, [])

  const updateField = (field: keyof SettingsForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const handleSave = () => {
    setSaving(true)
    try {
      for (const [key, value] of Object.entries(form)) {
        db.setSetting(key, value)
      }
      setHasChanges(false)
      addToast({ type: 'success', message: 'Configuracion guardada.' })
    } catch (err) {
      addToast({ type: 'error', message: `Error: ${err instanceof Error ? err.message : 'desconocido'}` })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    const loaded: SettingsForm = {
      business_name: db.getSetting('business_name') || '',
      business_address: db.getSetting('business_address') || '',
      business_phone: db.getSetting('business_phone') || '',
      currency_symbol: db.getSetting('currency_symbol') || '$',
      currency_code: db.getSetting('currency_code') || 'MXN',
      sku_prefix: db.getSetting('sku_prefix') || 'PROD',
      sku_digits: db.getSetting('sku_digits') || '4',
      default_unit: db.getSetting('default_unit') || 'unidad',
      low_stock_threshold: db.getSetting('low_stock_threshold') || '5',
      label_default_width: db.getSetting('label_default_width') || '50',
      label_default_height: db.getSetting('label_default_height') || '30',
      inactivity_timeout: db.getSetting('inactivity_timeout') || '0',
      lock_pin: db.getSetting('lock_pin') || '',
      retention_movements_days: db.getSetting('retention_movements_days') || '0',
      retention_print_days: db.getSetting('retention_print_days') || '0',
      retention_audit_days: db.getSetting('retention_audit_days') || '0',
    }
    setForm(loaded)
    setHasChanges(false)
  }

  const handleVacuum = () => {
    setVacuuming(true)
    try {
      db.vacuum()
      addToast({ type: 'success', message: 'Base de datos optimizada correctamente.' })
    } catch {
      addToast({ type: 'error', message: 'Error al optimizar la base de datos.' })
    } finally {
      setVacuuming(false)
    }
  }

  const productCount = db.getProductCount()
  const templateCount = db.getTemplates().length
  const categoryCount = db.getCategories().length
  const dbSize = formatBytes(db.getDatabaseSize())

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Configuracion</h1>
          <p className="text-sm text-gray-400 mt-0.5">Datos del negocio, moneda y preferencias</p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button variant="ghost" size="sm" onClick={handleReset}><RotateCcw className="h-3.5 w-3.5" /> Descartar</Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={!hasChanges} loading={saving}><Save className="h-3.5 w-3.5" /> Guardar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Business */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-copper" />
            <h2 className="font-semibold">Datos del Negocio</h2>
          </div>
          <div className="space-y-3">
            <Input label="Nombre del negocio" value={form.business_name} onChange={(e) => updateField('business_name', e.target.value)} placeholder="Mi Negocio" />
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-gray-500 mt-7 shrink-0" />
              <Input label="Direccion" value={form.business_address} onChange={(e) => updateField('business_address', e.target.value)} placeholder="Calle, Numero, Ciudad" className="flex-1" />
            </div>
            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 text-gray-500 mt-7 shrink-0" />
              <Input label="Telefono" value={form.business_phone} onChange={(e) => updateField('business_phone', e.target.value)} placeholder="+52 55 1234 5678" className="flex-1" />
            </div>
          </div>
        </Card>

        {/* Currency */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-copper" />
            <h2 className="font-semibold">Moneda</h2>
          </div>
          <div className="space-y-3">
            <Select label="Moneda" value={form.currency_code} onChange={(e) => {
              updateField('currency_code', e.target.value)
              updateField('currency_symbol', SYMBOL_MAP[e.target.value] || '$')
            }} options={CURRENCY_OPTIONS} />
            <Input label="Simbolo" value={form.currency_symbol} onChange={(e) => updateField('currency_symbol', e.target.value)} hint="Se muestra antes de los precios" />
          </div>
        </Card>

        {/* SKU */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Tag className="h-5 w-5 text-copper" />
            <h2 className="font-semibold">Formato de SKU</h2>
          </div>
          <div className="space-y-3">
            <Input label="Prefijo" value={form.sku_prefix} onChange={(e) => updateField('sku_prefix', e.target.value.toUpperCase())} placeholder="PROD" />
            <Input label="Digitos" type="number" min="2" max="8" value={form.sku_digits} onChange={(e) => updateField('sku_digits', e.target.value)} hint="Numero de digitos secuenciales" />
            <div className="rounded-lg bg-background px-3 py-2 text-xs text-gray-500">
              Ejemplo: <span className="font-mono text-copper">{form.sku_prefix}-{'0'.repeat(Math.max(0, (parseInt(form.sku_digits) || 4) - 1))}1</span>
            </div>
          </div>
        </Card>

        {/* Defaults */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="h-5 w-5 text-copper" />
            <h2 className="font-semibold">Valores por Defecto</h2>
          </div>
          <div className="space-y-3">
            <Select label="Unidad por defecto" value={form.default_unit} onChange={(e) => updateField('default_unit', e.target.value)} options={UNIT_OPTIONS} />
            <Input label="Alerta de stock minimo" type="number" min="0" value={form.low_stock_threshold} onChange={(e) => updateField('low_stock_threshold', e.target.value)}
              hint="Se aplica a nuevos productos" />
          </div>
        </Card>

        {/* Label defaults */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Tag className="h-5 w-5 text-copper" />
            <h2 className="font-semibold">Etiquetas por Defecto</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Ancho (mm)" type="number" min="10" max="300" value={form.label_default_width} onChange={(e) => updateField('label_default_width', e.target.value)} />
            <Input label="Alto (mm)" type="number" min="10" max="300" value={form.label_default_height} onChange={(e) => updateField('label_default_height', e.target.value)} />
          </div>
          <div className="mt-2 rounded-lg bg-background px-3 py-2 text-xs text-gray-500">
            Tamanio por defecto al crear nuevas plantillas: <span className="text-copper font-medium">{form.label_default_width}x{form.label_default_height} mm</span>
          </div>
        </Card>

        {/* Security */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-copper" />
            <h2 className="font-semibold">Seguridad</h2>
          </div>
          <div className="space-y-3">
            <Select
              label="Bloqueo por inactividad"
              value={form.inactivity_timeout}
              onChange={(e) => updateField('inactivity_timeout', e.target.value)}
              options={TIMEOUT_OPTIONS}
            />
            {form.inactivity_timeout !== '0' && (
              <>
                <div className="relative">
                  <Input
                    label="PIN de desbloqueo (opcional)"
                    type={showPinField ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={form.lock_pin}
                    onChange={(e) => updateField('lock_pin', e.target.value.replace(/\D/g, ''))}
                    placeholder="4-6 digitos"
                    hint={form.lock_pin ? `${form.lock_pin.length} digitos configurados` : 'Sin PIN: un click desbloquea'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinField(!showPinField)}
                    className="absolute right-3 top-8 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPinField ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.lock_pin && form.lock_pin.length > 0 && form.lock_pin.length < 4 && (
                  <p className="text-xs text-amber-400">El PIN debe tener al menos 4 digitos</p>
                )}
              </>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-xs text-gray-500">
            <Lock className="h-3.5 w-3.5 text-copper shrink-0" />
            {form.inactivity_timeout === '0'
              ? 'El bloqueo automatico esta desactivado.'
              : `La pantalla se bloqueara tras ${form.inactivity_timeout} min de inactividad.`}
          </div>
        </Card>

        {/* Data Retention */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-copper" />
            <h2 className="font-semibold">Retencion de Datos</h2>
          </div>
          <div className="space-y-3">
            <Select
              label="Movimientos de inventario"
              value={form.retention_movements_days}
              onChange={(e) => updateField('retention_movements_days', e.target.value)}
              options={RETENTION_OPTIONS}
            />
            <Select
              label="Historial de impresion"
              value={form.retention_print_days}
              onChange={(e) => updateField('retention_print_days', e.target.value)}
              options={RETENTION_OPTIONS}
            />
            <Select
              label="Log de auditoria"
              value={form.retention_audit_days}
              onChange={(e) => updateField('retention_audit_days', e.target.value)}
              options={RETENTION_OPTIONS}
            />
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-xs text-gray-500">
            <Clock className="h-3.5 w-3.5 text-copper shrink-0" />
            {form.retention_movements_days === '0' && form.retention_print_days === '0' && form.retention_audit_days === '0'
              ? 'Todos los datos se conservan indefinidamente.'
              : 'Los registros antiguos se eliminan automaticamente al iniciar la app.'}
          </div>
        </Card>

        {/* Database info */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-5 w-5 text-copper" />
            <h2 className="font-semibold">Base de Datos</h2>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Motor', value: 'SQLite (sql.js WASM)' },
              { label: 'Almacenamiento', value: 'IndexedDB (local)' },
              { label: 'Tamanio', value: dbSize },
              { label: 'Productos', value: String(productCount) },
              { label: 'Plantillas', value: String(templateCount) },
              { label: 'Categorias', value: String(categoryCount) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="text-white font-medium">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleVacuum} loading={vacuuming}>
              <Trash2 className="h-3.5 w-3.5" /> Optimizar (VACUUM)
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-xs text-gray-500">
            <Info className="h-3.5 w-3.5 text-copper shrink-0" />
            Todos los datos se guardan localmente en tu navegador. No se envian a ningun servidor.
          </div>
        </Card>

        {/* About */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Info className="h-5 w-5 text-copper" />
            <h2 className="font-semibold">Acerca de</h2>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Aplicacion', value: 'LabelCraft Pro' },
              { label: 'Version', value: '1.0.0' },
              { label: 'Tipo', value: 'PWA (Progressive Web App)' },
              { label: 'Funcionamiento', value: '100% Offline' },
              { label: 'Motor BD', value: 'SQLite via sql.js (WASM)' },
              { label: 'Escaner', value: 'ZXing (13 formatos)' },
              { label: 'Codigos', value: 'bwip-js (Code128, EAN, QR, etc.)' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="text-white font-medium">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate('/legal')}>
              <FileText className="h-3.5 w-3.5" /> Documentos Legales
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/ayuda')}>
              <Info className="h-3.5 w-3.5" /> Manual de Usuario
            </Button>
          </div>
          <div className="mt-3 rounded-lg bg-background px-3 py-2 text-xs text-gray-500">
            Disenado para gestionar productos, generar etiquetas con codigos de barras, y controlar inventario desde cualquier dispositivo.
          </div>
        </Card>
      </div>
    </div>
  )
}
