import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'

window.onerror = function (message, source, lineno, colno, error) {
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `<div style="padding:20px;background:#fee2e2;color:#b91c1c;font-family:monospace;height:100vh;overflow:auto;">
      <h2 style="font-size:20px;font-weight:bold;">Fatal Error</h2>
      <p style="margin-top:10px;"><b>Message:</b> ${message}</p>
      <p><b>Source:</b> ${source}:${lineno}:${colno}</p>
      <pre style="margin-top:20px;background:#fca5a5;padding:15px;border-radius:8px;">${error?.stack || 'No stack trace'}</pre>
    </div>`
  }
}

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
} catch (e: unknown) {
  const err = e as Error
  document.body.innerHTML = `<div style="padding:20px;color:red;"><h1>Fatal Mount Error</h1><pre>${err.stack}</pre></div>`
}
