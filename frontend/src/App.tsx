import { BrowserRouter, Routes, Route } from 'react-router-dom'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<div className="p-8 text-gray-500">scaffold ok</div>} />
      </Routes>
    </BrowserRouter>
  )
}
