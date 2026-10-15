import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Písma jsou v balíčku, ne z Google Fonts: appka musí jet i bez signálu
// a nemá komu posílat, kdo si ji otevřel.
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/geist-mono/index.css'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { registerServiceWorker } from './registerSW'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

registerServiceWorker()
