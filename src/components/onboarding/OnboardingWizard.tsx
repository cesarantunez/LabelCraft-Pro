import { useState } from 'react'
import { Tag, ArrowRight, ArrowLeft, Check, Upload, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAppStore } from '@/store/appStore'
import { db } from '@/lib/database'

const CURRENCY_OPTIONS = [
  { value: 'MXN', label: 'MXN - Peso Mexicano ($)', symbol: '$' },
  { value: 'USD', label: 'USD - Dolar ($)', symbol: '$' },
  { value: 'EUR', label: 'EUR - Euro (€)', symbol: '€' },
  { value: 'COP', label: 'COP - Peso Colombiano ($)', symbol: '$' },
  { value: 'ARS', label: 'ARS - Peso Argentino ($)', symbol: '$' },
  { value: 'CLP', label: 'CLP - Peso Chileno ($)', symbol: '$' },
  { value: 'PEN', label: 'PEN - Sol Peruano (S/)', symbol: 'S/' },
  { value: 'BRL', label: 'BRL - Real Brasileno (R$)', symbol: 'R$' },
]

const LABEL_PRESETS = [
  { name: 'Etiqueta pequena', w: 40, h: 20, desc: 'Ideal para precios' },
  { name: 'Etiqueta estandar', w: 50, h: 30, desc: 'Uso general' },
  { name: 'Etiqueta grande', w: 100, h: 50, desc: 'Productos con detalle' },
  { name: 'Etiqueta de envio', w: 100, h: 70, desc: 'Paquetes y cajas' },
]

export function OnboardingWizard() {
  const { setOnboardingComplete, addToast } = useAppStore()
  const [step, setStep] = useState(0)
  const [businessName, setBusinessName] = useState('')
  const [currencyCode, setCurrencyCode] = useState('MXN')
  const [skuPrefix, setSkuPrefix] = useState('PROD')
  const [selectedPreset, setSelectedPreset] = useState(1)

  const handleFinish = () => {
    // Business info
    if (businessName.trim()) {
      db.setSetting('business_name', businessName.trim())
    }

    // Currency
    const currencyOption = CURRENCY_OPTIONS.find((c) => c.value === currencyCode)
    db.setSetting('currency_code', currencyCode)
    db.setSetting('currency_symbol', currencyOption?.symbol || '$')

    // SKU
    if (skuPrefix.trim()) {
      db.setSetting('sku_prefix', skuPrefix.trim().toUpperCase())
    }

    // Defaults
    db.setSetting('sku_digits', '4')
    db.setSetting('default_unit', 'unidad')
    db.setSetting('low_stock_threshold', '5')

    // Label defaults from selected preset
    const preset = LABEL_PRESETS[selectedPreset]
    db.setSetting('label_default_width', String(preset.w))
    db.setSetting('label_default_height', String(preset.h))

    db.setSetting('onboarding_complete', 'true')

    // Create default template from selected preset
    db.createTemplate({
      name: preset.name,
      description: preset.desc,
      width_mm: preset.w,
      height_mm: preset.h,
      canvas_json: JSON.stringify({
        elements: [],
        width: preset.w,
        height: preset.h,
        backgroundColor: '#FFFFFF',
      }),
      is_default: 1,
      paper_size: 'custom',
      columns: 1,
      rows: 1,
      margin_top_mm: 5,
      margin_left_mm: 5,
      gap_x_mm: 2,
      gap_y_mm: 2,
    })

    setOnboardingComplete(true)
    addToast({ type: 'success', message: 'LabelCraft Pro esta listo. Bienvenido!' })
  }

  const handleSkip = () => {
    db.setSetting('onboarding_complete', 'true')
    setOnboardingComplete(true)
  }

  const steps = [
    // Step 1: Welcome
    <div key="welcome" className="flex flex-col items-center text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-copper/20">
        <Tag className="h-10 w-10 text-copper" />
      </div>
      <h2 className="text-2xl font-bold mb-2">
        Bienvenido a Label<span className="text-copper">Craft</span> Pro
      </h2>
      <p className="text-gray-400 mb-8 max-w-md">
        Disena etiquetas profesionales, gestiona tu inventario y genera codigos de barras — todo offline, sin suscripciones.
      </p>
      <div className="w-full max-w-sm space-y-4">
        <Input
          label="Nombre de tu negocio"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Mi Negocio"
        />
        <Select
          label="Moneda"
          value={currencyCode}
          onChange={(e) => setCurrencyCode(e.target.value)}
          options={CURRENCY_OPTIONS.map((c) => ({ value: c.value, label: c.label }))}
        />
        <Input
          label="Prefijo de SKU"
          value={skuPrefix}
          onChange={(e) => setSkuPrefix(e.target.value.toUpperCase())}
          placeholder="PROD"
          hint={`Ejemplo: ${skuPrefix || 'PROD'}-0001`}
        />
      </div>
    </div>,

    // Step 2: Choose template
    <div key="template" className="flex flex-col items-center text-center">
      <h2 className="text-2xl font-bold mb-2">Tu primera etiqueta</h2>
      <p className="text-gray-400 mb-6">Elige un tamano de etiqueta para empezar. Puedes cambiarlo despues.</p>
      <div className="grid grid-cols-2 gap-3 w-full max-w-md">
        {LABEL_PRESETS.map((preset, i) => (
          <button
            key={i}
            onClick={() => setSelectedPreset(i)}
            className={`rounded-xl border p-4 text-left transition-default ${
              selectedPreset === i
                ? 'border-copper bg-copper/10 shadow-glow'
                : 'border-border hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="rounded border border-current"
                style={{
                  width: Math.min(preset.w * 0.6, 60),
                  height: Math.min(preset.h * 0.6, 40),
                  borderColor: selectedPreset === i ? '#D4894A' : '#555',
                }}
              />
            </div>
            <p className="text-sm font-medium">{preset.name}</p>
            <p className="text-xs text-gray-400">{preset.w} x {preset.h} mm</p>
            <p className="text-xs text-gray-500 mt-1">{preset.desc}</p>
          </button>
        ))}
      </div>
    </div>,

    // Step 3: Ready
    <div key="ready" className="flex flex-col items-center text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-success/20">
        <Check className="h-10 w-10 text-success" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Todo listo!</h2>
      <p className="text-gray-400 mb-6 max-w-md">
        {businessName ? `"${businessName}" esta configurado.` : 'Tu espacio esta configurado.'} Puedes empezar a agregar productos, disenar etiquetas o importar datos.
      </p>
      <div className="flex gap-3 text-sm text-gray-400">
        <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3">
          <Upload className="h-4 w-4 text-copper" />
          <span>Importa desde Excel</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3">
          <FileSpreadsheet className="h-4 w-4 text-copper" />
          <span>O empieza de cero</span>
        </div>
      </div>
    </div>,
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="w-full max-w-2xl px-4 sm:px-6">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-copper' : i < step ? 'w-2 bg-copper/50' : 'w-2 bg-border'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="min-h-72 sm:min-h-[400px] flex items-center justify-center">
          {steps[step]}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={handleSkip}
            className="text-sm text-gray-500 hover:text-gray-300 transition-default"
          >
            Saltar
          </button>

          <div className="flex gap-3">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4" /> Atras
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>
                Siguiente <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish}>
                Empezar <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
