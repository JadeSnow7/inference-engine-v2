import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { WorkspaceShell } from './components/workspace/WorkspaceShell'
import LoginPage from './pages/LoginPage'
import ChatPage from './pages/ChatPage'
import Dashboard from './pages/Dashboard'
import Courses from './pages/Courses'
import WorkspacePage from './pages/WorkspacePage'
import Discovery from './pages/Discovery'
import Writing from './pages/Writing'
import Library from './pages/Library'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <WorkspaceShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="courses" element={<Courses />} />
          <Route path="workbench" element={<WorkspacePage embedded />} />
          <Route path="library" element={<Library />} />
          <Route path="graph" element={<Discovery />} />
          <Route path="discovery" element={<Navigate to="/graph" replace />} />
          <Route path="writing" element={<Writing />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
