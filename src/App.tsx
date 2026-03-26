import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { InactivityLock } from '@/components/security/InactivityLock'
import { PwaStatus } from '@/components/pwa/PwaStatus'
import { useAppStore } from '@/store/appStore'
import { db } from '@/lib/database'

// Lazy-loaded pages
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Products = lazy(() => import('@/pages/Products'))
const Editor = lazy(() => import('@/pages/Editor'))
const Print = lazy(() => import('@/pages/Print'))
const Scanner = lazy(() => import('@/pages/Scanner'))
const Movements = lazy(() => import('@/pages/Movements'))
const Reports = lazy(() => import('@/pages/Reports'))
const DataPage = lazy(() => import('@/pages/DataPage'))
const Settings = lazy(() => import('@/pages/Settings'))
const Legal = lazy(() => import('@/pages/Legal'))
const Help = lazy(() => import('@/pages/Help'))

function App() {
  const { dbReady, setDbReady, onboardingComplete, setOnboardingComplete } = useAppStore()
  const [dbError, setDbError] = useState<string | null>(null)

  useEffect(() => {
    db.init()
      .then(() => {
        setDbReady(true)
        const done = db.getSetting('onboarding_complete')
        if (done === 'true') {
          setOnboardingComplete(true)
        }

        // Auto-cleanup based on retention settings
        const retMov = parseInt(db.getSetting('retention_movements_days') || '0', 10)
        const retPrint = parseInt(db.getSetting('retention_print_days') || '0', 10)
        const retAudit = parseInt(db.getSetting('retention_audit_days') || '0', 10)
        if (retMov > 0) db.purgeOldMovements(retMov)
        if (retPrint > 0) db.purgeOldPrintHistory(retPrint)
        if (retAudit > 0) db.purgeOldAuditLogs(retAudit)
      })
      .catch((err: unknown) => {
        setDbError(err instanceof Error ? err.message : 'Error desconocido al iniciar la base de datos.')
      })
  }, [setDbReady, setOnboardingComplete])

  if (dbError) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background px-6">
        <div className="w-full max-w-md text-center">
          <div className="mb-6 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-error/20">
            <svg className="h-8 w-8 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">No se pudo iniciar la base de datos</h2>
          <p className="text-sm text-gray-400 mb-4">
            Tu navegador puede no ser compatible con WebAssembly o IndexedDB. Intenta con un navegador moderno como Chrome, Firefox o Edge.
          </p>
          <div className="rounded-lg bg-surface border border-border px-4 py-3 text-xs text-gray-500 text-left font-mono mb-6">
            {dbError}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-copper px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!dbReady) {
    return <LoadingScreen message="Iniciando base de datos..." />
  }

  if (!onboardingComplete) {
    return (
      <>
        <OnboardingWizard />
        <ToastContainer />
      </>
    )
  }

  return (
    <InactivityLock>
      <Routes>
        <Route element={<AppLayout />}>
          <Route
            index
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route
            path="productos"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Products />
              </Suspense>
            }
          />
          <Route
            path="editor/:templateId?"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Editor />
              </Suspense>
            }
          />
          <Route
            path="imprimir"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Print />
              </Suspense>
            }
          />
          <Route
            path="escanear"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Scanner />
              </Suspense>
            }
          />
          <Route
            path="movimientos"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Movements />
              </Suspense>
            }
          />
          <Route
            path="reportes"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Reports />
              </Suspense>
            }
          />
          <Route
            path="datos"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <DataPage />
              </Suspense>
            }
          />
          <Route
            path="configuracion"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Settings />
              </Suspense>
            }
          />
          <Route
            path="legal"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Legal />
              </Suspense>
            }
          />
          <Route
            path="ayuda"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Help />
              </Suspense>
            }
          />
        </Route>
      </Routes>
      <ToastContainer />
      <PwaStatus />
    </InactivityLock>
  )
}

export default App
