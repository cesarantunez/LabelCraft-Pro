import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, ChevronDown, ChevronRight, ArrowLeft, Shield, Scale, ScrollText } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { db } from '@/lib/database'

const businessName = () => db.getSetting('business_name') || 'LabelCraft Pro'

interface DocSection {
  id: string
  icon: React.ReactNode
  title: string
  content: React.ReactNode
}

function LegalSection({ section, isOpen, onToggle }: { section: DocSection; isOpen: boolean; onToggle: () => void }) {
  return (
    <Card>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          {section.icon}
          <h2 className="text-lg font-semibold">{section.title}</h2>
        </div>
        {isOpen ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
      </button>
      {isOpen && (
        <div className="mt-4 space-y-4 text-sm text-gray-300 leading-relaxed border-t border-border pt-4">
          {section.content}
        </div>
      )}
    </Card>
  )
}

export default function Legal() {
  const navigate = useNavigate()
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const name = businessName()

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const sections: DocSection[] = [
    {
      id: 'privacy',
      icon: <Shield className="h-5 w-5 text-copper" />,
      title: 'Politica de Privacidad',
      content: (
        <>
          <p className="text-xs text-gray-500">Ultima actualizacion: Marzo 2026</p>

          <div>
            <h3 className="font-semibold text-white mb-2">1. Responsable del tratamiento</h3>
            <p>{name} opera la aplicacion LabelCraft Pro. Esta politica describe como se recopilan, usan y protegen tus datos.</p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">2. Datos que recopilamos</h3>
            <p>LabelCraft Pro almacena localmente en tu dispositivo:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Informacion del negocio (nombre, direccion, telefono)</li>
              <li>Catalogo de productos (nombres, precios, costos, SKUs, imagenes)</li>
              <li>Codigos de barras y datos de etiquetas</li>
              <li>Historial de movimientos de inventario</li>
              <li>Historial de impresiones</li>
              <li>Preferencias de configuracion</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">3. Almacenamiento y seguridad</h3>
            <p><strong className="text-white">Todos los datos se almacenan exclusivamente en tu dispositivo</strong> utilizando IndexedDB del navegador. Ningun dato se transmite a servidores externos, servicios en la nube, ni terceros.</p>
            <p className="mt-2">La base de datos utiliza SQLite (via sql.js WebAssembly) dentro del navegador. Los datos persisten entre sesiones pero pueden perderse si se borran los datos del navegador.</p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">4. Uso de los datos</h3>
            <p>Los datos se utilizan unicamente para:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Gestion de productos e inventario</li>
              <li>Diseno y generacion de etiquetas con codigos de barras</li>
              <li>Generacion de reportes internos</li>
              <li>Historial de impresion</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">5. Compartir datos</h3>
            <p><strong className="text-white">No compartimos datos con terceros.</strong> La aplicacion funciona 100% offline. No se realizan llamadas a APIs externas, no se usan cookies de rastreo, ni servicios de analitica.</p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">6. Tus derechos</h3>
            <p>Tienes control total sobre tus datos. Puedes:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Exportar tu base de datos completa en cualquier momento</li>
              <li>Eliminar todos los datos borrando los datos del sitio en tu navegador</li>
              <li>Importar y exportar datos en formato CSV/Excel</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">7. Cookies y almacenamiento local</h3>
            <p>LabelCraft Pro <strong className="text-white">no utiliza cookies</strong>. El almacenamiento se realiza unicamente mediante IndexedDB, una tecnologia de almacenamiento local del navegador que no involucra cookies de ningun tipo.</p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">8. Cambios en esta politica</h3>
            <p>Nos reservamos el derecho de modificar esta politica. Los cambios se reflejaran en la fecha de actualizacion al inicio del documento.</p>
          </div>
        </>
      ),
    },
    {
      id: 'terms',
      icon: <Scale className="h-5 w-5 text-copper" />,
      title: 'Terminos y Condiciones de Uso',
      content: (
        <>
          <p className="text-xs text-gray-500">Ultima actualizacion: Marzo 2026</p>

          <div>
            <h3 className="font-semibold text-white mb-2">1. Aceptacion de los terminos</h3>
            <p>Al utilizar LabelCraft Pro, aceptas estos terminos y condiciones. Si no estas de acuerdo, no utilices la aplicacion.</p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">2. Descripcion del servicio</h3>
            <p>LabelCraft Pro es una aplicacion web progresiva (PWA) para:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Diseno e impresion de etiquetas con codigos de barras</li>
              <li>Gestion de catalogo de productos</li>
              <li>Control de inventario</li>
              <li>Generacion de reportes</li>
            </ul>
            <p className="mt-2">La aplicacion funciona completamente offline y almacena todos los datos localmente en el dispositivo del usuario.</p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">3. Uso aceptable</h3>
            <p>Te comprometes a:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Usar la aplicacion unicamente para fines legales y comerciales legitimos</li>
              <li>No intentar modificar, descompilar o realizar ingenieria inversa del software</li>
              <li>No generar codigos de barras fraudulentos o con informacion falsa</li>
              <li>Mantener respaldos de tus datos importantes</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">4. Responsabilidad sobre los datos</h3>
            <p>Al ser una aplicacion offline, <strong className="text-white">tu eres el unico responsable de tus datos</strong>. Recomendamos:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Realizar exportaciones periodicas como respaldo</li>
              <li>No borrar los datos del navegador sin exportar primero</li>
              <li>Verificar la precision de los codigos de barras generados antes de usarlos en produccion</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">5. Propiedad intelectual</h3>
            <p>LabelCraft Pro, incluyendo su codigo, diseno, iconos y marca, es propiedad de sus creadores. Las etiquetas y datos que generes dentro de la aplicacion son de tu propiedad.</p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">6. Limitacion de responsabilidad</h3>
            <p>LabelCraft Pro se proporciona "tal cual" (as-is). No garantizamos:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Que la aplicacion este libre de errores en todo momento</li>
              <li>La permanencia de los datos almacenados en el navegador</li>
              <li>Compatibilidad con todos los dispositivos o navegadores</li>
              <li>La precision de los codigos de barras para sistemas de punto de venta especificos</li>
            </ul>
            <p className="mt-2">En ningún caso seremos responsables por perdida de datos, perdida de ingresos, o danos indirectos derivados del uso de la aplicacion.</p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">7. Modificaciones</h3>
            <p>Nos reservamos el derecho de modificar estos terminos. El uso continuado de la aplicacion despues de los cambios constituye la aceptacion de los nuevos terminos.</p>
          </div>
        </>
      ),
    },
    {
      id: 'license',
      icon: <ScrollText className="h-5 w-5 text-copper" />,
      title: 'Acuerdo de Licencia',
      content: (
        <>
          <p className="text-xs text-gray-500">Ultima actualizacion: Marzo 2026</p>

          <div>
            <h3 className="font-semibold text-white mb-2">1. Otorgamiento de licencia</h3>
            <p>Se le otorga una licencia limitada, no exclusiva, no transferible y revocable para usar LabelCraft Pro de acuerdo con estos terminos.</p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">2. Tipo de licencia</h3>
            <p>La licencia es <strong className="text-white">por negocio/establecimiento</strong>. Cada negocio que utilice LabelCraft Pro requiere su propia licencia. El uso en multiples dispositivos dentro del mismo negocio esta permitido bajo una sola licencia.</p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">3. Restricciones</h3>
            <p>No puedes:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Sublicenciar, vender o redistribuir la aplicacion</li>
              <li>Modificar, descompilar o realizar ingenieria inversa del codigo fuente</li>
              <li>Usar la aplicacion para desarrollar un producto competidor</li>
              <li>Remover avisos de copyright o marcas</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">4. Actualizaciones</h3>
            <p>Las actualizaciones de la aplicacion se proporcionan automaticamente a traves del Service Worker de la PWA. Nos reservamos el derecho de modificar funcionalidades en futuras versiones.</p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">5. Terminacion</h3>
            <p>Esta licencia se termina automaticamente si incumples cualquiera de estos terminos. Al terminar, debes dejar de usar la aplicacion. Tus datos locales permanecen en tu dispositivo.</p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">6. Ley aplicable</h3>
            <p>Este acuerdo se rige por las leyes del pais donde opera el titular de LabelCraft Pro. Cualquier disputa sera resuelta en los tribunales competentes de dicha jurisdiccion.</p>
          </div>
        </>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/configuracion')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Documentos Legales</h1>
            <p className="text-sm text-gray-400 mt-0.5">Politica de privacidad, terminos de uso y licencia</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-500" />
          <span className="text-xs text-gray-500">{sections.length} documentos</span>
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((section) => (
          <LegalSection
            key={section.id}
            section={section}
            isOpen={openSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface/50 px-4 py-3 text-xs text-gray-500 text-center">
        LabelCraft Pro v1.0.0 — Todos los datos se almacenan localmente. Sin cookies. Sin rastreo. 100% offline.
      </div>
    </div>
  )
}
