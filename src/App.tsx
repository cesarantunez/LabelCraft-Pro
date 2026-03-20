import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
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

function App() {
  const { dbReady, setDbReady, onboardingComplete, setOnboardingComplete } = useAppStore()

  useEffect(() => {
    db.init().then(() => {
      setDbReady(true)
      const done = db.getSetting('onboarding_complete')
      if (done === 'true') {
        setOnboardingComplete(true)
      }
    })
  }, [setDbReady, setOnboardingComplete])

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
    <>
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
        </Route>
      </Routes>
      <ToastContainer />
    </>
  )
}

export default App
