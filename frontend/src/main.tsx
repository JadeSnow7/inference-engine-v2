import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'

window.addEventListener('error', (event) => {
  console.error('Fatal browser error:', event.error ?? event.message)
})

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
} catch (error: unknown) {
  console.error('Fatal mount error:', error)
  const root = document.getElementById('root')
  if (root) {
    root.textContent = '应用启动失败，请刷新页面重试。'
  }
}
