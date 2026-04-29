import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

import Dashboard from './pages/Dashboard'
import Courses from './pages/Courses'
import Workbench from './pages/Workbench'
import Discovery from './pages/Discovery'

import ErrorBoundary from './ErrorBoundary.tsx'

// [核心调试探针] 拦截一切最高优先级的全局报错（跨越 React），强制打印到白屏上
window.onerror = function(message, source, lineno, colno, error) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="padding: 20px; background: #fee2e2; color: #b91c1c; font-family: monospace; height: 100vh; overflow: auto;">
      <h2 style="font-size: 20px; font-weight: bold;">🚨 终极护盾拦截到了 Fatal Error！</h2>
      <p style="margin-top: 10px;"><b>Message:</b> ${message}</p>
      <p><b>Source:</b> ${source}:${lineno}:${colno}</p>
      <pre style="margin-top: 20px; background: #fca5a5; padding: 15px; border-radius: 8px;">${error?.stack || 'No stack trace'}</pre>
    </div>`;
  }
};

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />}>
              <Route index element={<Dashboard />} />
              <Route path="courses" element={<Courses />} />
              <Route path="workbench" element={<Workbench />} />
              <Route path="discovery" element={<Discovery />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>
  )
} catch (e: any) {
  // 如果连 createRoot 都失败了，直接改写 Body
  document.body.innerHTML = `<div style="padding:20px; color:red;"><h1>Fatal Mount Error</h1><pre>${e.stack}</pre></div>`;
}
